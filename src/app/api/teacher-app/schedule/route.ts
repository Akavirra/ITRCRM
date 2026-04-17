import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/db/neon';
import crypto from 'crypto';
import { toZonedTime } from 'date-fns-tz';
import { format, addDays } from 'date-fns';

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

// Get start and end of current week in Kyiv timezone
function getWeekBounds(): { start: string; end: string } {
  const KYIV_TZ = 'Europe/Kyiv';
  const nowInKyiv = toZonedTime(new Date(), KYIV_TZ);
  const day = nowInKyiv.getDay();
  const daysFromMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(nowInKyiv, daysFromMonday);
  const sunday = addDays(monday, 6);
  return {
    start: format(monday, 'yyyy-MM-dd'),
    end: format(sunday, 'yyyy-MM-dd'),
  };
}

// GET /api/teacher-app/schedule
export async function GET(request: NextRequest) {
  try {
    // Get initData from header
    const initData = request.headers.get('X-Telegram-Init-Data');
    
    if (!initData) {
      return NextResponse.json(
        { error: 'Заголовок X-Telegram-Init-Data обов\'язковий' },
        { status: 401 }
      );
    }

    // Verify initData
    const verification = verifyInitData(initData);
    
    if (!verification.valid || !verification.telegramId) {
      return NextResponse.json(
        { error: 'Невірний initData' },
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
        { error: 'Викладача не знайдено' },
        { status: 401 }
      );
    }

    // Get week bounds in Kyiv timezone
    const { start: startStr, end: endStr } = getWeekBounds();

    // Get lessons for teacher (direct assignments + replacements + individual lessons)
    const lessons = await query(
      `SELECT DISTINCT
        l.id, l.public_id, l.group_id, l.course_id,
        TO_CHAR(l.lesson_date, 'YYYY-MM-DD') as lesson_date,
        l.start_datetime, l.end_datetime,
        l.status, l.topic, l.notes, l.reported_by, l.reported_at, l.reported_via,
        COALESCE(l.is_makeup, FALSE) as is_makeup,
        COALESCE(l.is_trial, FALSE) as is_trial,
        g.title as group_title, c.title as course_title,
        ltr.replacement_teacher_id,
        ru.name as replacement_teacher_name,
        CASE
          WHEN l.group_id IS NOT NULL THEN
            (
              (SELECT COUNT(*)::int FROM student_groups sg WHERE sg.group_id = l.group_id AND sg.is_active = TRUE)
              +
              (SELECT COUNT(*)::int FROM attendance a
               WHERE a.lesson_id = l.id AND COALESCE(a.is_trial, FALSE) = TRUE
                 AND a.student_id NOT IN (
                   SELECT student_id FROM student_groups
                   WHERE group_id = l.group_id AND is_active = TRUE
                 ))
            )
          ELSE
            (SELECT COUNT(*)::int FROM attendance a WHERE a.lesson_id = l.id)
        END as student_count
      FROM lessons l
      LEFT JOIN groups g ON l.group_id = g.id
      LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
      LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
      LEFT JOIN users ru ON ltr.replacement_teacher_id = ru.id
      WHERE (
        -- Direct teacher assignment via group
        g.teacher_id = $1
        -- Or replacement teacher
        OR ltr.replacement_teacher_id = $1
        -- Or individual lesson (no group) where teacher is directly assigned
        OR (l.group_id IS NULL AND l.teacher_id = $1)
      )
      AND l.lesson_date BETWEEN $2 AND $3
      ORDER BY lesson_date, l.start_datetime`,
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
      { error: 'Не вдалося завантажити розклад' },
      { status: 500 }
    );
  }
}
