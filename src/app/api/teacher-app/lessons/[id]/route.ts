import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/db/neon';
import crypto from 'crypto';

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

// GET /api/teacher-app/lessons/[id] - Get lesson details with students and attendance
export async function GET(
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

    // Get lesson details
    const lesson = await queryOne(
      `SELECT 
        l.id, l.public_id, l.group_id, l.lesson_date, l.start_datetime, l.end_datetime,
        l.status, l.topic, l.notes, l.reported_by, l.reported_at, l.reported_via,
        g.title as group_title, c.title as course_title,
        ltr.replacement_teacher_id,
        ru.name as replacement_teacher_name,
        reporter.name as reported_by_name
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
      LEFT JOIN users ru ON ltr.replacement_teacher_id = ru.id
      LEFT JOIN users reporter ON l.reported_by = reporter.id
      WHERE l.id = $1
      AND (
        g.teacher_id = $2
        OR ltr.replacement_teacher_id = $2
      )`,
      [lessonId, teacher.id]
    );

    if (!lesson) {
      return NextResponse.json(
        { error: 'Lesson not found or access denied' },
        { status: 404 }
      );
    }

    // Get students with attendance
    const students = await query(
      `SELECT 
        s.id, s.full_name, s.public_id as student_public_id,
        a.status as attendance_status, a.updated_at as attendance_updated
      FROM student_groups sg
      JOIN students s ON sg.student_id = s.id
      LEFT JOIN attendance a ON a.student_id = s.id AND a.lesson_id = $1
      WHERE sg.group_id = $2
      AND sg.is_active = TRUE
      AND s.is_active = TRUE
      ORDER BY s.full_name`,
      [lessonId, lesson.group_id]
    );

    return NextResponse.json({
      lesson,
      students: students || []
    });

  } catch (error) {
    console.error('Lesson details error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lesson details' },
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
      `SELECT l.id, l.group_id, l.status
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

    const body = await request.json();
    const { topic, notes, status } = body;

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
      updates.push(`status = ${paramIndex}`);
      values.push('done');
      paramIndex++;
      
      // New schema columns
      updates.push(`reported_by = ${paramIndex}`);
      values.push(teacher.id);
      paramIndex++;
      
      updates.push(`reported_at = NOW()`);
      
      updates.push(`reported_via = ${paramIndex}`);
      values.push('telegram');
      paramIndex++;
      
      // Old schema columns for backwards compatibility
      if (topic !== undefined) {
        updates.push(`topic_set_by = ${paramIndex}`);
        values.push(teacher.id);
        paramIndex++;
        
        updates.push(`topic_set_at = NOW()`);
      }
      
      if (notes !== undefined) {
        updates.push(`notes_set_by = ${paramIndex}`);
        values.push(teacher.id);
        paramIndex++;
        
        updates.push(`notes_set_at = NOW()`);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
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

    return NextResponse.json({
      success: true,
      lesson: result
    });

  } catch (error) {
    console.error('Lesson update error:', error);
    return NextResponse.json(
      { error: 'Failed to update lesson' },
      { status: 500 }
    );
  }
}
