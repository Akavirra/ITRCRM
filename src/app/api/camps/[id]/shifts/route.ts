import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest } from '@/lib/api-utils';
import { listShifts, createShift } from '@/lib/camp-shifts';

export const dynamic = 'force-dynamic';

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const campId = parseInt(params.id, 10);
  if (isNaN(campId)) return badRequest('Невірний ID');

  const shifts = await listShifts(campId);
  return NextResponse.json({ shifts });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const campId = parseInt(params.id, 10);
  if (isNaN(campId)) return badRequest('Невірний ID');

  try {
    const body = await request.json();
    if (!isValidDate(body.start_date)) return badRequest('Невірна дата початку зміни');
    if (!isValidDate(body.end_date)) return badRequest('Невірна дата завершення зміни');
    if (body.end_date < body.start_date) return badRequest('Дата завершення раніше дати початку');

    const shift = await createShift({
      camp_id: campId,
      title: typeof body.title === 'string' ? body.title : undefined,
      start_date: body.start_date,
      end_date: body.end_date,
      notes: body.notes ? String(body.notes) : null,
      autoSkipWeekends: body.autoSkipWeekends !== false,
    });

    return NextResponse.json({ shift }, { status: 201 });
  } catch (error) {
    console.error('Create shift error:', error);
    return NextResponse.json({ error: 'Не вдалося створити зміну' }, { status: 500 });
  }
}
