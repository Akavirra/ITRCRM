import { get, all, run } from '@/db';
import { createGlobalNotification } from '@/lib/notifications';

export interface CampPayment {
  id: number;
  participant_id: number;
  amount: number;
  method: 'cash' | 'account';
  paid_at: string;
  note: string | null;
  created_by: number | null;
  created_at: string;
}

export interface CampPaymentWithActor extends CampPayment {
  created_by_name: string | null;
}

export async function listPaymentsForParticipant(participantId: number): Promise<CampPaymentWithActor[]> {
  return all<CampPaymentWithActor>(
    `SELECT cp.*, u.name AS created_by_name
     FROM camp_payments cp
     LEFT JOIN users u ON u.id = cp.created_by
     WHERE cp.participant_id = $1
     ORDER BY cp.paid_at DESC, cp.id DESC`,
    [participantId]
  );
}

export async function listPaymentsForCamp(campId: number): Promise<Array<CampPaymentWithActor & { participant_full_name: string }>> {
  return all<CampPaymentWithActor & { participant_full_name: string }>(
    `SELECT
       cp.*,
       u.name AS created_by_name,
       TRIM(BOTH ' ' FROM COALESCE(p.last_name, '') || ' ' || COALESCE(p.first_name, '')) AS participant_full_name
     FROM camp_payments cp
     LEFT JOIN users u ON u.id = cp.created_by
     JOIN camp_participants p ON p.id = cp.participant_id
     WHERE p.camp_id = $1
     ORDER BY cp.paid_at DESC, cp.id DESC`,
    [campId]
  );
}

export async function addPayment(input: {
  participant_id: number;
  amount: number;
  method: 'cash' | 'account';
  paid_at?: string;
  note?: string | null;
  created_by: number;
}): Promise<CampPayment> {
  const rows = await run(
    `INSERT INTO camp_payments (participant_id, amount, method, paid_at, note, created_by)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5, $6)
     RETURNING *`,
    [
      input.participant_id,
      input.amount,
      input.method,
      input.paid_at ?? null,
      input.note ?? null,
      input.created_by,
    ]
  );
  const payment = rows[0] as CampPayment;

  try {
    const meta = await get<{
      camp_id: number;
      camp_name: string;
      participant_name: string;
    }>(
      `SELECT c.id as camp_id, c.name as camp_name,
              TRIM(BOTH ' ' FROM COALESCE(p.last_name, '') || ' ' || COALESCE(p.first_name, '')) as participant_name
       FROM camp_participants p
       JOIN camps c ON p.camp_id = c.id
       WHERE p.id = $1`,
      [input.participant_id]
    );
    if (meta) {
      await createGlobalNotification(
        'camp_payment_added',
        'Оплата табору',
        `${meta.participant_name} — ${meta.camp_name} — ${input.amount} ₴`,
        `/camps/${meta.camp_id}`,
        { paymentId: payment.id, campId: meta.camp_id, participantId: input.participant_id },
        `camp_payment_added:${payment.id}`
      );
    }
  } catch (err) {
    console.error('[camp-payments] Failed to create notification:', err);
  }

  return payment;
}

export async function deletePayment(paymentId: number): Promise<void> {
  await run(`DELETE FROM camp_payments WHERE id = $1`, [paymentId]);
}

export async function getPaymentById(paymentId: number): Promise<CampPayment | null> {
  const row = await get<CampPayment>(`SELECT * FROM camp_payments WHERE id = $1`, [paymentId]);
  return row ?? null;
}
