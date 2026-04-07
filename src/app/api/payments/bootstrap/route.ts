import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getPaymentGroups, getPaymentsHistory, getPaymentsOverview } from '@/lib/payments-page';

export const dynamic = 'force-dynamic';

// GET /api/payments/bootstrap?month=2026-03-01&historyLimit=30
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().substring(0, 7) + '-01';
  const historyLimit = Math.min(parseInt(searchParams.get('historyLimit') || '30', 10), 200);

  const [overview, history, groups] = await Promise.all([
    getPaymentsOverview(month),
    getPaymentsHistory({
      limit: historyLimit,
      offset: 0,
      search: '',
      method: '',
      type: '',
      dateFrom: '',
      dateTo: '',
    }),
    getPaymentGroups(),
  ]);

  return NextResponse.json({
    overview,
    history,
    groups,
  });
}
