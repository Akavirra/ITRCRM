import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/db/neon';
import crypto from 'crypto';
import { uploadImage, deleteImage, getPublicIdFromUrl } from '@/lib/cloudinary';

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
    `SELECT id, photo_url FROM users WHERE telegram_id = $1 AND role = 'admin' AND is_active = TRUE LIMIT 1`,
    [telegramId]
  ) as Promise<{ id: number; photo_url: string | null } | null>;
}

// POST — upload or replace photo
export async function POST(request: NextRequest) {
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const v = verifyInitData(initData);
  if (!v.valid || !v.telegramId) return NextResponse.json({ error: 'Невірний initData' }, { status: 401 });

  const admin = await getAdmin(v.telegramId);
  if (!admin) return NextResponse.json({ error: 'Адміна не знайдено' }, { status: 404 });

  try {
    const { photo } = await request.json();
    if (!photo) return NextResponse.json({ error: 'Зображення обов\'язкове' }, { status: 400 });

    if (admin.photo_url) {
      const oldPublicId = getPublicIdFromUrl(admin.photo_url);
      if (oldPublicId) await deleteImage(oldPublicId).catch(() => {});
    }

    const uploadResult = await uploadImage(photo, 'admins');

    await query(
      `UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2`,
      [uploadResult.url, admin.id]
    );

    return NextResponse.json({ photo_url: uploadResult.url });
  } catch (error) {
    console.error('Admin photo upload error:', error);
    return NextResponse.json({ error: 'Помилка завантаження фото' }, { status: 500 });
  }
}

// DELETE — remove photo
export async function DELETE(request: NextRequest) {
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const v = verifyInitData(initData);
  if (!v.valid || !v.telegramId) return NextResponse.json({ error: 'Невірний initData' }, { status: 401 });

  const admin = await getAdmin(v.telegramId);
  if (!admin) return NextResponse.json({ error: 'Адміна не знайдено' }, { status: 404 });

  try {
    if (admin.photo_url) {
      const publicId = getPublicIdFromUrl(admin.photo_url);
      if (publicId) await deleteImage(publicId).catch(() => {});
    }

    await query(
      `UPDATE users SET photo_url = NULL, updated_at = NOW() WHERE id = $1`,
      [admin.id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Admin photo delete error:', error);
    return NextResponse.json({ error: 'Помилка видалення фото' }, { status: 500 });
  }
}
