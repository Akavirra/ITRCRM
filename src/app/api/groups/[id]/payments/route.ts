import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, checkGroupAccess } from '@/lib/api-utils';
import { getPaymentStatusForGroupMonth, createPayment, updatePayment, deletePayment, getPaymentById } from '@/lib/payments';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidGroupId: 'Невірний ID групи',
  missingRequiredFields: "Відсутні обов'язкові поля",
  paymentIdRequired: "ID оплати обов'язковий",
  createPaymentFailed: 'Не вдалося створити оплату',
  updatePaymentFailed: 'Не вдалося оновити оплату',
};

// GET /api/groups/[id]/payments - Get payments for group
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const groupId = parseInt(params.id, 10);
  
  if (isNaN(groupId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidGroupId }, { status: 400 });
  }
  
  const hasAccess = await checkGroupAccess(user, groupId);
  
  if (!hasAccess) {
    return forbidden();
  }
  
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().substring(0, 7) + '-01';
  
  const paymentStatus = getPaymentStatusForGroupMonth(groupId, month);
  
  return NextResponse.json({ paymentStatus });
}

// POST /api/groups/[id]/payments - Create payment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  const groupId = parseInt(params.id, 10);
  
  if (isNaN(groupId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidGroupId }, { status: 400 });
  }
  
  try {
    const body = await request.json();
    const { student_id, month, amount, method, note, paid_at } = body;
    
    if (!student_id || !month || !amount || !method) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.missingRequiredFields },
        { status: 400 }
      );
    }
    
    const paymentId = createPayment(
      parseInt(student_id),
      groupId,
      month,
      parseInt(amount),
      method,
      user.id,
      note,
      paid_at
    );
    
    return NextResponse.json({
      id: paymentId,
      message: 'Оплату успішно створено',
    });
  } catch (error) {
    console.error('Create payment error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.createPaymentFailed },
      { status: 500 }
    );
  }
}

// PUT /api/groups/[id]/payments - Update payment
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  const groupId = parseInt(params.id, 10);
  
  if (isNaN(groupId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidGroupId }, { status: 400 });
  }
  
  try {
    const body = await request.json();
    const { payment_id, amount, method, note, paid_at } = body;
    
    if (!payment_id) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.paymentIdRequired },
        { status: 400 }
      );
    }
    
    updatePayment(parseInt(payment_id), parseInt(amount), method, note, paid_at);
    
    return NextResponse.json({ message: 'Оплату успішно оновлено' });
  } catch (error) {
    console.error('Update payment error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.updatePaymentFailed },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id]/payments - Delete payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  const groupId = parseInt(params.id, 10);
  
  if (isNaN(groupId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidGroupId }, { status: 400 });
  }
  
  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get('paymentId');
  
  if (!paymentId) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.paymentIdRequired },
      { status: 400 }
    );
  }
  
  deletePayment(parseInt(paymentId));
  
  return NextResponse.json({ message: 'Оплату успішно видалено' });
}
