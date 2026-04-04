import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-utils';
import { unauthorized } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

interface PaymentHistoryRow {
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

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const method = searchParams.get('method') || '';
  const type = searchParams.get('type') || '';
  const dateFrom = searchParams.get('from') || '';
  const dateTo = searchParams.get('to') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`student_name ILIKE $${paramIdx}`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (method) {
    conditions.push(`method = $${paramIdx}`);
    params.push(method);
    paramIdx++;
  }
  if (type) {
    conditions.push(`type = $${paramIdx}`);
    params.push(type);
    paramIdx++;
  }
  if (dateFrom) {
    conditions.push(`paid_at >= $${paramIdx}`);
    params.push(dateFrom);
    paramIdx++;
  }
  if (dateTo) {
    conditions.push(`paid_at < ($${paramIdx}::date + interval '1 day')`);
    params.push(dateTo);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await all<PaymentHistoryRow>(
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
    [...params, limit, offset]
  );

  // Get total count for pagination
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

  return NextResponse.json({
    payments: rows,
    total: countResult[0]?.cnt || 0,
    limit,
    offset,
  });
}
