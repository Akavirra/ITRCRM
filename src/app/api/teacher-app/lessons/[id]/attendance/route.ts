import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/db/neon';
import crypto from 'crypto';
import { logLessonChange } from '@/lib/lessons';

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
        { error: 'X-Telegram-Init-Data header is required' },
        { status: 401 }
      );
    }

    const verification = verifyInitData(initData);
    
    if (!verification.valid || !verification.telegramId) {
      return NextResponse.json(
        { error: 'Invalid initData' },
        { status: 401 }
      );
    }

    const telegramId = verification.telegramId;
    const lessonId = parseInt(params.id, 10);

    if (isNaN(lessonId)) {
      return NextResponse.json(
        { error: 'Invalid lesson ID' },
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
        { error: 'Teacher not found' },
        { status: 401 }
      );
    }

    // Verify teacher has access to this lesson
    const lessonAccess = await queryOne(
      `SELECT l.id, l.group_id, l.status, l.lesson_date
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
      WHERE l.id = $1
      AND (
        g.teacher_id = $2
        OR ltr.replacement_teacher_id = $2
      )`,
      [lessonId, teacher.id]
    );

    if (!lessonAccess) {
      return NextResponse.json(
        { error: 'Lesson not found or access denied' },
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
        { error: 'studentId and status are required' },
        { status: 400 }
      );
    }

    // Validate status - map 'sick' to 'absent' for database compatibility
    // Database allows: 'present', 'absent', 'makeup_planned', 'makeup_done'
    // UI sends: 'present', 'absent', 'sick'
    const dbStatus = attendanceStatus === 'sick' ? 'absent' : attendanceStatus;
    
    if (!['present', 'absent'].includes(dbStatus)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be present, absent, or sick' },
        { status: 400 }
      );
    }

    // Verify student belongs to this group
    const studentCheck = await queryOne(
      `SELECT sg.id 
      FROM student_groups sg
      JOIN students s ON sg.student_id = s.id
      WHERE sg.group_id = $1 
      AND sg.student_id = $2
      AND sg.is_active = TRUE
      AND s.is_active = TRUE`,
      [lessonAccess.group_id, studentId]
    );

    if (!studentCheck) {
      return NextResponse.json(
        { error: 'Student not found in this group' },
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
    
    // Log attendance change from Telegram
    await logLessonChange(
      lessonId,
      'attendance',
      null,
      `Відвідуваність відмічено (Telegram): ${dbStatus}`,
      -teacher.id,
      teacher.name,
      'telegram',
      telegramId
    );

    // Automatically mark lesson as conducted if it has attendance records
    // and update reported fields (both new and old schema for compatibility)
    await query(
      `UPDATE lessons 
       SET status = 'done',
           reported_by = $1,
           reported_at = NOW(),
           reported_via = 'telegram',
           topic_set_by = $1,
           topic_set_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       AND status = 'scheduled'`,
      [teacher.id, lessonId]
    );

    return NextResponse.json({
      success: true,
      studentId,
      status: attendanceStatus,
      dbStatus
    });

  } catch (error) {
    console.error('Attendance update error:', error);
    return NextResponse.json(
      { error: 'Failed to update attendance' },
      { status: 500 }
    );
  }
}
