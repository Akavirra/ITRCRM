import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

// GET /api/groups/[id]/lessons-count?months=2026-03,2026-04
// Returns lesson count per month for a group (all statuses — scheduled, done, etc.)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const groupId = parseInt(params.id, 10);
  if (isNaN(groupId)) {
    return NextResponse.json({ error: 'Невірний ID групи' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const monthsParam = searchParams.get('months') || '';
  const months = monthsParam.split(',').filter(Boolean);

  if (months.length === 0) {
    return NextResponse.json({ counts: {} });
  }

  const rows = await all<{ month: string; cnt: number }>(
    `SELECT TO_CHAR(lesson_date, 'YYYY-MM') as month, COUNT(*) as cnt
     FROM lessons
     WHERE group_id = $1 AND TO_CHAR(lesson_date, 'YYYY-MM') = ANY($2)
     GROUP BY TO_CHAR(lesson_date, 'YYYY-MM')`,
    [groupId, months]
  );

  const counts: Record<string, number> = {};
  for (const m of months) {
    counts[m] = 0;
  }
  for (const row of rows) {
    counts[row.month] = Number(row.cnt);
  }

  return NextResponse.json({ counts });
}
