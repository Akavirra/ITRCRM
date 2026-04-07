import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getPaymentsHistory } from '@/lib/payments-page';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  return NextResponse.json(
    await getPaymentsHistory({
      search: searchParams.get('search') || '',
      method: searchParams.get('method') || '',
      type: searchParams.get('type') || '',
      dateFrom: searchParams.get('from') || '',
      dateTo: searchParams.get('to') || '',
      limit,
      offset,
    })
  );
}
