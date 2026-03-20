import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/db/neon';
import crypto from 'crypto';
import { toZonedTime } from 'date-fns-tz';
import { format, addDays } from 'date-fns';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function verifyInitData(initData: string): { valid: boolean; telegramId?: string } {
  if (!TELEGRAM_BOT_TOKEN) return { valid: false };
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };
    params.delete('hash');
    const paramsArray = Array.from(params.entries());
    paramsArray.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = paramsArray.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (calculatedHash !== hash) return { valid: false };
    const userJson = params.get('user');
    if (!userJson) return { valid: false };
    const user = JSON.parse(userJson);
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    if (Math.floor(Date.now() / 1000) - authDate > 86400) return { valid: false };
    return { valid: true, telegramId: user.id.toString() };
  } catch {
    return { valid: false };
  }
}

function getWeekBounds(): { start: string; end: string } {
  const nowInKyiv = toZonedTime(new Date(), 'Europe/Kyiv');
  const day = nowInKyiv.getDay();
  const daysFromMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(nowInKyiv, daysFromMonday);
  const sunday = addDays(monday, 6);
  return {
    start: format(monday, 'yyyy-MM-dd'),
    end: format(sunday, 'yyyy-MM-dd'),
  };
}

function getTodayKyiv(): string {
  return format(toZonedTime(new Date(), 'Europe/Kyiv'), 'yyyy-MM-dd');
}

// GET /api/admin-app/schedule?view=today|week (default: week)
export async function GET(request: NextRequest) {
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const v = verifyInitData(initData);
  if (!v.valid || !v.telegramId) return NextResponse.json({ error: 'Невірний initData' }, { status: 401 });

  const admin = await queryOne(
    `SELECT id, name FROM users WHERE telegram_id = $1 AND role = 'admin' AND is_active = TRUE LIMIT 1`,
    [v.telegramId]
  ) as { id: number; name: string } | null;
  if (!admin) return NextResponse.json({ error: 'Адміна не знайдено' }, { status: 404 });

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') === 'today' ? 'today' : 'week';

    const { start: weekStart, end: weekEnd } = getWeekBounds();
    const today = getTodayKyiv();
    const startDate = view === 'today' ? today : weekStart;
    const endDate = view === 'today' ? today : weekEnd;

    const lessons = await query(
      `SELECT
        l.id, l.public_id, l.group_id, l.course_id, l.lesson_date,
        l.start_datetime, l.end_datetime, l.status, l.topic, l.notes,
        COALESCE(l.is_makeup, FALSE) as is_makeup,
        g.title as group_title,
        c.title as course_title,
        u.name as teacher_name,
        COALESCE(
          (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = TRUE),
          (SELECT COUNT(*) FROM attendance a WHERE a.lesson_id = l.id)
        ) as student_count
       FROM lessons l
       LEFT JOIN groups g ON l.group_id = g.id
       LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
       LEFT JOIN users u ON COALESCE(l.teacher_id, g.teacher_id) = u.id
       WHERE l.lesson_date BETWEEN $1 AND $2
         AND l.status != 'canceled'
       ORDER BY l.lesson_date, l.start_datetime`,
      [startDate, endDate]
    );

    return NextResponse.json({
      lessons: lessons || [],
      today,
      weekStart,
      weekEnd,
      view,
    });
  } catch (error) {
    console.error('Admin schedule error:', error);
    return NextResponse.json({ error: 'Не вдалося завантажити розклад' }, { status: 500 });
  }
}
