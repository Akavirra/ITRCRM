import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, notFound } from '@/lib/api-utils';
import { get, run } from '@/db';

export const dynamic = 'force-dynamic';

// DELETE /api/users/[id] — owner only, cannot delete self or another owner
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) return unauthorized();

  const fullCurrentUser = await get<{ id: number; is_owner: boolean }>(
    `SELECT id, is_owner FROM users WHERE id = $1`,
    [currentUser.id]
  );

  if (!fullCurrentUser?.is_owner) return forbidden();

  const targetId = parseInt(params.id);
  if (isNaN(targetId)) return NextResponse.json({ error: 'Невірний ID' }, { status: 400 });

  if (targetId === currentUser.id) {
    return NextResponse.json({ error: 'Не можна видалити власний акаунт' }, { status: 400 });
  }

  const target = await get<{ id: number; is_owner: boolean }>(
    `SELECT id, is_owner FROM users WHERE id = $1`,
    [targetId]
  );

  if (!target) return notFound('Користувача не знайдено');
  if (target.is_owner) {
    return NextResponse.json({ error: 'Не можна видалити owner-акаунт' }, { status: 400 });
  }

  await run(`DELETE FROM users WHERE id = $1`, [targetId]);

  return NextResponse.json({ message: 'Користувача видалено' });
}
