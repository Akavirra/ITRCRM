import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getGlobalAttendanceStats, getGlobalAttendanceTotals } from '@/lib/attendance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const view = searchParams.get('view') || 'stats'; // 'stats' | 'totals'
  const groupId = searchParams.get('groupId') ? parseInt(searchParams.get('groupId')!, 10) : undefined;
  const search = searchParams.get('search') || undefined;
  const sortBy = (searchParams.get('sortBy') || 'name') as 'name' | 'rate' | 'absent';
  const sortDir = (searchParams.get('sortDir') || 'asc') as 'asc' | 'desc';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    if (view === 'totals') {
      const totals = await getGlobalAttendanceTotals();
      return NextResponse.json({ totals });
    }

    const result = await getGlobalAttendanceStats({ groupId, search, sortBy, sortDir, limit, offset });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Global attendance error:', error);
    return NextResponse.json({ error: 'Не вдалося завантажити статистику відвідуваності' }, { status: 500 });
  }
}
