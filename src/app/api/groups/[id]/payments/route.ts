import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, checkGroupAccess } from '@/lib/api-utils';
import { getPaymentStatusForGroupMonth, createPayment, updatePayment, deletePayment, getPaymentById } from '@/lib/payments';
import { get } from '@/db';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

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
  
  const paymentStatus = await getPaymentStatusForGroupMonth(groupId, month);
  
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
    
    const paymentId = await createPayment(
      parseInt(student_id),
      groupId,
      month,
      parseInt(amount),
      method,
      user.id,
      note,
      paid_at
    );

    const paymentDetails = await get<{
      student_name: string;
      student_public_id: string | null;
      group_title: string;
      group_public_id: string | null;
    }>(
      `SELECT
        s.full_name as student_name,
        s.public_id as student_public_id,
        g.title as group_title,
        g.public_id as group_public_id
       FROM students s
       JOIN groups g ON g.id = $2
       WHERE s.id = $1`,
      [parseInt(student_id), groupId]
    );

    if (paymentDetails) {
      await safeAddAuditEvent({
        entityType: 'payment',
        entityId: paymentId,
        entityTitle: paymentDetails.student_name,
        entityPublicId: paymentDetails.student_public_id ?? null,
        eventType: 'payment_created',
        eventBadge: toAuditBadge('payment_created'),
        description: `Створено оплату ${parseInt(amount)} грн за ${month} для групи «${paymentDetails.group_title}»`,
        userId: user.id,
        userName: user.name,
        studentId: parseInt(student_id),
        groupId,
        paymentId,
        metadata: {
          amount: parseInt(amount),
          month,
          method,
          note: note ?? null,
          paidAt: paid_at ?? null,
          groupTitle: paymentDetails.group_title,
          groupPublicId: paymentDetails.group_public_id ?? null,
        },
      });
    }
    
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
    
    const existingPayment = await getPaymentById(parseInt(payment_id));
    await updatePayment(parseInt(payment_id), parseInt(amount), method, note, paid_at);

    if (existingPayment) {
      const paymentDetails = await get<{
        student_name: string;
        student_public_id: string | null;
        group_title: string;
        group_public_id: string | null;
      }>(
        `SELECT
          s.full_name as student_name,
          s.public_id as student_public_id,
          g.title as group_title,
          g.public_id as group_public_id
         FROM students s
         JOIN groups g ON g.id = $2
         WHERE s.id = $1`,
        [existingPayment.student_id, existingPayment.group_id]
      );

      if (paymentDetails) {
        await safeAddAuditEvent({
          entityType: 'payment',
          entityId: existingPayment.id,
          entityTitle: paymentDetails.student_name,
          entityPublicId: paymentDetails.student_public_id ?? null,
          eventType: 'payment_updated',
          eventBadge: toAuditBadge('payment_updated'),
          description: `Оновлено оплату до ${parseInt(amount)} грн для групи «${paymentDetails.group_title}»`,
          userId: user.id,
          userName: user.name,
          studentId: existingPayment.student_id,
          groupId: existingPayment.group_id,
          paymentId: existingPayment.id,
          metadata: {
            before: existingPayment,
            after: {
              amount: parseInt(amount),
              method,
              note: note ?? null,
              paid_at: paid_at ?? null,
            },
            groupTitle: paymentDetails.group_title,
            groupPublicId: paymentDetails.group_public_id ?? null,
          },
        });
      }
    }
    
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
  
  const existingPayment = await getPaymentById(parseInt(paymentId));
  if (existingPayment) {
    const paymentDetails = await get<{
      student_name: string;
      student_public_id: string | null;
      group_title: string;
      group_public_id: string | null;
    }>(
      `SELECT
        s.full_name as student_name,
        s.public_id as student_public_id,
        g.title as group_title,
        g.public_id as group_public_id
       FROM students s
       JOIN groups g ON g.id = $2
       WHERE s.id = $1`,
      [existingPayment.student_id, existingPayment.group_id]
    );

    if (paymentDetails) {
      await safeAddAuditEvent({
        entityType: 'payment',
        entityId: existingPayment.id,
        entityTitle: paymentDetails.student_name,
        entityPublicId: paymentDetails.student_public_id ?? null,
        eventType: 'payment_deleted',
        eventBadge: toAuditBadge('payment_deleted'),
        description: `Видалено оплату ${existingPayment.amount} грн за ${existingPayment.month} для групи «${paymentDetails.group_title}»`,
        userId: user.id,
        userName: user.name,
        studentId: existingPayment.student_id,
        groupId: existingPayment.group_id,
        paymentId: existingPayment.id,
        metadata: {
          deletedPayment: existingPayment,
          groupTitle: paymentDetails.group_title,
          groupPublicId: paymentDetails.group_public_id ?? null,
        },
      });
    }
  }

  await deletePayment(parseInt(paymentId));
  
  return NextResponse.json({ message: 'Оплату успішно видалено' });
}
