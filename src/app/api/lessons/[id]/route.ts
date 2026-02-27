import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, checkGroupAccess, forbidden } from '@/lib/api-utils';
import { get, run } from '@/db';
import { parseISO, setHours, setMinutes, format } from 'date-fns';
import { addGroupHistoryEntry, formatLessonConductedDescription } from '@/lib/group-history';
import { formatDateTimeKyiv, formatTimeKyiv } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

interface Lesson {
  id: number;
  group_id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  notes: string | null;
  status: string;
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
  
  // Check access
  const hasAccess = await checkGroupAccess(user, lesson.group_id);
  
  if (!hasAccess) {
    return forbidden();
  }
  
  // Get lesson with group, course and teacher details
  const lessonWithDetails = await get<Lesson & { group_title: string; course_title: string; course_id: number; teacher_id: number | null; teacher_name: string | null; original_teacher_id: number | null; is_replaced: boolean; topic_set_by_name: string | null; notes_set_by_name: string | null; topic_set_by_telegram_id: string | null; notes_set_by_telegram_id: string | null; telegram_user_info: any }>(
    `SELECT 
      l.id,
      l.group_id,
      l.lesson_date,
      l.start_datetime,
      l.end_datetime,
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
      g.course_id as course_id,
      c.title as course_title,
      CASE WHEN l.teacher_id IS NOT NULL THEN TRUE ELSE FALSE END as is_replaced,
      CASE 
        WHEN l.topic_set_by < 0 THEN COALESCE(l.telegram_user_info->>'first_name', 'Telegram User')
        ELSE topic_user.name 
      END as topic_set_by_name,
      CASE 
        WHEN l.notes_set_by < 0 THEN COALESCE(l.telegram_user_info->>'first_name', 'Telegram User')
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
    JOIN groups g ON l.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    LEFT JOIN users u ON l.teacher_id = u.id
    LEFT JOIN users g_teacher ON g.teacher_id = g_teacher.id
    LEFT JOIN users topic_user ON l.topic_set_by > 0 AND l.topic_set_by = topic_user.id
    LEFT JOIN users notes_user ON l.notes_set_by > 0 AND l.notes_set_by = notes_user.id
    WHERE l.id = $1`,
    [lessonId]
  );
  
  console.log('API Debug - lessonWithDetails:', lessonWithDetails);
  
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
      startTime: formatTimeKyiv(lessonWithDetails.start_datetime),
      endTime: formatTimeKyiv(lessonWithDetails.end_datetime),
      status: lessonWithDetails.status,
      topic: lessonWithDetails.topic,
      notes: lessonWithDetails.notes,
      topicSetBy: lessonWithDetails.topic_set_by_name,
      topicSetAt: formatTimestamp(lessonWithDetails.topic_set_at),
      topicSetByTelegramId: lessonWithDetails.topic_set_by_telegram_id,
      notesSetBy: lessonWithDetails.notes_set_by_name,
      notesSetAt: formatTimestamp(lessonWithDetails.notes_set_at),
      notesSetByTelegramId: lessonWithDetails.notes_set_by_telegram_id,
      telegramUserInfo: lessonWithDetails.telegram_user_info,
    } : null;
  
  return NextResponse.json({ lesson: transformedLesson });
}

// PATCH /api/lessons/[id] - Update a lesson
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
  
  // Check access
  const hasAccess = await checkGroupAccess(user, lesson.group_id);
  
  if (!hasAccess) {
    return forbidden();
  }
  
  try {
    const body = await request.json();
    const { topic, notes, status, lesson_date, start_time, set_by_telegram } = body;
    
    let updates: string[] = ['updated_at = NOW()'];
    let params: (string | number)[] = [];
    
     if (topic !== undefined) {
      updates.push(`topic = $${params.length + 1}`);
      params.push(topic);
      // Track who set the topic
      updates.push(`topic_set_by = $${params.length + 1}`);
      params.push(user.id);
      updates.push(`topic_set_at = NOW()`);
    }
    
    if (notes !== undefined) {
      updates.push(`notes = $${params.length + 1}`);
      params.push(notes);
      // Track who set the notes
      updates.push(`notes_set_by = $${params.length + 1}`);
      params.push(user.id);
      updates.push(`notes_set_at = NOW()`);
    }
    
    if (status !== undefined) {
      if (!['scheduled', 'done', 'canceled'].includes(status)) {
        return NextResponse.json({ error: 'Невірний статус' }, { status: 400 });
      }
      
      // Add history entry when lesson is marked as done
      if (status === 'done' && lesson.status !== 'done') {
        await addGroupHistoryEntry(
          lesson.group_id,
          'lesson_conducted',
          formatLessonConductedDescription(lesson.lesson_date, lesson.topic),
          user.id,
          user.name
        );
      }
      
      updates.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    
    // If changing date/time, recalculate datetime fields
    if (lesson_date || start_time) {
      const newDate = lesson_date ? parseISO(lesson_date) : parseISO(lesson.lesson_date);
      const newTime = start_time ? start_time : lesson.start_datetime.split(' ')[1].substring(0, 5);
      const [hours, minutes] = newTime.split(':').map(Number);
      
      const startDateTime = setMinutes(setHours(newDate, hours), minutes);
      const endDateTime = new Date(startDateTime.getTime() + 90 * 60 * 1000); // Default 90 min
      
      updates.push(`lesson_date = $${params.length + 1}`);
      params.push(format(newDate, 'yyyy-MM-dd'));
      updates.push(`start_datetime = $${params.length + 1}`);
      params.push(format(startDateTime, 'yyyy-MM-dd HH:mm:ss'));
      updates.push(`end_datetime = $${params.length + 1}`);
      params.push(format(endDateTime, 'yyyy-MM-dd HH:mm:ss'));
    }
    
    params.push(lessonId);
    
    const sql = `UPDATE lessons SET ${updates.join(', ')} WHERE id = $${params.length}`;
    await run(sql, params);
    
    // Get updated lesson with group, course and teacher details
    const updatedLessonRaw = await get<Lesson & { group_title: string; course_title: string; teacher_id: number | null; teacher_name: string | null; original_teacher_id: number | null; is_replaced: boolean; topic_set_by_name: string | null; notes_set_by_name: string | null; topic_set_by_telegram_id: string | null; notes_set_by_telegram_id: string | null }>(
      `SELECT 
        l.id,
        l.group_id,
        l.lesson_date,
        l.start_datetime,
        l.end_datetime,
        l.topic,
        l.notes,
        l.status,
        l.created_by,
        l.teacher_id,
        l.topic_set_by,
        l.topic_set_at,
        l.notes_set_by,
        l.notes_set_at,
        COALESCE(u.name, g_teacher.name) as teacher_name,
        g.title as group_title,
        g.teacher_id as original_teacher_id,
        c.title as course_title,
        CASE WHEN l.teacher_id IS NOT NULL THEN TRUE ELSE FALSE END as is_replaced,
        CASE 
          WHEN l.topic_set_by < 0 THEN 'Telegram User'
          ELSE topic_user.name 
        END as topic_set_by_name,
        CASE 
          WHEN l.notes_set_by < 0 THEN 'Telegram User'
          ELSE notes_user.name 
        END as notes_set_by_name,
        CASE 
          WHEN l.topic_set_by < 0 THEN CAST((-l.topic_set_by) AS TEXT)
          ELSE topic_user.telegram_id 
        END as topic_set_by_telegram_id,
        CASE 
          WHEN l.notes_set_by < 0 THEN CAST((-l.notes_set_by) AS TEXT)
          ELSE notes_user.telegram_id 
        END as notes_set_by_telegram_id
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      LEFT JOIN users u ON l.teacher_id = u.id
      LEFT JOIN users g_teacher ON g.teacher_id = g_teacher.id
      LEFT JOIN users topic_user ON l.topic_set_by > 0 AND l.topic_set_by = topic_user.id
      LEFT JOIN users notes_user ON l.notes_set_by > 0 AND l.notes_set_by = notes_user.id
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
      startTime: formatTimeKyiv(updatedLessonRaw.start_datetime),
      endTime: formatTimeKyiv(updatedLessonRaw.end_datetime),
      status: updatedLessonRaw.status,
      topic: updatedLessonRaw.topic,
      notes: updatedLessonRaw.notes,
      topicSetBy: updatedLessonRaw.topic_set_by_name,
      topicSetAt: formatTimestamp(updatedLessonRaw.topic_set_at),
      topicSetByTelegramId: updatedLessonRaw.topic_set_by_telegram_id,
      notesSetBy: updatedLessonRaw.notes_set_by_name,
      notesSetAt: formatTimestamp(updatedLessonRaw.notes_set_at),
      notesSetByTelegramId: updatedLessonRaw.notes_set_by_telegram_id,
    } : null;
    
    return NextResponse.json({
      message: 'Заняття оновлено',
      lesson: updatedLesson,
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
  
  // Check for attendance records
  const attendanceCount = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM attendance WHERE lesson_id = $1`,
    [lessonId]
  );
  
  if (attendanceCount && attendanceCount.count > 0) {
    return NextResponse.json(
      { error: 'Неможливо видалити заняття: є записи відвідуваності' },
      { status: 400 }
    );
  }
  
  await run(`DELETE FROM lessons WHERE id = $1`, [lessonId]);
  
  return NextResponse.json({ message: 'Заняття видалено' });
}
