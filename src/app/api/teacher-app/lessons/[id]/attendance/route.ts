import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/db/neon';
import crypto from 'crypto';
import { logLessonChange, checkAndAutoCancelLesson } from '@/lib/lessons';
import { safeCreateLessonDoneNotification } from '@/lib/notifications';
import { useIndividualLesson } from '@/lib/individual-payments';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

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

// POST /api/teacher-app/lessons/[id]/attendance - Update student attendance
export async function POST(
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

    // Check if lesson is in the past (before today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lessonDate = new Date(lessonAccess.lesson_date);
    lessonDate.setHours(0, 0, 0, 0);
    
    if (lessonDate < today) {
      return NextResponse.json(
        { error: 'Неможливо редагувати відвідуваність занять минулих днів. Ви можете редагувати лише сьогоднішні та майбутні заняття.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { studentId, status: attendanceStatus } = body;

    if (!studentId || !attendanceStatus) {
      return NextResponse.json(
        { error: 'Параметри studentId та status обов\'язкові' },
        { status: 400 }
      );
    }

    // Validate status - map 'sick' to 'absent' for database compatibility
    // Database allows: 'present', 'absent', 'makeup_planned', 'makeup_done'
    // UI sends: 'present', 'absent', 'sick'
    const dbStatus = attendanceStatus === 'sick' ? 'absent' : attendanceStatus;
    
    if (!['present', 'absent'].includes(dbStatus)) {
      return NextResponse.json(
        { error: 'Невірний статус. Допустимі значення: present, absent або sick' },
        { status: 400 }
      );
    }

    // Verify student belongs to this lesson
    // For individual lessons (group_id IS NULL), check attendance table
    // For group lessons, check student_groups table
    const studentCheck = lessonAccess.group_id
      ? await queryOne(
          `SELECT sg.id 
          FROM student_groups sg
          JOIN students s ON sg.student_id = s.id
          WHERE sg.group_id = $1 
          AND sg.student_id = $2
          AND sg.is_active = TRUE
          AND s.is_active = TRUE`,
          [lessonAccess.group_id, studentId]
        )
      : await queryOne(
          `SELECT a.id 
          FROM attendance a
          JOIN students s ON a.student_id = s.id
          WHERE a.lesson_id = $1 
          AND a.student_id = $2
          AND s.is_active = TRUE`,
          [lessonId, studentId]
        );

    if (!studentCheck) {
      return NextResponse.json(
        { error: 'Учня не знайдено у цій групі' },
        { status: 404 }
      );
    }

    // Insert or update attendance
    await query(
      `INSERT INTO attendance (lesson_id, student_id, status, updated_at, updated_by)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (lesson_id, student_id) 
       DO UPDATE SET 
         status = $3, 
         updated_at = NOW(), 
         updated_by = $4`,
      [lessonId, studentId, dbStatus, teacher.id]
    );
    
    // Fetch student name (needed for logs below)
    const studentName = await queryOne(
      `SELECT full_name FROM students WHERE id = $1`,
      [studentId]
    ) as { full_name: string } | null;

    // If this is a makeup lesson, sync original absence record and log it
    const makeupLesson = await queryOne(
      `SELECT is_makeup, lesson_date FROM lessons WHERE id = $1`,
      [lessonId]
    ) as { is_makeup: boolean | null; lesson_date: string } | null;
    if (makeupLesson?.is_makeup) {
      const origRecords = await query(
        `SELECT lesson_id FROM attendance WHERE makeup_lesson_id = $1 AND student_id = $2`,
        [lessonId, studentId]
      ) as Array<{ lesson_id: number }>;
      const makeupDate = new Date(makeupLesson.lesson_date);
      const makeupDateStr = `${String(makeupDate.getUTCDate()).padStart(2,'0')}.${String(makeupDate.getUTCMonth()+1).padStart(2,'0')}.${makeupDate.getUTCFullYear()}`;
      const studentLabel = studentName?.full_name || `Учень #${studentId}`;

      if (dbStatus === 'present') {
        await query(
          `UPDATE attendance SET status = 'makeup_done', updated_by = $1, updated_at = NOW()
           WHERE makeup_lesson_id = $2 AND student_id = $3`,
          [teacher.id, lessonId, studentId]
        );
        for (const rec of (origRecords || [])) {
          await logLessonChange(
            rec.lesson_id, 'attendance', null,
            `${studentLabel}: відпрацював пропуск (відпрацювання від ${makeupDateStr})`,
            teacher.id, teacher.name, 'telegram', telegramId
          );
        }
      } else if (dbStatus === 'absent') {
        await query(
          `UPDATE attendance SET status = 'makeup_planned', updated_by = $1, updated_at = NOW()
           WHERE makeup_lesson_id = $2 AND student_id = $3 AND status = 'makeup_done'`,
          [teacher.id, lessonId, studentId]
        );
        for (const rec of (origRecords || [])) {
          await logLessonChange(
            rec.lesson_id, 'attendance', null,
            `${studentLabel}: відпрацювання скасовано`,
            teacher.id, teacher.name, 'telegram', telegramId
          );
        }
      }
    }

    // Log attendance change from Telegram
    await logLessonChange(
      lessonId,
      'attendance',
      null,
      `${studentName?.full_name || `Учень #${studentId}`}: ${dbStatus === 'present' ? 'присутній' : 'відсутній'}`,
      teacher.id,
      teacher.name,
      'telegram',
      telegramId
    );

    // Auto-cancel if all students absent; otherwise mark as done when all recorded
    const cancelled = await checkAndAutoCancelLesson(lessonId, teacher.id, teacher.name, 'telegram', telegramId);

    if (!cancelled) {
      const counts = await queryOne(
        `SELECT
          CASE
            WHEN (SELECT group_id FROM lessons WHERE id = $1) IS NULL
            THEN (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1)
            ELSE (SELECT COUNT(*) FROM student_groups WHERE group_id = (SELECT group_id FROM lessons WHERE id = $1) AND is_active = TRUE)
          END as total,
          (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1 AND status IS NOT NULL) as recorded`,
        [lessonId]
      ) as { total: number; recorded: number } | null;

      if (counts && counts.total > 0 && counts.recorded >= counts.total) {
        await query(
          `UPDATE lessons
           SET status = 'done',
               reported_by = $1,
               reported_at = NOW(),
               reported_via = 'telegram',
               updated_at = NOW()
           WHERE id = $2
           AND status = 'scheduled'`,
          [teacher.id, lessonId]
        );
        await safeCreateLessonDoneNotification(lessonId, teacher.name);

        // Deduct from individual balance for individual lessons
        const lessonForBalance = await queryOne(
          `SELECT group_id FROM lessons WHERE id = $1`,
          [lessonId]
        ) as { group_id: number | null } | null;
        if (lessonForBalance && lessonForBalance.group_id === null) {
          const presentRows = await query(
            `SELECT student_id FROM attendance WHERE lesson_id = $1 AND status = 'present'`,
            [lessonId]
          );
          for (const ps of presentRows.rows) {
            await useIndividualLesson(ps.student_id);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      studentId,
      status: attendanceStatus,
      dbStatus
    });

  } catch (error) {
    console.error('Attendance update error:', error);
    return NextResponse.json(
      { error: 'Не вдалося оновити відвідуваність' },
      { status: 500 }
    );
  }
}
