import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound, badRequest } from '@/lib/api-utils';
import { getCampById, updateCamp, deleteCamp, getCampPricePerDay, getEffectivePricePerDay } from '@/lib/camps';
import { listShifts } from '@/lib/camp-shifts';

export const dynamic = 'force-dynamic';

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return badRequest('Невірний ID');

  const camp = await getCampById(id);
  if (!camp) return notFound('Табір не знайдено');

  const globalPrice = await getCampPricePerDay();
  const shifts = await listShifts(id);

  return NextResponse.json({
    camp,
    shifts,
    effective_price_per_day: getEffectivePricePerDay(camp, globalPrice),
    global_price_per_day: globalPrice,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return badRequest('Невірний ID');

  try {
    const body = await request.json();

    const patch: Parameters<typeof updateCamp>[1] = {};

    if (body.title !== undefined) patch.title = String(body.title).trim();
    if (body.start_date !== undefined) {
      if (!isValidDate(body.start_date)) return badRequest('Невірна дата початку');
      patch.start_date = body.start_date;
    }
    if (body.end_date !== undefined) {
      if (!isValidDate(body.end_date)) return badRequest('Невірна дата завершення');
      patch.end_date = body.end_date;
    }
    if (patch.start_date && patch.end_date && patch.end_date < patch.start_date) {
      return badRequest('Дата завершення раніше дати початку');
    }
    if (body.price_per_day_snapshot !== undefined) {
      if (body.price_per_day_snapshot === null || body.price_per_day_snapshot === '') {
        patch.price_per_day_snapshot = null;
      } else {
        const p = parseInt(String(body.price_per_day_snapshot), 10);
        if (isNaN(p) || p < 0) return badRequest('Невірна ціна');
        patch.price_per_day_snapshot = p;
      }
    }
    if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null;
    if (body.is_archived !== undefined) patch.is_archived = !!body.is_archived;

    const camp = await updateCamp(id, patch);
    if (!camp) return notFound('Табір не знайдено');

    return NextResponse.json({ camp });
  } catch (error) {
    console.error('Update camp error:', error);
    return NextResponse.json({ error: 'Не вдалося оновити' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return badRequest('Невірний ID');

  try {
    await deleteCamp(id);
    return NextResponse.json({ message: 'Табір видалено' });
  } catch (error) {
    console.error('Delete camp error:', error);
    return NextResponse.json({ error: 'Не вдалося видалити' }, { status: 500 });
  }
}
