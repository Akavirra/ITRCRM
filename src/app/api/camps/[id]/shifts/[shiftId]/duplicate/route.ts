import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest, notFound } from '@/lib/api-utils';
import { duplicateShift } from '@/lib/camp-shifts';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string; shiftId: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const shiftId = parseInt(params.shiftId, 10);
  if (isNaN(shiftId)) return badRequest('Невірний ID');

  try {
    const body = await request.json().catch(() => ({}));
    let offsetDays: number | undefined;
    if (body.offset_days !== undefined) {
      const n = parseInt(String(body.offset_days), 10);
      if (!isNaN(n)) offsetDays = n;
    }

    const shift = await duplicateShift(shiftId, {
      offsetDays,
      newTitle: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined,
    });
    if (!shift) return notFound('Зміну не знайдено');
    return NextResponse.json({ shift }, { status: 201 });
  } catch (error) {
    console.error('Duplicate shift error:', error);
    return NextResponse.json({ error: 'Не вдалося дублювати' }, { status: 500 });
  }
}
