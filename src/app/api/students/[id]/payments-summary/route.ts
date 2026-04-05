import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { get, all } from '@/db';
import { getLessonPrice } from '@/lib/payments';

export const dynamic = 'force-dynamic';

// GET /api/students/[id]/payments-summary
// Returns full payment picture for a student: group debts for ALL months, individual balance, full payment history
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

  const student = await get<{ id: number; full_name: string; discount: number }>(
    `SELECT id, full_name, COALESCE(discount::INTEGER, 0) as discount FROM students WHERE id = $1`,
    [studentId]
  );
  if (!student) {
    return NextResponse.json({ error: 'Учня не знайдено' }, { status: 404 });
  }

  const lessonPrice = await getLessonPrice();
  const effectivePrice = Math.round(lessonPrice * (1 - student.discount / 100));

  // --- Active groups ---
  const groups = await all<{ group_id: number; group_title: string }>(
    `SELECT g.id as group_id, g.title as group_title
     FROM student_groups sg
     JOIN groups g ON sg.group_id = g.id
     WHERE sg.student_id = $1 AND sg.is_active = TRUE AND g.is_active = TRUE
     ORDER BY g.title`,
    [studentId]
  );

  const groupIds = groups.map(g => g.group_id);

  // --- Bulk: lessons count per group per month (all months) ---
  const lessonCounts = groupIds.length > 0
    ? await all<{ group_id: number; month: string; lessons_count: number }>(
        `SELECT l.group_id, TO_CHAR(l.lesson_date, 'YYYY-MM') as month, COUNT(*)::integer as lessons_count
         FROM lessons l
         WHERE l.group_id = ANY($1)
           AND l.status != 'canceled'
           AND COALESCE(l.is_makeup, FALSE) = FALSE
           AND COALESCE(l.is_trial, FALSE) = FALSE
         GROUP BY l.group_id, TO_CHAR(l.lesson_date, 'YYYY-MM')`,
        [groupIds]
      )
    : [];

  // --- Bulk: payments sum per group per month (all months) ---
  const paymentSums = groupIds.length > 0
    ? await all<{ group_id: number; month: string; paid: number }>(
        `SELECT p.group_id, TO_CHAR(p.month, 'YYYY-MM') as month, SUM(p.amount)::integer as paid
         FROM payments p
         WHERE p.student_id = $1 AND p.group_id = ANY($2)
         GROUP BY p.group_id, TO_CHAR(p.month, 'YYYY-MM')`,
        [studentId, groupIds]
      )
    : [];

  // Collect all distinct months from lessons and payments
  const monthSet = new Set<string>();
  for (const lc of lessonCounts) monthSet.add(lc.month);
  for (const ps of paymentSums) monthSet.add(ps.month);
  const months = Array.from(monthSet).sort().reverse();

  // Build lookup maps
  const lessonsMap = new Map<string, number>();
  for (const lc of lessonCounts) lessonsMap.set(`${lc.group_id}:${lc.month}`, lc.lessons_count);
  const paymentsMap = new Map<string, number>();
  for (const ps of paymentSums) paymentsMap.set(`${ps.group_id}:${ps.month}`, ps.paid);

  // Combine into group_debts
  const groupDebts: Array<{
    group_id: number;
    group_title: string;
    month: string;
    lessons_count: number;
    expected: number;
    paid: number;
    diff: number;
  }> = [];

  for (const g of groups) {
    for (const m of months) {
      const key = `${g.group_id}:${m}`;
      const lessonsCount = lessonsMap.get(key) || 0;
      const paid = paymentsMap.get(key) || 0;
      // Skip months with no lessons and no payments for this group
      if (lessonsCount === 0 && paid === 0) continue;
      const expected = lessonsCount * effectivePrice;
      groupDebts.push({
        group_id: g.group_id,
        group_title: g.group_title,
        month: m,
        lessons_count: lessonsCount,
        expected,
        paid,
        diff: paid - expected,
      });
    }
  }

  // --- Individual balance ---
  const individualBalance = await get<{ lessons_paid: number; lessons_used: number }>(
    `SELECT lessons_paid, lessons_used FROM individual_balances WHERE student_id = $1`,
    [studentId]
  );

  // --- Full payment history (no limit) ---
  const history = await all<{
    id: number;
    type: string;
    group_title: string | null;
    month: string | null;
    lessons_count: number | null;
    amount: number;
    method: string;
    paid_at: string;
    note: string | null;
    created_by_name: string;
  }>(
    `SELECT * FROM (
      SELECT p.id, 'group'::text as type, g.title as group_title, p.month,
        NULL::integer as lessons_count, p.amount, p.method, p.paid_at, p.note,
        u.name as created_by_name
      FROM payments p
      JOIN groups g ON p.group_id = g.id
      JOIN users u ON p.created_by = u.id
      WHERE p.student_id = $1
      UNION ALL
      SELECT ip.id, 'individual'::text as type, NULL as group_title, NULL as month,
        ip.lessons_count, ip.amount, ip.method, ip.paid_at, ip.note,
        u.name as created_by_name
      FROM individual_payments ip
      JOIN users u ON ip.created_by = u.id
      WHERE ip.student_id = $1
    ) combined
    ORDER BY paid_at DESC`,
    [studentId]
  );

  // Summary for collapsed view
  const currentMonth = new Date().toISOString().substring(0, 7);
  const currentMonthDebts = groupDebts.filter(d => d.month === currentMonth);
  const totalGroupDebt = groupDebts.reduce((s, d) => s + Math.max(0, -d.diff), 0);

  // Individual debt in money: negative remaining lessons × effective price
  const individualRemaining = individualBalance
    ? individualBalance.lessons_paid - individualBalance.lessons_used
    : 0;
  const individualDebtMoney = individualRemaining < 0
    ? Math.abs(individualRemaining) * effectivePrice
    : 0;

  const totalDebtCurrentMonth = currentMonthDebts.reduce((s, d) => s + Math.max(0, -d.diff), 0) + individualDebtMoney;
  const totalDebtAll = totalGroupDebt + individualDebtMoney;
  const lastPayment = history.length > 0 ? history[0] : null;

  return NextResponse.json({
    student: {
      id: student.id,
      full_name: student.full_name,
      discount_percent: student.discount,
    },
    lesson_price: lessonPrice,
    effective_price: effectivePrice,
    months,
    group_debts: groupDebts,
    individual_balance: individualBalance
      ? {
          lessons_paid: individualBalance.lessons_paid,
          lessons_used: individualBalance.lessons_used,
          lessons_remaining: individualBalance.lessons_paid - individualBalance.lessons_used,
        }
      : null,
    history,
    summary: {
      total_debt_current_month: totalDebtCurrentMonth,
      total_debt_all: totalDebtAll,
      groups_count: groups.length,
      last_payment: lastPayment
        ? { amount: lastPayment.amount, paid_at: lastPayment.paid_at, type: lastPayment.type }
        : null,
    },
  });
}
