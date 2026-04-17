import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/db/neon';
import crypto from 'crypto';
import { logLessonChange, getLessonChangeHistory } from '@/lib/lessons';
import { getLessonPhotoPayload, syncLessonPhotoFolderName } from '@/lib/lesson-photos';
import { getTodayKyivDateString, normalizeDateOnly } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function isTeacherLessonEditable(lessonDate: string | Date | null | undefined): boolean {
  return normalizeDateOnly(lessonDate) === getTodayKyivDateString();
}

// Verify Telegram Mini App initData using HMAC-SHA256
function verifyInitData(initData: string): { valid: boolean; telegramId?: string } {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not configured');
    return { valid: false };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return { valid: false };
    }

    params.delete('hash');

    const paramsArray = Array.from(params.entries());
    paramsArray.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = paramsArray
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    const userJson = params.get('user');
    if (!userJson) {
      return { valid: false };
    }

    const user = JSON.parse(userJson);
    
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return { valid: false };
    }

    return { valid: true, telegramId: user.id.toString() };
  } catch (error) {
    console.error('Error verifying initData:', error);
    return { valid: false };
  }
}

// GET /api/teacher-app/lessons/[id] - Get lesson details with students and attendance
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const initData = request.headers.get('X-Telegram-Init-Data');
    
    if (!initData) {
      return NextResponse.json(
        { error: 'Заголовок X-Telegram-Init-Data обов\'язковий' },
        { status: 401 }
      );
    }

    const verification = verifyInitData(initData);
    
    if (!verification.valid || !verification.telegramId) {
      return NextResponse.json(
        { error: 'Невірний initData' },
        { status: 401 }
      );
    }

    const telegramId = verification.telegramId;
    const lessonId = parseInt(params.id, 10);

    if (isNaN(lessonId)) {
      return NextResponse.json(
        { error: 'Невірний ID заняття' },
        { status: 400 }
      );
    }

    // Find teacher
    const teacher = await queryOne(
      `SELECT id, name FROM users WHERE telegram_id = $1 AND is_active = TRUE LIMIT 1`,
      [telegramId]
    );

    if (!teacher) {
      return NextResponse.json(
        { error: 'Викладача не знайдено' },
        { status: 401 }
      );
    }

    // Get lesson details
    const lesson = await queryOne(
      `SELECT 
        l.id, l.public_id, l.group_id, l.course_id, l.lesson_date, l.start_datetime, l.end_datetime,
        l.status, l.topic, l.notes, l.reported_by, l.reported_at, l.reported_via,
        COALESCE(l.is_makeup, FALSE) as is_makeup,
        g.title as group_title, c.title as course_title,
        ltr.replacement_teacher_id,
        ru.name as replacement_teacher_name,
        reporter.name as reported_by_name
      FROM lessons l
      LEFT JOIN groups g ON l.group_id = g.id
      LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
      LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
      LEFT JOIN users ru ON ltr.replacement_teacher_id = ru.id
      LEFT JOIN users reporter ON l.reported_by = reporter.id
      WHERE l.id = $1
      AND (
        g.teacher_id = $2
        OR ltr.replacement_teacher_id = $2
        OR (l.group_id IS NULL AND l.teacher_id = $2)
      )`,
      [lessonId, teacher.id]
    );

    if (!lesson) {
      return NextResponse.json(
        { error: 'Заняття не знайдено або доступ заборонено' },
        { status: 404 }
      );
    }

    // Get students with attendance
    // For individual lessons (group_id IS NULL), get students from attendance table
    // For group lessons, UNION the group roster with trial visitors attached via attendance.is_trial
    const students = lesson.group_id
      ? await query(
          `SELECT
            s.id, s.full_name, s.public_id as student_public_id,
            a.status as attendance_status, a.updated_at as attendance_updated,
            COALESCE(a.is_trial, FALSE) as is_trial
          FROM student_groups sg
          JOIN students s ON sg.student_id = s.id
          LEFT JOIN attendance a ON a.student_id = s.id AND a.lesson_id = $1
          WHERE sg.group_id = $2
            AND sg.is_active = TRUE
            AND s.is_active = TRUE
          UNION
          SELECT
            s.id, s.full_name, s.public_id as student_public_id,
            a.status as attendance_status, a.updated_at as attendance_updated,
            TRUE as is_trial
          FROM attendance a
          JOIN students s ON a.student_id = s.id
          WHERE a.lesson_id = $1
            AND COALESCE(a.is_trial, FALSE) = TRUE
            AND s.is_active = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM student_groups sg2
              WHERE sg2.group_id = $2
                AND sg2.student_id = s.id
                AND sg2.is_active = TRUE
            )
          ORDER BY full_name`,
          [lessonId, lesson.group_id]
        )
      : await query(
          `SELECT
            s.id, s.full_name, s.public_id as student_public_id,
            a.status as attendance_status, a.updated_at as attendance_updated,
            COALESCE(a.is_trial, FALSE) as is_trial
          FROM attendance a
          JOIN students s ON a.student_id = s.id
          WHERE a.lesson_id = $1
          AND s.is_active = TRUE
          ORDER BY s.full_name`,
          [lessonId]
        );

    // For makeup lessons, fetch original lesson info per student
    let studentsWithOriginal = students || [];
    if (lesson.is_makeup && studentsWithOriginal.length > 0) {
      const originalInfoRows = await query(
        `SELECT
          orig_att.student_id,
          orig_l.id as original_lesson_id,
          orig_l.lesson_date as original_lesson_date,
          orig_l.topic as original_lesson_topic,
          COALESCE(orig_g.title, 'Індивідуальне') as original_group_title,
          COALESCE(oc_les.title, oc_grp.title, 'Без курсу') as original_course_title
        FROM attendance orig_att
        JOIN lessons orig_l ON orig_att.lesson_id = orig_l.id
        LEFT JOIN groups orig_g ON orig_l.group_id = orig_g.id
        LEFT JOIN courses oc_grp ON orig_g.course_id = oc_grp.id
        LEFT JOIN courses oc_les ON orig_l.course_id = oc_les.id
        WHERE orig_att.makeup_lesson_id = $1`,
        [lessonId]
      );

      const originalByStudent = new Map<number, object>();
      for (const row of (originalInfoRows || [])) {
        originalByStudent.set(row.student_id, {
          original_lesson_id: row.original_lesson_id,
          original_lesson_date: row.original_lesson_date,
          original_lesson_topic: row.original_lesson_topic,
          original_group_title: row.original_group_title,
          original_course_title: row.original_course_title,
        });
      }

      studentsWithOriginal = studentsWithOriginal.map((s: { id: number }) => ({
        ...s,
        ...(originalByStudent.get(s.id) || {}),
      }));
    }

    let photoPayload: Awaited<ReturnType<typeof getLessonPhotoPayload>> = { photoFolder: null, photos: [] };
    if (lesson.group_id) {
      try {
        photoPayload = await getLessonPhotoPayload(lessonId);
      } catch (photoError) {
        console.error('Failed to load lesson photo payload:', photoError);
      }
    }

    return NextResponse.json({
      lesson,
      students: studentsWithOriginal,
      photoFolder: photoPayload.photoFolder,
      photos: photoPayload.photos,
      canManagePhotos: lesson.group_id !== null && isTeacherLessonEditable(lesson.lesson_date),
    });

  } catch (error) {
    console.error('Lesson details error:', error);
    return NextResponse.json(
      { error: 'Не вдалося завантажити деталі заняття' },
      { status: 500 }
    );
  }
}

// PATCH /api/teacher-app/lessons/[id] - Update lesson (topic, notes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const initData = request.headers.get('X-Telegram-Init-Data');
    
    if (!initData) {
      return NextResponse.json(
        { error: 'Заголовок X-Telegram-Init-Data обов\'язковий' },
        { status: 401 }
      );
    }

    const verification = verifyInitData(initData);
    
    if (!verification.valid || !verification.telegramId) {
      return NextResponse.json(
        { error: 'Невірний initData' },
        { status: 401 }
      );
    }

    const telegramId = verification.telegramId;
    const lessonId = parseInt(params.id, 10);

    if (isNaN(lessonId)) {
      return NextResponse.json(
        { error: 'Невірний ID заняття' },
        { status: 400 }
      );
    }

    // Find teacher
    const teacher = await queryOne(
      `SELECT id, name FROM users WHERE telegram_id = $1 AND is_active = TRUE LIMIT 1`,
      [telegramId]
    );

    if (!teacher) {
      return NextResponse.json(
        { error: 'Викладача не знайдено' },
        { status: 401 }
      );
    }

    // Verify teacher has access to this lesson
    const lessonAccess = await queryOne(
      `SELECT l.id, l.group_id, l.status, l.lesson_date
      FROM lessons l
      LEFT JOIN groups g ON l.group_id = g.id
      LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
      WHERE l.id = $1
      AND (
        g.teacher_id = $2
        OR ltr.replacement_teacher_id = $2
        OR (l.group_id IS NULL AND l.teacher_id = $2)
      )`,
      [lessonId, teacher.id]
    );

    if (!lessonAccess) {
      return NextResponse.json(
        { error: 'Заняття не знайдено або доступ заборонено' },
        { status: 404 }
      );
    }

    if (!isTeacherLessonEditable(lessonAccess.lesson_date)) {
      return NextResponse.json(
        { error: 'Викладач може редагувати лише сьогоднішні заняття.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { topic: rawTopic, notes: rawNotes, status } = body;

    // Normalize empty strings to null
    const topic = rawTopic !== undefined ? (rawTopic === '' ? null : rawTopic) : undefined;
    const notes = rawNotes !== undefined ? (rawNotes === '' ? null : rawNotes) : undefined;

    // Get old values for logging
    const oldLesson = await queryOne(
      `SELECT topic, notes FROM lessons WHERE id = $1`,
      [lessonId]
    ) as { topic: string | null; notes: string | null } | null;

    // Build update query
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (topic !== undefined) {
      updates.push(`topic = $${paramIndex}`);
      values.push(topic);
      paramIndex++;
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      values.push(notes);
      paramIndex++;
    }

    // If setting topic/notes or explicitly marking as conducted
    if (status === 'done' || topic !== undefined || notes !== undefined) {
      updates.push("status = $" + paramIndex);
      values.push('done');
      paramIndex++;
      
      // New schema columns
      updates.push("reported_by = $" + paramIndex);
      values.push(teacher.id);
      paramIndex++;
      
      updates.push(`reported_at = NOW()`);
      
      updates.push("reported_via = $" + paramIndex);
      values.push('telegram');
      paramIndex++;
      
      // Old schema columns for backwards compatibility
      if (topic !== undefined) {
        updates.push("topic_set_by = $" + paramIndex);
        values.push(teacher.id);
        paramIndex++;
        
        updates.push(`topic_set_at = NOW()`);
      }
      
      if (notes !== undefined) {
        updates.push("notes_set_by = $" + paramIndex);
        values.push(teacher.id);
        paramIndex++;
        
        updates.push(`notes_set_at = NOW()`);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'Немає полів для оновлення' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(lessonId);

    const updateQuery = `
      UPDATE lessons 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING id, topic, notes, status, reported_by, reported_at, reported_via
    `;

    const result = await queryOne(updateQuery, values);

    // Log changes if topic or notes were actually changed
    if (topic !== undefined && oldLesson && topic !== oldLesson.topic) {
      await logLessonChange(
        lessonId,
        'topic',
        oldLesson.topic,
        topic,
        teacher.id,
        teacher.name,
        'telegram',
        telegramId
      );
    }

    if (notes !== undefined && oldLesson && notes !== oldLesson.notes) {
      await logLessonChange(
        lessonId,
        'notes',
        oldLesson.notes,
        notes,
        teacher.id,
        teacher.name,
        'telegram',
        telegramId
      );
    }

    let photoFolder = null;
    let photos: Awaited<ReturnType<typeof getLessonPhotoPayload>>['photos'] = [];

    if (lessonAccess.group_id !== null) {
      if (topic !== undefined) {
        try {
          await syncLessonPhotoFolderName(lessonId);
        } catch (syncError) {
          console.error('Failed to sync lesson photo folder:', syncError);
        }
      }

      try {
        const photoPayload = await getLessonPhotoPayload(lessonId);
        photoFolder = photoPayload.photoFolder;
        photos = photoPayload.photos;
      } catch (photoError) {
        console.error('Failed to load lesson photo payload:', photoError);
      }
    }

    return NextResponse.json({
      success: true,
      lesson: result,
      photoFolder,
      photos,
      canManagePhotos: lessonAccess.group_id !== null && isTeacherLessonEditable(lessonAccess.lesson_date),
    });

  } catch (error) {
    console.error('Lesson update error:', error);
    return NextResponse.json(
      { error: 'Не вдалося оновити заняття' },
      { status: 500 }
    );
  }
}
