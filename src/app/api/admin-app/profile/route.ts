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
    `SELECT id, name, email, phone, photo_url FROM users WHERE telegram_id = $1 AND role = 'admin' AND is_active = TRUE LIMIT 1`,
    [telegramId]
  ) as Promise<{ id: number; name: string; email: string; phone: string | null; photo_url: string | null } | null>;
}

// GET /api/admin-app/profile
export async function GET(request: NextRequest) {
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const v = verifyInitData(initData);
  if (!v.valid || !v.telegramId) return NextResponse.json({ error: 'Невірний initData' }, { status: 401 });

  const admin = await getAdmin(v.telegramId);
  if (!admin) return NextResponse.json({ error: 'Адміна не знайдено' }, { status: 404 });

  return NextResponse.json({ admin });
}

// PATCH /api/admin-app/profile — update name, phone, photo
export async function PATCH(request: NextRequest) {
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const v = verifyInitData(initData);
  if (!v.valid || !v.telegramId) return NextResponse.json({ error: 'Невірний initData' }, { status: 401 });

  const admin = await getAdmin(v.telegramId);
  if (!admin) return NextResponse.json({ error: 'Адміна не знайдено' }, { status: 404 });

  try {
    const { name, phone, photo } = await request.json();

    let photoUrl: string | undefined;

    if (photo) {
      if (admin.photo_url) {
        const oldPublicId = getPublicIdFromUrl(admin.photo_url);
        if (oldPublicId) await deleteImage(oldPublicId).catch(() => {});
      }
      const uploadResult = await uploadImage(photo, 'admins');
      photoUrl = uploadResult.url;
    }

    const fields: string[] = [];
    const values: (string | null | number)[] = [];
    let idx = 1;

    if (name?.trim()) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone || null); }
    if (photoUrl) { fields.push(`photo_url = $${idx++}`); values.push(photoUrl); }

    if (fields.length === 0) return NextResponse.json({ error: 'Нічого для оновлення' }, { status: 400 });

    fields.push(`updated_at = NOW()`);
    values.push(admin.id);

    await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );

    const updated = await getAdmin(v.telegramId);
    return NextResponse.json({ admin: updated });
  } catch (error) {
    console.error('Admin profile update error:', error);
    return NextResponse.json({ error: 'Помилка оновлення профілю' }, { status: 500 });
  }
}
