import { all } from '@/db';
import { getIndividualLessonPrice, getLessonPrice, getPaymentStats } from '@/lib/payments';
import { getStudentsWithDebt } from '@/lib/students';

export interface PaymentsOverviewData {
  month: string;
  lesson_price: number;
  individual_lesson_price: number;
  group_debts: {
    total_debt: number;
    students_count: number;
    debtors: Awaited<ReturnType<typeof getStudentsWithDebt>>;
  };
  individual_debtors: Array<{
    id: number;
    full_name: string;
    parent_name: string | null;
    parent_phone: string | null;
    balance: {
      lessons_paid: number;
      lessons_used: number;
      lessons_remaining: number;
    };
  }>;
  collected: {
    total_amount: number;
    cash_amount: number;
    account_amount: number;
    payments_count: number;
  };
}

export interface PaymentHistoryQuery {
  search?: string;
  method?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
}

export interface PaymentHistoryRow {
  id: number;
  type: 'group' | 'individual';
  student_id: number;
  student_name: string;
  group_id: number | null;
  group_title: string | null;
  month: string | null;
  lessons_count: number | null;
  amount: number;
  method: string;
  paid_at: string;
  note: string | null;
  created_by_name: string;
  created_at: string;
}

export async function getPaymentsOverview(month: string): Promise<PaymentsOverviewData> {
  const debtors = await getStudentsWithDebt(month);
  const totalDebt = debtors.reduce((sum, debtor) => sum + debtor.debt, 0);
  const studentsCount = new Set(debtors.map((debtor) => debtor.id)).size;
  const lessonPrice = await getLessonPrice();
  const individualLessonPrice = await getIndividualLessonPrice();

  const individualDebtors = await all<{
    id: number;
    full_name: string;
    parent_name: string | null;
    parent_phone: string | null;
    lessons_paid: number;
    lessons_used: number;
  }>(
    `SELECT s.id, s.full_name, s.parent_name, s.parent_phone,
            ib.lessons_paid, ib.lessons_used
     FROM individual_balances ib
     JOIN students s ON ib.student_id = s.id
     WHERE s.is_active = TRUE
     ORDER BY s.full_name`
  ).then((rows) =>
    rows.map((student) => ({
      id: student.id,
      full_name: student.full_name,
      parent_name: student.parent_name,
      parent_phone: student.parent_phone,
      balance: {
        lessons_paid: student.lessons_paid,
        lessons_used: student.lessons_used,
        lessons_remaining: student.lessons_paid - student.lessons_used,
      },
    }))
  );

  const collected = await getPaymentStats(month, month);

  return {
    month,
    lesson_price: lessonPrice,
    individual_lesson_price: individualLessonPrice,
    group_debts: {
      total_debt: totalDebt,
      students_count: studentsCount,
      debtors,
    },
    individual_debtors: individualDebtors,
    collected: {
      total_amount: collected.total_amount || 0,
      cash_amount: collected.cash_amount || 0,
      account_amount: collected.account_amount || 0,
      payments_count: collected.payments_count || 0,
    },
  };
}

export async function getPaymentsHistory(query: PaymentHistoryQuery): Promise<{
  payments: PaymentHistoryRow[];
  total: number;
  limit: number;
  offset: number;
}> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (query.search) {
    conditions.push(`student_name ILIKE $${paramIdx}`);
    params.push(`%${query.search}%`);
    paramIdx++;
  }
  if (query.method) {
    conditions.push(`method = $${paramIdx}`);
    params.push(query.method);
    paramIdx++;
  }
  if (query.type) {
    conditions.push(`type = $${paramIdx}`);
    params.push(query.type);
    paramIdx++;
  }
  if (query.dateFrom) {
    conditions.push(`paid_at >= $${paramIdx}`);
    params.push(query.dateFrom);
    paramIdx++;
  }
  if (query.dateTo) {
    conditions.push(`paid_at < ($${paramIdx}::date + interval '1 day')`);
    params.push(query.dateTo);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const payments = await all<PaymentHistoryRow>(
    `SELECT * FROM (
      SELECT
        p.id,
        'group'::text as type,
        p.student_id,
        s.full_name as student_name,
        p.group_id,
        g.title as group_title,
        p.month,
        NULL::integer as lessons_count,
        p.amount,
        p.method,
        p.paid_at,
        p.note,
        u.name as created_by_name,
        p.created_at
      FROM payments p
      JOIN students s ON p.student_id = s.id
      JOIN groups g ON p.group_id = g.id
      JOIN users u ON p.created_by = u.id

      UNION ALL

      SELECT
        ip.id,
        'individual'::text as type,
        ip.student_id,
        s.full_name as student_name,
        NULL as group_id,
        NULL as group_title,
        NULL as month,
        ip.lessons_count,
        ip.amount,
        ip.method,
        ip.paid_at,
        ip.note,
        u.name as created_by_name,
        ip.created_at
      FROM individual_payments ip
      JOIN students s ON ip.student_id = s.id
      JOIN users u ON ip.created_by = u.id
    ) combined
    ${whereClause}
    ORDER BY paid_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, query.limit, query.offset]
  );

  const countResult = await all<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM (
      SELECT p.id, s.full_name as student_name, p.method, 'group'::text as type, p.paid_at
      FROM payments p JOIN students s ON p.student_id = s.id
      UNION ALL
      SELECT ip.id, s.full_name as student_name, ip.method, 'individual'::text as type, ip.paid_at
      FROM individual_payments ip JOIN students s ON ip.student_id = s.id
    ) combined
    ${whereClause}`,
    params
  );

  return {
    payments,
    total: countResult[0]?.cnt || 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getPaymentGroups() {
  return all<{ id: number; title: string }>(
    `SELECT id, title
     FROM groups
     WHERE is_active = TRUE
     ORDER BY title`
  );
}

export async function getBatchGroupLessonCounts(groupIds: number[], months: string[]) {
  if (groupIds.length === 0 || months.length === 0) {
    return {};
  }

  const rows = await all<{ group_id: number; month: string; cnt: number }>(
    `SELECT group_id, TO_CHAR(lesson_date, 'YYYY-MM') as month, COUNT(*) as cnt
     FROM lessons
     WHERE group_id = ANY($1)
       AND status != 'canceled'
       AND COALESCE(is_makeup, FALSE) = FALSE
       AND COALESCE(is_trial, FALSE) = FALSE
       AND TO_CHAR(lesson_date, 'YYYY-MM') = ANY($2)
     GROUP BY group_id, TO_CHAR(lesson_date, 'YYYY-MM')`,
    [groupIds, months]
  );

  const counts: Record<string, number> = {};
  for (const groupId of groupIds) {
    for (const month of months) {
      counts[`${groupId}:${month}`] = 0;
    }
  }
  for (const row of rows) {
    counts[`${row.group_id}:${row.month}`] = Number(row.cnt);
  }

  return counts;
}
