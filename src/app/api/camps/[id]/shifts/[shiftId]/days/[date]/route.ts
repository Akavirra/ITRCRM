import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest, notFound } from '@/lib/api-utils';
import { toggleShiftDay, setShiftDayWorking } from '@/lib/camp-shifts';

export const dynamic = 'force-dynamic';

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string; shiftId: string; date: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const shiftId = parseInt(params.shiftId, 10);
  if (isNaN(shiftId)) return badRequest('Невірний ID');
  if (!isValidDate(params.date)) return badRequest('Невірна дата');

  try {
    const body = await request.json().catch(() => ({}));

    let day;
    if (typeof body.is_working === 'boolean') {
      day = await setShiftDayWorking(shiftId, params.date, body.is_working);
    } else {
      day = await toggleShiftDay(shiftId, params.date);
    }

    if (!day) return notFound('День не знайдено');
    return NextResponse.json({ day });
  } catch (error) {
    console.error('Toggle day error:', error);
    return NextResponse.json({ error: 'Не вдалося оновити' }, { status: 500 });
  }
}
