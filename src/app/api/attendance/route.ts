import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import {
  getGlobalAttendanceStats,
  getGlobalAttendanceTotals,
  getGlobalMonthlyStats,
  getGlobalMonthlyTotals,
  getGroupMonthlyRegister,
  getGlobalMonthlyGroupedStats,
  getGlobalMonthlyLessonRecords,
  getGroupAllTimeRegister,
  getMakeupLessonsData,
} from '@/lib/attendance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const view = searchParams.get('view') || 'monthly';
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
  const groupId   = searchParams.get('groupId')   ? parseInt(searchParams.get('groupId')!,   10) : undefined;
  const courseId  = searchParams.get('courseId')  ? parseInt(searchParams.get('courseId')!,  10) : undefined;
  const teacherId = searchParams.get('teacherId') ? parseInt(searchParams.get('teacherId')!, 10) : undefined;
  const search = searchParams.get('search') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  try {
    if (view === 'monthlyTotals') {
      const totals = await getGlobalMonthlyTotals(year, month);
      return NextResponse.json({ totals });
    }

    if (view === 'monthly') {
      const rows = await getGlobalMonthlyStats(year, month, { groupId, search });
      return NextResponse.json({ rows });
    }

    if (view === 'groupedMonthly') {
      // Run grouped stats + totals in parallel to save one round-trip
      const [data, totals] = await Promise.all([
        getGlobalMonthlyGroupedStats(year, month, { groupId, search, teacherId, courseId }),
        getGlobalMonthlyTotals(year, month),
      ]);
      return NextResponse.json({ ...data, totals });
    }

    if (view === 'lessonRecords') {
      const allTime = searchParams.get('allTime') === 'true';
      // In allTime mode year/month are optional filters (may or may not be provided)
      const effectiveYear = allTime ? (searchParams.get('year') ? year : null) : year;
      const effectiveMonth = allTime ? (searchParams.get('month') ? month : null) : month;
      const records = await getGlobalMonthlyLessonRecords(
        effectiveYear,
        effectiveMonth,
        { groupId, search, courseId, teacherId, startDate, endDate }
      );
      return NextResponse.json({ records });
    }

    if (view === 'makeupLessons') {
      const entries = await getMakeupLessonsData({
        startDate,
        endDate,
        year: searchParams.get('year') ? year : undefined,
        month: searchParams.get('month') ? month : undefined,
      });
      return NextResponse.json({ entries });
    }

    if (view === 'groupRegisterAllTime' && groupId) {
      const includeFuture = searchParams.get('includeFuture') === 'true';
      const data = await getGroupAllTimeRegister(groupId, { includeFuture });
      return NextResponse.json({ data });
    }

    if (view === 'register' && groupId) {
      const register = await getGroupMonthlyRegister(groupId, year, month);
      return NextResponse.json({ register });
    }

    if (view === 'totals') {
      const totals = await getGlobalAttendanceTotals();
      return NextResponse.json({ totals });
    }

    // Legacy: paginated stats
    const sortBy = (searchParams.get('sortBy') || 'name') as 'name' | 'rate' | 'absent';
    const sortDir = (searchParams.get('sortDir') || 'asc') as 'asc' | 'desc';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const result = await getGlobalAttendanceStats({ groupId, search, sortBy, sortDir, limit, offset });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Global attendance error:', error);
    return NextResponse.json({ error: 'Не вдалося завантажити статистику відвідуваності' }, { status: 500 });
  }
}
