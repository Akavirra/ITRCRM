import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { get, run } from '@/db';
import { uploadImage, deleteImage, getPublicIdFromUrl } from '@/lib/cloudinary';
import { clearServerCache } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

// DELETE /api/auth/profile — remove own photo
export async function DELETE(request: NextRequest) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) return unauthorized();

  const existing = await get<{ photo_url: string | null }>(
    `SELECT photo_url FROM users WHERE id = $1`,
    [currentUser.id]
  );
  if (existing?.photo_url) {
    const publicId = getPublicIdFromUrl(existing.photo_url);
    if (publicId) await deleteImage(publicId).catch(() => {});
  }
  await run(`UPDATE users SET photo_url = NULL, updated_at = NOW() WHERE id = $1`, [currentUser.id]);
  return NextResponse.json({ ok: true });
}

// PATCH /api/auth/profile — update own name, phone, photo
export async function PATCH(request: NextRequest) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) return unauthorized();

  try {
    const body = await request.json();
    const { name, phone, photo, telegram_id } = body;

    let photoUrl: string | undefined;

    if (photo) {
      // Delete old photo if exists
      const existing = await get<{ photo_url: string | null }>(
        `SELECT photo_url FROM users WHERE id = $1`,
        [currentUser.id]
      );
      if (existing?.photo_url) {
        const oldPublicId = getPublicIdFromUrl(existing.photo_url);
        if (oldPublicId) await deleteImage(oldPublicId).catch(() => {});
      }

      const uploadResult = await uploadImage(photo, 'admins');
      photoUrl = uploadResult.url;
    }

    const fields: string[] = [];
    const values: (string | null)[] = [];
    let idx = 1;

    if (name?.trim()) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone || null); }
    if (photoUrl) { fields.push(`photo_url = $${idx++}`); values.push(photoUrl); }
    if (telegram_id !== undefined) { fields.push(`telegram_id = $${idx++}`); values.push(telegram_id?.trim() || null); }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'Нічого для оновлення' }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(currentUser.id as unknown as string);

    await run(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );

    clearServerCache(`settings:${currentUser.id}`);

    const updated = await get<{ name: string; phone: string | null; photo_url: string | null; telegram_id: string | null }>(
      `SELECT name, phone, photo_url, telegram_id FROM users WHERE id = $1`,
      [currentUser.id]
    );

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Помилка оновлення профілю' }, { status: 500 });
  }
}
