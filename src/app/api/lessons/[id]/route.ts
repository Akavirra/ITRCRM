import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, checkGroupAccess, forbidden } from '@/lib/api-utils';
import { get, run, all } from '@/db';
import { format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { addGroupHistoryEntry, formatLessonConductedDescription } from '@/lib/group-history';
import { formatDateTimeKyiv, formatTimeKyiv } from '@/lib/date-utils';
import { logLessonChange, getLessonChangeHistory } from '@/lib/lessons';
import { useIndividualLesson } from '@/lib/individual-payments';
import { deleteLessonPhotoFolder, getLessonPhotoPayload, syncLessonPhotoFolderName } from '@/lib/lesson-photos';

export const dynamic = 'force-dynamic';

interface Lesson {
  id: number;
  group_id: number;
  lesson_date: string;
  original_date: string | null;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  notes: string | null;
  status: string;
  is_makeup: boolean;
  created_by: number;
  topic_set_by: number | null;
  topic_set_at: string | null;
  notes_set_by: number | null;
  notes_set_at: string | null;
}

// GET /api/lessons/[id] - Get a specific lesson
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return unauthorized();
    }
    
    const lessonId = parseInt(params.id, 10);
    
    if (isNaN(lessonId)) {
      return NextResponse.json({ error: 'Невірний ID заняття' }, { status: 400 });
    }
    
    const lesson = await get<Lesson>(
      `SELECT * FROM lessons WHERE id = $1`,
      [lessonId]
    );
    
    if (!lesson) {
      return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
    }

    // Check access - skip for individual/makeup lessons (no group)
    if (lesson.group_id !== null && lesson.group_id !== undefined) {
      const hasAccess = await checkGroupAccess(user, lesson.group_id);
      if (!hasAccess) {
        return forbidden();
      }
    }

  // Get lesson with group, course and teacher details
  // Use LEFT JOIN to support individual lessons (without group)
  type LessonDetails = Lesson & { group_title: string | null; course_title: string | null; course_id: number | null; teacher_id: number | null; teacher_name: string | null; original_teacher_id: number | null; is_replaced: boolean; topic_set_by_name: string | null; notes_set_by_name: string | null; topic_set_by_telegram_id: string | null; notes_set_by_telegram_id: string | null; telegram_user_info: any; start_time_formatted: string | null; end_time_formatted: string | null };
  const detailsSql = `SELECT
      l.id,
      l.group_id,
      l.course_id as lesson_course_id,
      l.lesson_date,
      l.original_date,
      COALESCE(l.is_makeup, FALSE) as is_makeup,
      l.start_datetime,
      l.end_datetime,
      TO_CHAR(l.start_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as start_time_formatted,
      TO_CHAR(l.end_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as end_time_formatted,
      l.topic,
      l.notes,
      l.status,
      l.created_by,
      l.teacher_id,
      l.topic_set_by,
      l.topic_set_at,
      l.notes_set_by,
      l.notes_set_at,
      l.telegram_user_info,
      COALESCE(u.name, g_teacher.name) as teacher_name,
      g.title as group_title,
      g.teacher_id as original_teacher_id,
      COALESCE(l.course_id, g.course_id) as course_id,
      c.title as course_title,
      CASE WHEN l.teacher_id IS NOT NULL AND l.group_id IS NOT NULL AND l.teacher_id != g.teacher_id THEN TRUE ELSE FALSE END as is_replaced,
      CASE
        WHEN l.topic_set_by IS NULL AND l.telegram_user_info IS NOT NULL THEN
          COALESCE(l.telegram_user_info->>'first_name', 'Telegram User')
        WHEN l.topic_set_by < 0 THEN 'Telegram User'
        ELSE topic_user.name
      END as topic_set_by_name,
      CASE 
        WHEN l.notes_set_by IS NULL AND l.telegram_user_info IS NOT NULL THEN
          COALESCE(l.telegram_user_info->>'first_name', 'Telegram User')
        WHEN l.notes_set_by < 0 THEN 'Telegram User'
        ELSE notes_user.name 
      END as notes_set_by_name,
      CASE 
        WHEN l.topic_set_by < 0 THEN COALESCE(l.telegram_user_info->>'telegram_id', CAST((-l.topic_set_by) AS TEXT))
        ELSE topic_user.telegram_id 
      END as topic_set_by_telegram_id,
      CASE 
        WHEN l.notes_set_by < 0 THEN COALESCE(l.telegram_user_info->>'telegram_id', CAST((-l.notes_set_by) AS TEXT))
        ELSE notes_user.telegram_id 
      END as notes_set_by_telegram_id
    FROM lessons l
    LEFT JOIN groups g ON l.group_id = g.id
    LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
    LEFT JOIN users u ON l.teacher_id = u.id
    LEFT JOIN users g_teacher ON g.teacher_id = g_teacher.id
    LEFT JOIN users topic_user ON l.topic_set_by > 0 AND l.topic_set_by = topic_user.id
    LEFT JOIN users notes_user ON l.notes_set_by > 0 AND l.notes_set_by = notes_user.id
    WHERE l.id = $1`;

  let lessonWithDetails: LessonDetails | undefined;
  try {
    lessonWithDetails = await get<LessonDetails>(detailsSql, [lessonId]);
  } catch (err: any) {
    if (String(err?.message ?? err).toLowerCase().includes('is_makeup')) {
      const fallback = detailsSql.replace('COALESCE(l.is_makeup, FALSE) as is_makeup,', 'FALSE as is_makeup,');
      lessonWithDetails = await get<LessonDetails>(fallback, [lessonId]);
    } else {
      throw err;
    }
  }

    // Transform to camelCase format - handle null teacher_id and date conversion
    const formatTimestamp = (timestamp: string | null): string | null => {
      if (!timestamp) return null;
      return formatDateTimeKyiv(timestamp);
    };
    
    const transformedLesson = lessonWithDetails ? {
      id: lessonWithDetails.id,
      groupId: lessonWithDetails.group_id,
      groupTitle: lessonWithDetails.group_title,
      courseTitle: lessonWithDetails.course_title,
      courseId: lessonWithDetails.course_id,
      // If lesson has replacement teacher, use it; otherwise use group teacher or null
      teacherId: lessonWithDetails.teacher_id || lessonWithDetails.original_teacher_id || null,
      // Show replacement teacher name if replaced, otherwise show group teacher name or placeholder
      teacherName: lessonWithDetails.teacher_name || (lessonWithDetails.original_teacher_id ? 'Викладач групи' : 'Немає викладача'),
      originalTeacherId: lessonWithDetails.original_teacher_id || null,
      isReplaced: lessonWithDetails.is_replaced,
      startTime: lessonWithDetails.start_time_formatted || formatTimeKyiv(lessonWithDetails.start_datetime),
      endTime: lessonWithDetails.end_time_formatted || formatTimeKyiv(lessonWithDetails.end_datetime),
      status: lessonWithDetails.status,
      topic: lessonWithDetails.topic,
      notes: lessonWithDetails.notes,
      topicSetBy: lessonWithDetails.topic_set_by_name,
      topicSetAt: formatTimestamp(lessonWithDetails.topic_set_at),
      topicSetByTelegramId: lessonWithDetails.topic_set_by_telegram_id,
      notesSetBy: lessonWithDetails.notes_set_by_name,
      notesSetAt: formatTimestamp(lessonWithDetails.notes_set_at),
      notesSetByTelegramId: lessonWithDetails.notes_set_by_telegram_id,
      lessonDate: lessonWithDetails.lesson_date,
      originalDate: (lessonWithDetails as any).original_date || null,
      isRescheduled: !!(lessonWithDetails as any).original_date,
      isMakeup: !!(lessonWithDetails as any).is_makeup,
      telegramUserInfo: lessonWithDetails.telegram_user_info,
    } : null;

    // Get change history
    const changeHistory = await getLessonChangeHistory(lessonId);
    const canManagePhotos = user.role === 'admin' && lesson.group_id !== null;
    let photoPayload: Awaited<ReturnType<typeof getLessonPhotoPayload>> = { photoFolder: null, photos: [] };
    if (lesson.group_id !== null) {
      try {
        photoPayload = await getLessonPhotoPayload(lessonId);
      } catch (photoError) {
        console.error('Failed to load lesson photo payload:', photoError);
      }
    }

    // If this is a makeup lesson, fetch which original lessons it covers
    let makeupFor: Array<{
      attendance_id: number;
      student_id: number;
      student_name: string;
      original_lesson_id: number;
      original_lesson_date: string;
      original_start_time: string | null;
      original_lesson_topic: string | null;
      original_group_id: number | null;
      original_group_title: string | null;
      original_course_title: string | null;
    }> = [];

    if (transformedLesson?.isMakeup) {
      makeupFor = await all(
        `SELECT
           a.id                   AS attendance_id,
           a.student_id,
           s.full_name            AS student_name,
           orig_l.id              AS original_lesson_id,
           orig_l.lesson_date     AS original_lesson_date,
           TO_CHAR(orig_l.start_datetime AT TIME ZONE 'Europe/Kyiv', 'HH24:MI') AS original_start_time,
           orig_l.topic           AS original_lesson_topic,
           orig_l.group_id        AS original_group_id,
           orig_g.title           AS original_group_title,
           COALESCE(c_grp.title, c_les.title) AS original_course_title
         FROM attendance a
         JOIN students  s      ON a.student_id   = s.id
         JOIN lessons   orig_l ON a.lesson_id    = orig_l.id
         LEFT JOIN groups  orig_g  ON orig_l.group_id  = orig_g.id
         LEFT JOIN courses c_grp   ON orig_g.course_id = c_grp.id
         LEFT JOIN courses c_les   ON orig_l.course_id = c_les.id
         WHERE a.makeup_lesson_id = $1
         ORDER BY s.full_name, orig_l.lesson_date`,
        [lessonId]
      );
    }

    return NextResponse.json({
      lesson: transformedLesson,
      changeHistory: changeHistory || [],
      makeupFor,
      photoFolder: photoPayload.photoFolder,
      photos: photoPayload.photos,
      canManagePhotos,
    });
  } catch (error) {
    console.error('Get lesson error:', error);
    return NextResponse.json({ error: 'Не вдалося отримати заняття' }, { status: 500 });
  }
}

// PATCH /api/lessons/[id] - Update a lesson
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return unauthorized();
    }
    
    const lessonId = parseInt(params.id, 10);
    
    if (isNaN(lessonId)) {
      return NextResponse.json({ error: 'Невірний ID заняття' }, { status: 400 });
    }
    
    const lesson = await get<Lesson>(
      `SELECT * FROM lessons WHERE id = $1`,
      [lessonId]
    );
    
    if (!lesson) {
      return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
    }

    // Check access - skip for individual/makeup lessons (no group)
    if (lesson.group_id !== null && lesson.group_id !== undefined) {
      const hasAccess = await checkGroupAccess(user, lesson.group_id);
      if (!hasAccess) {
        return forbidden();
      }
    }

    const body = await request.json();
    const { topic, notes, status, lesson_date, start_time, set_by_telegram } = body;
    
    let updates: string[] = [];
    let queryParams: (string | number)[] = [];
    
    // Always add id as first parameter to help PostgreSQL determine parameter types
    queryParams.push(lessonId);
    
    if (topic !== undefined) {
      updates.push(`topic = $${queryParams.length + 1}`);
      queryParams.push(topic);
      // Track who set the topic
      updates.push(`topic_set_by = $${queryParams.length + 1}`);
      queryParams.push(user.id);
      updates.push(`topic_set_at = NOW()`);
    }
    
    if (notes !== undefined) {
      updates.push(`notes = $${queryParams.length + 1}`);
      queryParams.push(notes);
      // Track who set the notes
      updates.push(`notes_set_by = $${queryParams.length + 1}`);
      queryParams.push(user.id);
      updates.push(`notes_set_at = NOW()`);
    }
    
    if (status !== undefined) {
      if (!['scheduled', 'done', 'canceled'].includes(status)) {
        return NextResponse.json({ error: 'Невірний статус' }, { status: 400 });
      }
      
      // Add history entry when lesson is marked as done
      if (status === 'done' && lesson.status !== 'done') {
        if (lesson.group_id) {
          await addGroupHistoryEntry(
            lesson.group_id,
            'lesson_conducted',
            formatLessonConductedDescription(lesson.lesson_date, lesson.topic),
            user.id,
            user.name
          );
        } else {
          // Individual lesson: deduct from balance for each present student
          const presentStudents = await all<{ student_id: number }>(
            `SELECT student_id FROM attendance WHERE lesson_id = $1 AND status = 'present'`,
            [lessonId]
          );
          for (const ps of presentStudents) {
            await useIndividualLesson(ps.student_id);
          }
        }
      }
      
      updates.push(`status = $${queryParams.length + 1}`);
      queryParams.push(status);
    }
    
    // If changing date/time, recalculate datetime fields
    if (lesson_date || start_time) {
      const KYIV_TZ = 'Europe/Kyiv';
      const newDateStr = lesson_date ?? lesson.lesson_date.split('T')[0].split(' ')[0];
      // Extract current time in Kyiv timezone (not raw UTC string)
      const newTime = start_time ?? formatTimeKyiv(lesson.start_datetime);

      // Preserve existing lesson duration
      const existingDurationMs = new Date(lesson.end_datetime).getTime() - new Date(lesson.start_datetime).getTime();
      const durationMinutes = Math.round(existingDurationMs / 60000) || 90;

      // Convert Kyiv time to UTC for storage
      const startUtc = fromZonedTime(`${newDateStr}T${newTime}:00`, KYIV_TZ);
      const endUtc = new Date(startUtc.getTime() + durationMinutes * 60 * 1000);

      updates.push(`lesson_date = $${queryParams.length + 1}`);
      queryParams.push(newDateStr);
      updates.push(`start_datetime = $${queryParams.length + 1}`);
      queryParams.push(format(startUtc, 'yyyy-MM-dd HH:mm:ss'));
      updates.push(`end_datetime = $${queryParams.length + 1}`);
      queryParams.push(format(endUtc, 'yyyy-MM-dd HH:mm:ss'));
    }
    
    // Always update updated_at
    updates.push('updated_at = NOW()');
    
    // Get old values for logging before update
    const oldLesson = await get<{ topic: string | null; notes: string | null }>(
      `SELECT topic, notes FROM lessons WHERE id = $1`,
      [lessonId]
    );
    
    const sql = "UPDATE lessons SET " + updates.join(', ') + " WHERE id = $1";
    await run(sql, queryParams);
    
    // Log changes if topic or notes were updated
    if (topic !== undefined && oldLesson) {
      await logLessonChange(
        lessonId,
        'topic',
        oldLesson.topic,
        topic,
        user.id,
        user.name,
        'admin'
      );
    }
    
    if (notes !== undefined && oldLesson) {
      await logLessonChange(
        lessonId,
        'notes',
        oldLesson.notes,
        notes,
        user.id,
        user.name,
        'admin'
      );
    }
    
    // Get updated lesson with group, course and teacher details
    // Use LEFT JOIN to support individual lessons (without group)
    const updatedLessonRaw = await get<Lesson & { group_title: string | null; course_title: string | null; course_id: number | null; teacher_id: number | null; teacher_name: string | null; original_teacher_id: number | null; is_replaced: boolean; topic_set_by_name: string | null; notes_set_by_name: string | null; topic_set_by_telegram_id: string | null; notes_set_by_telegram_id: string | null; start_time_formatted: string | null; end_time_formatted: string | null }>(
      `SELECT 
        l.id,
        l.group_id,
        l.lesson_date,
        l.start_datetime,
        l.end_datetime,
        TO_CHAR(l.start_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as start_time_formatted,
        TO_CHAR(l.end_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as end_time_formatted,
        l.topic,
        l.notes,
        l.status,
        l.created_by,
        l.teacher_id,
        l.topic_set_by,
        l.topic_set_at,
        l.notes_set_by,
        l.notes_set_at,
        l.telegram_user_info,
        COALESCE(u.name, g_teacher.name) as teacher_name,
        g.title as group_title,
        g.teacher_id as original_teacher_id,
        COALESCE(l.course_id, g.course_id) as course_id,
        c.title as course_title,
        CASE WHEN l.teacher_id IS NOT NULL AND l.group_id IS NOT NULL AND l.teacher_id != g.teacher_id THEN TRUE ELSE FALSE END as is_replaced,
        COALESCE(
          CASE 
            WHEN l.topic_set_by IS NULL AND l.telegram_user_info IS NOT NULL THEN
              COALESCE(l.telegram_user_info->>'first_name', 'Telegram User')
            WHEN l.topic_set_by < 0 THEN 'Telegram User'
            ELSE topic_user.name 
          END, 'Unknown'
        ) AS topic_set_by_name,
        COALESCE(
          CASE 
            WHEN l.notes_set_by IS NULL AND l.telegram_user_info IS NOT NULL THEN
              COALESCE(l.telegram_user_info->>'first_name', 'Telegram User')
            WHEN l.notes_set_by < 0 THEN 'Telegram User'
            ELSE notes_user.name 
          END, 'Unknown'
        ) AS notes_set_by_name,
        COALESCE(l.telegram_user_info->>'telegram_id', topic_user.telegram_id, notes_user.telegram_id) as topic_set_by_telegram_id,
        COALESCE(l.telegram_user_info->>'telegram_id', topic_user.telegram_id, notes_user.telegram_id) as notes_set_by_telegram_id
      FROM lessons l
      LEFT JOIN groups g ON l.group_id = g.id
      LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
      LEFT JOIN users u ON l.teacher_id = u.id
      LEFT JOIN users g_teacher ON g.teacher_id = g_teacher.id
      LEFT JOIN users topic_user ON l.topic_set_by IS NOT NULL AND l.topic_set_by = topic_user.id
      LEFT JOIN users notes_user ON l.notes_set_by IS NOT NULL AND l.notes_set_by = notes_user.id
      WHERE l.id = $1`,
      [lessonId]
    );
    
    // Transform to camelCase format - handle null teacher_id and date conversion
    const formatTimestamp = (timestamp: string | null): string | null => {
      if (!timestamp) return null;
      return formatDateTimeKyiv(timestamp);
    };
    
    const updatedLesson = updatedLessonRaw ? {
      id: updatedLessonRaw.id,
      groupId: updatedLessonRaw.group_id,
      groupTitle: updatedLessonRaw.group_title,
      courseTitle: updatedLessonRaw.course_title,
      teacherId: updatedLessonRaw.teacher_id || updatedLessonRaw.original_teacher_id || null,
      teacherName: updatedLessonRaw.teacher_name || (updatedLessonRaw.original_teacher_id ? 'Викладач групи' : 'Немає викладача'),
      originalTeacherId: updatedLessonRaw.original_teacher_id || null,
      isReplaced: updatedLessonRaw.is_replaced,
      startTime: updatedLessonRaw.start_time_formatted || formatTimeKyiv(updatedLessonRaw.start_datetime),
      endTime: updatedLessonRaw.end_time_formatted || formatTimeKyiv(updatedLessonRaw.end_datetime),
      status: updatedLessonRaw.status,
      topic: updatedLessonRaw.topic,
      notes: updatedLessonRaw.notes,
      topicSetBy: updatedLessonRaw.topic_set_by_name,
      topicSetAt: formatTimestamp(updatedLessonRaw.topic_set_at),
      topicSetByTelegramId: updatedLessonRaw.topic_set_by_telegram_id,
      notesSetBy: updatedLessonRaw.notes_set_by_name,
      notesSetAt: formatTimestamp(updatedLessonRaw.notes_set_at),
      notesSetByTelegramId: updatedLessonRaw.notes_set_by_telegram_id,
      telegramUserInfo: (updatedLessonRaw as any).telegram_user_info,
    } : null;
    
    const updatedChangeHistory = await getLessonChangeHistory(lessonId);
    let photoFolder = null;
    let photos: Awaited<ReturnType<typeof getLessonPhotoPayload>>['photos'] = [];

    if (lesson.group_id !== null) {
      if (status === 'canceled') {
        try {
          await deleteLessonPhotoFolder(lessonId, { id: user.id, name: user.name, via: 'admin' });
        } catch (deleteError) {
          console.error('Failed to delete lesson photo folder:', deleteError);
        }
      } else if (topic !== undefined || lesson_date !== undefined) {
        try {
          await syncLessonPhotoFolderName(lessonId);
        } catch (syncError) {
          console.error('Failed to sync lesson photo folder:', syncError);
        }
      }

      if (status !== 'canceled') {
        try {
          const photoPayload = await getLessonPhotoPayload(lessonId);
          photoFolder = photoPayload.photoFolder;
          photos = photoPayload.photos;
        } catch (photoError) {
          console.error('Failed to load lesson photo payload:', photoError);
        }
      }
    }

    return NextResponse.json({
      message: 'Заняття оновлено',
      lesson: updatedLesson,
      changeHistory: updatedChangeHistory || [],
      photoFolder,
      photos,
      canManagePhotos: user.role === 'admin' && lesson.group_id !== null,
    });
  } catch (error) {
    console.error('Update lesson error:', error);
    return NextResponse.json({ error: 'Не вдалося оновити заняття' }, { status: 500 });
  }
}

// DELETE /api/lessons/[id] - Delete a lesson (permanent)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (user.role !== 'admin') {
    return forbidden();
  }
  
  const lessonId = parseInt(params.id, 10);
  
  if (isNaN(lessonId)) {
    return NextResponse.json({ error: 'Невірний ID заняття' }, { status: 400 });
  }
  
  const lesson = await get<Lesson>(
    `SELECT * FROM lessons WHERE id = $1`,
    [lessonId]
  );
  
  if (!lesson) {
    return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
  }
  
  // If this is a makeup lesson, revert original absences back to 'absent'
  if (lesson.is_makeup) {
    await run(
      `UPDATE attendance SET status = 'absent', makeup_lesson_id = NULL
       WHERE makeup_lesson_id = $1`,
      [lessonId]
    );
  }

  // Check for attendance records - for individual lessons we can delete them too
  const attendanceCount = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM attendance WHERE lesson_id = $1`,
    [lessonId]
  );

  if (attendanceCount && attendanceCount.count > 0) {
    // Delete attendance records first (for individual lessons)
    await run(`DELETE FROM attendance WHERE lesson_id = $1`, [lessonId]);
  }

  await run(`DELETE FROM lessons WHERE id = $1`, [lessonId]);
  
  return NextResponse.json({ message: 'Заняття видалено' });
}
