import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest } from '@/lib/api-utils';
import { listPaymentsForParticipant, addPayment } from '@/lib/camp-payments';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string; pid: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const pid = parseInt(params.pid, 10);
  if (isNaN(pid)) return badRequest('Невірний ID');

  const payments = await listPaymentsForParticipant(pid);
  return NextResponse.json({ payments });
}

export async function POST(request: NextRequest, { params }: { params: { id: string; pid: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const pid = parseInt(params.pid, 10);
  if (isNaN(pid)) return badRequest('Невірний ID');

  try {
    const body = await request.json();

    const amount = parseInt(String(body.amount), 10);
    if (isNaN(amount) || amount <= 0) return badRequest('Невірна сума');

    const method = body.method === 'account' ? 'account' : body.method === 'cash' ? 'cash' : null;
    if (!method) return badRequest('Невірний метод оплати');

    let paidAt: string | undefined;
    if (body.paid_at) {
      const d = new Date(body.paid_at);
      if (!isNaN(d.getTime())) paidAt = d.toISOString();
    }

    const payment = await addPayment({
      participant_id: pid,
      amount,
      method,
      paid_at: paidAt,
      note: body.note ? String(body.note) : null,
      created_by: user.id,
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    console.error('Add camp payment error:', error);
    return NextResponse.json({ error: 'Не вдалося додати оплату' }, { status: 500 });
  }
}
