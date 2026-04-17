import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin } from '@/lib/api-utils';
import { getDashboardHistoryPage } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return unauthorized();
  }

  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get('page') || '1', 10);
  const pageSize = Number.parseInt(searchParams.get('pageSize') || '30', 10);

  try {
    const payload = await getDashboardHistoryPage(page, pageSize);
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Dashboard history API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
