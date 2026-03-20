import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/neon';
import crypto from 'crypto';

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

// GET /api/tg-app/auth — detect roles for a telegram user
// Returns { roles: ['admin'|'teacher'], adminUser, teacherUser }
export async function GET(request: NextRequest) {
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const verification = verifyInitData(initData);
  if (!verification.valid || !verification.telegramId) {
    return NextResponse.json({ error: 'Невірний initData' }, { status: 401 });
  }

  const telegramId = verification.telegramId;

  // Find all active users with this telegram_id
  const users = await query(
    `SELECT id, name, email, role, photo_url, phone FROM users WHERE telegram_id = $1 AND is_active = TRUE`,
    [telegramId]
  );

  if (!users || users.length === 0) {
    return NextResponse.json({ error: 'Користувача не знайдено' }, { status: 404 });
  }

  const roles: string[] = [];
  let adminUser = null;
  let teacherUser = null;

  for (const u of users as Array<Record<string, unknown>>) {
    if (u.role === 'admin') {
      roles.push('admin');
      adminUser = { id: u.id, name: u.name, email: u.email, photo_url: u.photo_url || null, phone: u.phone || null };
    }
    if (u.role === 'teacher') {
      roles.push('teacher');
      teacherUser = { id: u.id, name: u.name, email: u.email, photo_url: u.photo_url || null, phone: u.phone || null };
    }
  }

  return NextResponse.json({ roles, adminUser, teacherUser, telegramId });
}
