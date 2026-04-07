import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin } from '@/lib/api-utils';
import { getDashboardStatsPayload } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return unauthorized();
  }

  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const payload = await getDashboardStatsPayload();
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Dashboard stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
