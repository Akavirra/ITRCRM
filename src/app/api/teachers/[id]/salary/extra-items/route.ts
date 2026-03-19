import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import { run, get } from '@/db';

export const dynamic = 'force-dynamic';

// POST — add extra item
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const teacherId = parseInt(params.id, 10);
  if (isNaN(teacherId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  let body: { year?: unknown; month?: unknown; description?: unknown; amount?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Невірний формат' }, { status: 400 });
  }

  const year = parseInt(String(body.year), 10);
  const month = parseInt(String(body.month), 10);
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const amount = parseFloat(String(body.amount));

  if (!year || !month || !description || isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: 'Невірні дані' }, { status: 400 });
  }

  try {
    const row = await get<{ id: number; description: string; amount: number; created_at: string }>(
      `INSERT INTO salary_extra_items (teacher_id, year, month, description, amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, description, amount::float AS amount, created_at`,
      [teacherId, year, month, description, amount, user.id]
    );
    return NextResponse.json({ item: row });
  } catch {
    return NextResponse.json({ error: 'Не вдалося додати' }, { status: 500 });
  }
}

// DELETE — remove extra item by id (passed as query param)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const teacherId = parseInt(params.id, 10);
  const { searchParams } = new URL(request.url);
  const itemId = parseInt(searchParams.get('itemId') || '', 10);

  if (isNaN(teacherId) || isNaN(itemId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  await run(
    `DELETE FROM salary_extra_items WHERE id = $1 AND teacher_id = $2`,
    [itemId, teacherId]
  );
  return NextResponse.json({ ok: true });
}
