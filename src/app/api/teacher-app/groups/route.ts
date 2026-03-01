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

// Ukrainian day names
const DAY_NAMES: Record<number, string> = {
  1: 'Понеділок',
  2: 'Вівторок',
  3: 'Середа',
  4: 'Четвер',
  5: "П'ятниця",
  6: 'Субота',
  7: 'Неділя',
};

const DAY_SHORT_NAMES: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Нд',
};

// GET /api/teacher-app/groups
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
      `SELECT id, name, telegram_id, role, phone, email, created_at 
       FROM users WHERE telegram_id = $1 AND is_active = TRUE LIMIT 1`,
      [telegramId]
    );

    if (!teacher) {
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 401 }
      );
    }

    // Get groups for this teacher with details
    const groups = await query(
      `SELECT 
        g.id,
        g.public_id,
        g.title as group_title,
        g.weekly_day,
        g.start_time,
        g.duration_minutes,
        g.status,
        g.start_date,
        g.end_date,
        g.note,
        c.id as course_id,
        c.title as course_title,
        c.description as course_description,
        (SELECT COUNT(*) FROM student_groups sg 
         WHERE sg.group_id = g.id AND sg.is_active = TRUE) as student_count
       FROM groups g
       JOIN courses c ON g.course_id = c.id
       WHERE g.teacher_id = $1
         AND g.is_deleted = FALSE
       ORDER BY g.weekly_day, g.start_time`,
      [teacher.id]
    );

    // Get students for each group
    const groupsWithStudents = await Promise.all(
      (groups || []).map(async (group) => {
        const students = await query(
          `SELECT 
            s.id,
            s.name,
            s.surname,
            s.phone,
            s.telegram_username,
            sg.join_date,
            sg.is_active
           FROM students s
           JOIN student_groups sg ON s.id = sg.student_id
           WHERE sg.group_id = $1 AND sg.is_active = TRUE
           ORDER BY s.surname, s.name`,
          [group.id]
        );

        return {
          ...group,
          day_name: DAY_NAMES[group.weekly_day] || 'Невідомо',
          day_short: DAY_SHORT_NAMES[group.weekly_day] || '?',
          students: students || [],
        };
      })
    );

    // Get teacher stats
    const stats = await queryOne(
      `SELECT 
        COUNT(DISTINCT g.id) as total_groups,
        COUNT(DISTINCT sg.student_id) as total_students,
        COUNT(DISTINCT l.id) as total_lessons
       FROM groups g
       LEFT JOIN student_groups sg ON g.id = sg.group_id AND sg.is_active = TRUE
       LEFT JOIN lessons l ON g.id = l.group_id
       WHERE g.teacher_id = $1 AND g.is_deleted = FALSE`,
      [teacher.id]
    );

    return NextResponse.json({
      teacher: {
        id: teacher.id,
        name: teacher.name,
        telegram_id: teacher.telegram_id,
        role: teacher.role,
        phone: teacher.phone || null,
        email: teacher.email || null,
        created_at: teacher.created_at,
      },
      groups: groupsWithStudents,
      stats: {
        total_groups: stats?.total_groups || 0,
        total_students: stats?.total_students || 0,
        total_lessons: stats?.total_lessons || 0,
      }
    });

  } catch (error) {
    console.error('Teacher groups error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
}
