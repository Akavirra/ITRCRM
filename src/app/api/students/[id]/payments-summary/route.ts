import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { get, all } from '@/db';
import { getLessonPrice } from '@/lib/payments';

export const dynamic = 'force-dynamic';

// GET /api/students/[id]/payments-summary
// Returns full payment picture for a student: group debts per month, individual balance, payment history
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

  // --- Group payment status: for each active group, last 3 months ---
  const groups = await all<{ group_id: number; group_title: string }>(
    `SELECT g.id as group_id, g.title as group_title
     FROM student_groups sg
     JOIN groups g ON sg.group_id = g.id
     WHERE sg.student_id = $1 AND sg.is_active = TRUE AND g.is_active = TRUE
     ORDER BY g.title`,
    [studentId]
  );

  // Generate last 3 months (including current)
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().substring(0, 7));
  }

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
      const row = await get<{ lessons_count: number; paid: number }>(
        `SELECT
          (SELECT COUNT(*) FROM lessons l
           WHERE l.group_id = $1 AND TO_CHAR(l.lesson_date, 'YYYY-MM') = $2
             AND l.status != 'canceled' AND COALESCE(l.is_makeup, FALSE) = FALSE AND COALESCE(l.is_trial, FALSE) = FALSE
          ) as lessons_count,
          COALESCE((SELECT SUM(p.amount) FROM payments p
           WHERE p.student_id = $3 AND p.group_id = $1 AND TO_CHAR(p.month, 'YYYY-MM') = $2
          ), 0) as paid`,
        [g.group_id, m, studentId]
      );
      const lessonsCount = row?.lessons_count || 0;
      const expected = lessonsCount * effectivePrice;
      const paid = row?.paid || 0;
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

  // --- Payment history (last 30, both group and individual) ---
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
    ORDER BY paid_at DESC
    LIMIT 30`,
    [studentId]
  );

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
  });
}
