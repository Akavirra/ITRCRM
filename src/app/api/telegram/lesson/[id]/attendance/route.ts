import { NextRequest, NextResponse } from 'next/server';
import { get, all, run } from '@/db';
import crypto from 'crypto';
import { checkAndAutoCancelLesson } from '@/lib/lessons';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function verifyTelegramUser(initData: string): Promise<{ id: number; name: string } | null> {
  if (!initData || !TELEGRAM_BOT_TOKEN) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    const paramsArray = Array.from(params.entries());
    paramsArray.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = paramsArray.map(([key, value]) => `${key}=${value}`).join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) return null;

    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null;

    const userJson = params.get('user');
    if (!userJson) return null;

    const telegramUser = JSON.parse(userJson);
    if (!telegramUser?.id) return null;

    const dbUser = await get<{ id: number; name: string }>(
      `SELECT id, name FROM users WHERE telegram_id = $1`,
      [telegramUser.id.toString()]
    );

    return dbUser || null;
  } catch {
    return null;
  }
}

// GET /api/telegram/lesson/[id]/attendance - Get attendance for lesson
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const initData = request.nextUrl.searchParams.get('initData') || '';
  const telegramUser = await verifyTelegramUser(initData);
  if (!telegramUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lessonId = parseInt(params.id, 10);
  if (isNaN(lessonId)) {
    return NextResponse.json({ error: 'Невірний ID заняття' }, { status: 400 });
  }

  const attendance = await all<{
    student_id: number;
    student_name: string;
    student_phone: string | null;
    status: 'present' | 'absent' | null;
  }>(
    `SELECT
      s.id as student_id,
      s.full_name as student_name,
      s.phone as student_phone,
      a.status
    FROM student_groups sg
    JOIN students s ON sg.student_id = s.id
    LEFT JOIN attendance a ON a.lesson_id = $1 AND a.student_id = s.id
    WHERE sg.group_id = (
      SELECT group_id FROM lessons WHERE id = $1
    ) AND sg.is_active = TRUE
    ORDER BY s.full_name`,
    [lessonId]
  );

  return NextResponse.json({ attendance });
}

// POST /api/telegram/lesson/[id]/attendance - Set attendance
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const initData = request.headers.get('x-telegram-init-data') || '';
  const telegramUser = await verifyTelegramUser(initData);
  if (!telegramUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lessonId = parseInt(params.id, 10);
  if (isNaN(lessonId)) {
    return NextResponse.json({ error: 'Невірний ID заняття' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action, studentId, status } = body;

    if (action === 'set' && studentId && status) {
      await run(
        `INSERT INTO attendance (lesson_id, student_id, status, updated_at, updated_by)
         VALUES ($1, $2, $3, NOW(), $4)
         ON CONFLICT (lesson_id, student_id) DO UPDATE SET status = $3, updated_at = NOW(), updated_by = $4`,
        [lessonId, studentId, status, telegramUser.id]
      );

      await checkAndAutoCancelLesson(lessonId, telegramUser.id, telegramUser.name, 'telegram');

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Невірна дія' }, { status: 400 });
  } catch (error) {
    console.error('[Telegram Attendance] Error setting attendance:', error);
    return NextResponse.json({ error: 'Не вдалося оновити відвідуваність' }, { status: 500 });
  }
}
