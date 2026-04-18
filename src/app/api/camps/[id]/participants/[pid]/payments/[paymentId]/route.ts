import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest } from '@/lib/api-utils';
import { deletePayment } from '@/lib/camp-payments';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string; pid: string; paymentId: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const paymentId = parseInt(params.paymentId, 10);
  if (isNaN(paymentId)) return badRequest('Невірний ID');

  try {
    await deletePayment(paymentId);
    return NextResponse.json({ message: 'Оплату видалено' });
  } catch (error) {
    console.error('Delete camp payment error:', error);
    return NextResponse.json({ error: 'Не вдалося видалити' }, { status: 500 });
  }
}
