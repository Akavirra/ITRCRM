import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest } from '@/lib/api-utils';
import { deletePayment } from '@/lib/camp-payments';
import { safeAddStudentHistoryEntry } from '@/lib/student-history';
import { get } from '@/db';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string; pid: string; paymentId: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const paymentId = parseInt(params.paymentId, 10);
  if (isNaN(paymentId)) return badRequest('Невірний ID');

  try {
    // Capture amount + student link BEFORE deletion for history log
    const payInfo = await get<{ amount: number; student_id: number | null; camp_id: number }>(
      `SELECT cp.amount, part.student_id, part.camp_id
       FROM camp_payments cp
       JOIN camp_participants part ON part.id = cp.participant_id
       WHERE cp.id = $1`,
      [paymentId]
    );

    await deletePayment(paymentId);

    if (payInfo?.student_id) {
      const camp = await get<{ title: string }>(`SELECT title FROM camps WHERE id = $1`, [payInfo.camp_id]);
      const campTitle = camp?.title ?? `Табір #${payInfo.camp_id}`;
      await safeAddStudentHistoryEntry(
        payInfo.student_id,
        'camp_payment_removed',
        `Видалено оплату ${payInfo.amount} ₴ за «${campTitle}»`,
        user.id,
        user.name,
        String(payInfo.amount),
        null,
      );
    }

    return NextResponse.json({ message: 'Оплату видалено' });
  } catch (error) {
    console.error('Delete camp payment error:', error);
    return NextResponse.json({ error: 'Не вдалося видалити' }, { status: 500 });
  }
}
