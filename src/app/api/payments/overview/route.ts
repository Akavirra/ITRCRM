import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getStudentsWithDebt, getTotalDebtForMonth } from '@/lib/students';
import { getLessonPrice } from '@/lib/payments';
import { all, get } from '@/db';

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

  // Individual students — compute from source data (lessons + attendance)
  const individualStudents = await all<{
    id: number;
    full_name: string;
    phone: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    discount: number;
    lessons_done: number;
  }>(
    `SELECT s.id, s.full_name, s.phone, s.parent_name, s.parent_phone,
            COALESCE(s.discount::INTEGER, 0) as discount,
            (SELECT COUNT(*) FROM attendance a
             JOIN lessons l ON a.lesson_id = l.id
             WHERE a.student_id = s.id AND l.group_id IS NULL
               AND l.status = 'done' AND a.status = 'present') as lessons_done
     FROM students s
     WHERE s.is_active = TRUE
       AND EXISTS (
         SELECT 1 FROM attendance a2
         JOIN lessons l2 ON a2.lesson_id = l2.id
         WHERE a2.student_id = s.id AND l2.group_id IS NULL
       )
     ORDER BY s.full_name`
  );

  // Get individual payments per student
  let individualPaymentsMap: Record<number, number> = {};
  try {
    const ipRows = await all<{ student_id: number; total_lessons: number }>(
      `SELECT student_id, COALESCE(SUM(lessons_count), 0) as total_lessons
       FROM individual_payments GROUP BY student_id`
    );
    for (const r of ipRows) {
      individualPaymentsMap[r.student_id] = r.total_lessons;
    }
  } catch {
    // individual_payments table may not exist yet
  }

  const individualDebtors = individualStudents.map(s => {
    const lessonsPaid = individualPaymentsMap[s.id] || 0;
    return {
      id: s.id,
      full_name: s.full_name,
      phone: s.phone,
      parent_name: s.parent_name,
      parent_phone: s.parent_phone,
      balance: {
        lessons_paid: lessonsPaid,
        lessons_used: s.lessons_done,
        lessons_remaining: lessonsPaid - s.lessons_done,
      },
    };
  });

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
