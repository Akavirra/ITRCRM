import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import {
  getIndividualBalance,
  getIndividualPaymentHistory,
  addIndividualPayment,
  deleteIndividualPayment,
  calculateIndividualAmount,
} from '@/lib/individual-payments';

export const dynamic = 'force-dynamic';

// GET /api/students/[id]/individual-payments
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const studentId = parseInt(params.id, 10);
  if (isNaN(studentId)) {
    return NextResponse.json({ error: 'Невірний ID учня' }, { status: 400 });
  }

  const balance = await getIndividualBalance(studentId);
  const payments = await getIndividualPaymentHistory(studentId);

  return NextResponse.json({ balance, payments });
}

// POST /api/students/[id]/individual-payments
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const studentId = parseInt(params.id, 10);
  if (isNaN(studentId)) {
    return NextResponse.json({ error: 'Невірний ID учня' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { lessons_count, method, note, paid_at } = body;

    if (!lessons_count || !method) {
      return NextResponse.json({ error: "Відсутні обов'язкові поля" }, { status: 400 });
    }

    const lessonsCount = parseInt(lessons_count, 10);
    if (isNaN(lessonsCount) || lessonsCount <= 0) {
      return NextResponse.json({ error: 'Невірна кількість занять' }, { status: 400 });
    }

    // Calculate amount with discount
    const calc = await calculateIndividualAmount(studentId, lessonsCount);
    const amount = body.amount ? parseInt(body.amount, 10) : calc.total;

    const paymentId = await addIndividualPayment(
      studentId,
      lessonsCount,
      amount,
      method,
      user.id,
      note,
      paid_at
    );

    return NextResponse.json({
      id: paymentId,
      amount,
      message: 'Оплату успішно створено',
    });
  } catch (error) {
    console.error('Create individual payment error:', error);
    return NextResponse.json({ error: 'Не вдалося створити оплату' }, { status: 500 });
  }
}

// DELETE /api/students/[id]/individual-payments?paymentId=X
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get('paymentId');

  if (!paymentId) {
    return NextResponse.json({ error: "ID оплати обов'язковий" }, { status: 400 });
  }

  try {
    await deleteIndividualPayment(parseInt(paymentId, 10));
    return NextResponse.json({ message: 'Оплату видалено' });
  } catch (error) {
    console.error('Delete individual payment error:', error);
    return NextResponse.json({ error: 'Не вдалося видалити оплату' }, { status: 500 });
  }
}
