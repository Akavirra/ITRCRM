import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest } from '@/lib/api-utils';
import { createCamp, listCampsWithStats } from '@/lib/camps';

export const dynamic = 'force-dynamic';

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true';
  const camps = await listCampsWithStats({ includeArchived });
  return NextResponse.json({ camps });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  try {
    const body = await request.json();

    if (!isValidDate(body.start_date)) return badRequest('Невірна дата початку');
    if (!isValidDate(body.end_date)) return badRequest('Невірна дата завершення');
    if (body.end_date < body.start_date) return badRequest('Дата завершення раніше дати початку');

    let priceSnapshot: number | null = null;
    if (body.price_per_day_snapshot !== undefined && body.price_per_day_snapshot !== null && body.price_per_day_snapshot !== '') {
      const p = parseInt(String(body.price_per_day_snapshot), 10);
      if (isNaN(p) || p < 0) return badRequest('Невірна ціна за день');
      priceSnapshot = p;
    }

    const camp = await createCamp({
      start_date: body.start_date,
      end_date: body.end_date,
      title: typeof body.title === 'string' ? body.title : undefined,
      notes: typeof body.notes === 'string' ? body.notes : null,
      price_per_day_snapshot: priceSnapshot,
      created_by: user.id,
    });

    return NextResponse.json({ camp }, { status: 201 });
  } catch (error) {
    console.error('Create camp error:', error);
    return NextResponse.json({ error: 'Не вдалося створити табір' }, { status: 500 });
  }
}
