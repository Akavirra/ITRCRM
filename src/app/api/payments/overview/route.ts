import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getPaymentsOverview } from '@/lib/payments-page';

export const dynamic = 'force-dynamic';

// GET /api/payments/overview?month=2026-03-01
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().substring(0, 7) + '-01';

  return NextResponse.json(await getPaymentsOverview(month));
}
