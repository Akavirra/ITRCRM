import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest, notFound } from '@/lib/api-utils';
import { getShiftById, updateShift, deleteShift } from '@/lib/camp-shifts';

export const dynamic = 'force-dynamic';

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(request: NextRequest, { params }: { params: { id: string; shiftId: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const shiftId = parseInt(params.shiftId, 10);
  if (isNaN(shiftId)) return badRequest('Невірний ID');

  const shift = await getShiftById(shiftId);
  if (!shift) return notFound('Зміну не знайдено');

  return NextResponse.json({ shift });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string; shiftId: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const shiftId = parseInt(params.shiftId, 10);
  if (isNaN(shiftId)) return badRequest('Невірний ID');

  try {
    const body = await request.json();
    const patch: Parameters<typeof updateShift>[1] = {};

    if (body.title !== undefined) patch.title = String(body.title).trim();
    if (body.start_date !== undefined) {
      if (!isValidDate(body.start_date)) return badRequest('Невірна дата');
      patch.start_date = body.start_date;
    }
    if (body.end_date !== undefined) {
      if (!isValidDate(body.end_date)) return badRequest('Невірна дата');
      patch.end_date = body.end_date;
    }
    if (patch.start_date && patch.end_date && patch.end_date < patch.start_date) {
      return badRequest('Дата завершення раніше дати початку');
    }
    if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null;
    if (body.order_index !== undefined) {
      const o = parseInt(String(body.order_index), 10);
      if (!isNaN(o)) patch.order_index = o;
    }

    const shift = await updateShift(shiftId, patch);
    if (!shift) return notFound('Зміну не знайдено');

    return NextResponse.json({ shift });
  } catch (error) {
    console.error('Update shift error:', error);
    return NextResponse.json({ error: 'Не вдалося оновити' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; shiftId: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const shiftId = parseInt(params.shiftId, 10);
  if (isNaN(shiftId)) return badRequest('Невірний ID');

  try {
    await deleteShift(shiftId);
    return NextResponse.json({ message: 'Зміну видалено' });
  } catch (error) {
    console.error('Delete shift error:', error);
    return NextResponse.json({ error: 'Не вдалося видалити' }, { status: 500 });
  }
}
