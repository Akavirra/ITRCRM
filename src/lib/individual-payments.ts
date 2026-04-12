import { run, get, all } from '@/db';
import { getIndividualLessonPrice } from './payments';

export interface IndividualPayment {
  id: number;
  student_id: number;
  lessons_count: number;
  amount: number;
  method: 'cash' | 'account';
  paid_at: string;
  note: string | null;
  created_by: number;
  created_at: string;
}

export interface IndividualBalance {
  lessons_paid: number;
  lessons_used: number;
  lessons_remaining: number;
}

// Get or create individual balance for a student
export async function getIndividualBalance(studentId: number): Promise<IndividualBalance> {
  const row = await get<{ lessons_paid: number; lessons_used: number }>(
    `SELECT lessons_paid, lessons_used FROM individual_balances WHERE student_id = $1`,
    [studentId]
  );

  if (!row) {
    return { lessons_paid: 0, lessons_used: 0, lessons_remaining: 0 };
  }

  return {
    lessons_paid: row.lessons_paid,
    lessons_used: row.lessons_used,
    lessons_remaining: row.lessons_paid - row.lessons_used,
  };
}

// Add individual payment (package of N lessons)
export async function addIndividualPayment(
  studentId: number,
  lessonsCount: number,
  amount: number,
  method: 'cash' | 'account',
  createdBy: number,
  note?: string,
  paidAt?: string
): Promise<number> {
  // Record the payment
  const result = await run(
    `INSERT INTO individual_payments (student_id, lessons_count, amount, method, paid_at, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [studentId, lessonsCount, amount, method, paidAt || new Date().toISOString(), note || null, createdBy]
  );

  // Update or create balance
  await run(
    `INSERT INTO individual_balances (student_id, lessons_paid, lessons_used)
     VALUES ($1, $2, 0)
     ON CONFLICT (student_id) DO UPDATE SET lessons_paid = individual_balances.lessons_paid + $2`,
    [studentId, lessonsCount]
  );

  return Number(result[0]?.id);
}

// Use one individual lesson (called when individual lesson is marked as done)
export async function useIndividualLesson(studentId: number): Promise<void> {
  // Ensure balance row exists
  await run(
    `INSERT INTO individual_balances (student_id, lessons_paid, lessons_used)
     VALUES ($1, 0, 0)
     ON CONFLICT (student_id) DO NOTHING`,
    [studentId]
  );

  await run(
    `UPDATE individual_balances SET lessons_used = lessons_used + 1 WHERE student_id = $1`,
    [studentId]
  );
}

// Delete an individual payment (undo)
export async function deleteIndividualPayment(paymentId: number): Promise<void> {
  const payment = await get<{ student_id: number; lessons_count: number }>(
    `SELECT student_id, lessons_count FROM individual_payments WHERE id = $1`,
    [paymentId]
  );

  if (!payment) return;

  await run(`DELETE FROM individual_payments WHERE id = $1`, [paymentId]);

  await run(
    `UPDATE individual_balances SET lessons_paid = GREATEST(0, lessons_paid - $1) WHERE student_id = $2`,
    [payment.lessons_count, payment.student_id]
  );
}

// Get payment history for a student
export async function getIndividualPaymentHistory(
  studentId: number
): Promise<Array<IndividualPayment & { created_by_name: string }>> {
  return await all<IndividualPayment & { created_by_name: string }>(
    `SELECT ip.*, u.name as created_by_name
     FROM individual_payments ip
     JOIN users u ON ip.created_by = u.id
     WHERE ip.student_id = $1
     ORDER BY ip.paid_at DESC`,
    [studentId]
  );
}

// Calculate suggested amount for N lessons with student discount
export async function calculateIndividualAmount(
  studentId: number,
  lessonsCount: number
): Promise<{ lesson_price: number; discount_percent: number; effective_price: number; total: number }> {
  const lessonPrice = await getIndividualLessonPrice();

  // Individual lessons use the same fixed price for everyone.
  const discountPercent = 0;
  const effectivePrice = lessonPrice;

  return {
    lesson_price: lessonPrice,
    discount_percent: discountPercent,
    effective_price: effectivePrice,
    total: lessonsCount * effectivePrice,
  };
}
