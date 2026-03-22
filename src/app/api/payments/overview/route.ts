import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getStudentsWithDebt, getTotalDebtForMonth } from '@/lib/students';
import { getLessonPrice } from '@/lib/payments';
import { all } from '@/db';
import { getIndividualBalance } from '@/lib/individual-payments';

export const dynamic = 'force-dynamic';

// GET /api/payments/overview?month=2026-03-01
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().substring(0, 7) + '-01';

  // Group debts
  const debtors = await getStudentsWithDebt(month);
  const { total_debt, students_count } = await getTotalDebtForMonth(month);
  const lessonPrice = await getLessonPrice();

  // Individual balances - students with negative balance (used > paid)
  let individualDebtors: Array<{ id: number; full_name: string; phone: string | null; parent_name: string | null; parent_phone: string | null; balance: { lessons_paid: number; lessons_used: number; lessons_remaining: number } }> = [];
  try {
    const individualStudents = await all<{
      id: number;
      full_name: string;
      phone: string | null;
      parent_name: string | null;
      parent_phone: string | null;
    }>(
      `SELECT DISTINCT s.id, s.full_name, s.phone, s.parent_name, s.parent_phone
       FROM students s
       JOIN individual_balances ib ON s.id = ib.student_id
       WHERE ib.lessons_used > ib.lessons_paid AND s.is_active = TRUE
       ORDER BY s.full_name`
    );

    individualDebtors = await Promise.all(
      individualStudents.map(async (s) => {
        const balance = await getIndividualBalance(s.id);
        return { ...s, balance };
      })
    );
  } catch {
    // individual_balances table may not exist yet (migration not run)
  }

  // Total payments collected this month (group)
  const collected = await import('@/lib/payments').then(m =>
    m.getPaymentStats(month, month)
  );

  return NextResponse.json({
    month,
    lesson_price: lessonPrice,
    group_debts: {
      total_debt,
      students_count,
      debtors,
    },
    individual_debtors: individualDebtors,
    collected: {
      total_amount: collected.total_amount || 0,
      cash_amount: collected.cash_amount || 0,
      account_amount: collected.account_amount || 0,
      payments_count: collected.payments_count || 0,
    },
  });
}
