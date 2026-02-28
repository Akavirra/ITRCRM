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

// Get start and end of current week
function getWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const start = new Date(date);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

// GET /api/teacher-app/schedule
export async function GET(request: NextRequest) {
  try {
    // Get initData from header
    const initData = request.headers.get('X-Telegram-Init-Data');
    
    if (!initData) {
      return NextResponse.json(
        { error: 'X-Telegram-Init-Data header is required' },
        { status: 401 }
      );
    }

    // Verify initData
    const verification = verifyInitData(initData);
    
    if (!verification.valid || !verification.telegramId) {
      return NextResponse.json(
        { error: 'Invalid initData' },
        { status: 401 }
      );
    }

    const telegramId = verification.telegramId;

    // Find teacher by telegram_id
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

    // Get week bounds
    const { start, end } = getWeekBounds();
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    // Get lessons for teacher (direct assignments + replacements)
    const lessons = await query(
      `SELECT DISTINCT 
        l.id, l.public_id, l.group_id, l.lesson_date, l.start_datetime, l.end_datetime, 
        l.status, l.topic, l.notes, l.reported_by, l.reported_at, l.reported_via,
        g.title as group_title, c.title as course_title,
        ltr.replacement_teacher_id,
        ru.name as replacement_teacher_name,
        (SELECT COUNT(*) FROM student_groups sg 
         WHERE sg.group_id = g.id AND sg.is_active = TRUE) as student_count
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
      LEFT JOIN users ru ON ltr.replacement_teacher_id = ru.id
      WHERE (
        -- Direct teacher assignment
        g.teacher_id = $1
        -- Or replacement teacher
        OR ltr.replacement_teacher_id = $1
      )
      AND l.lesson_date BETWEEN $2 AND $3
      ORDER BY l.lesson_date, l.start_datetime`,
      [teacher.id, startStr, endStr]
    );

    return NextResponse.json({
      teacher: {
        id: teacher.id,
        name: teacher.name
      },
      weekStart: startStr,
      weekEnd: endStr,
      lessons: lessons || []
    });

  } catch (error) {
    console.error('Schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}
