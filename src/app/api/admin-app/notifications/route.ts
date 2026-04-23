import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/db/neon';
import crypto from 'crypto';
import {
  getNotificationsForUser,
  markNotificationsAsRead,
  clearNotificationsForUser,
  getUnreadCountForUser,
  checkStaleLessonsAndNotify,
} from '@/lib/notifications';

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

async function getAdmin(telegramId: string) {
  return queryOne(
    `SELECT id, name FROM users WHERE telegram_id = $1 AND role = 'admin' AND is_active = TRUE LIMIT 1`,
    [telegramId]
  ) as Promise<{ id: number; name: string } | null>;
}

// GET /api/admin-app/notifications — list notifications for this admin
export async function GET(request: NextRequest) {
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const v = verifyInitData(initData);
  if (!v.valid || !v.telegramId) return NextResponse.json({ error: 'Невірний initData' }, { status: 401 });

  const admin = await getAdmin(v.telegramId);
  if (!admin) return NextResponse.json({ error: 'Адміна не знайдено' }, { status: 404 });

  // Lightweight mode: only return unread count (for navbar badge polling)
  const countOnly = request.nextUrl.searchParams.get('count') === 'true';
  await checkStaleLessonsAndNotify();
  const unreadCount = await getUnreadCountForUser(admin.id);

  if (countOnly) {
    return NextResponse.json({ unreadCount });
  }

  const notifications = await getNotificationsForUser(admin.id, 50);
  return NextResponse.json({ notifications, unreadCount });
}

// POST /api/admin-app/notifications — mark as read (body: { ids?: number[] })
export async function POST(request: NextRequest) {
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const v = verifyInitData(initData);
  if (!v.valid || !v.telegramId) return NextResponse.json({ error: 'Невірний initData' }, { status: 401 });

  const admin = await getAdmin(v.telegramId);
  if (!admin) return NextResponse.json({ error: 'Адміна не знайдено' }, { status: 404 });

  try {
    const body = await request.json().catch(() => ({}));
    await markNotificationsAsRead(admin.id, body.ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    return NextResponse.json({ error: 'Помилка' }, { status: 500 });
  }
}

// DELETE /api/admin-app/notifications — clear all
export async function DELETE(request: NextRequest) {
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const v = verifyInitData(initData);
  if (!v.valid || !v.telegramId) return NextResponse.json({ error: 'Невірний initData' }, { status: 401 });

  const admin = await getAdmin(v.telegramId);
  if (!admin) return NextResponse.json({ error: 'Адміна не знайдено' }, { status: 404 });

  try {
    await clearNotificationsForUser(admin.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Clear notifications error:', error);
    return NextResponse.json({ error: 'Помилка' }, { status: 500 });
  }
}
