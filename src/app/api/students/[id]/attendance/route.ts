import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import {
  getStudentAttendanceLessons,
  getStudentAttendanceByGroup,
  getStudentAttendanceStats,
  getStudentMonthlyAttendance,
  getStudentYearlyAttendance,
} from '@/lib/attendance';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const studentId = parseInt(params.id, 10);
  if (isNaN(studentId)) {
    return NextResponse.json({ error: 'Невірний ID учня' }, { status: 400 });
  }

  const { searchParams } = request.nextUrl;
  const view = searchParams.get('view') || 'monthly';

  try {
    if (view === 'monthly') {
      const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
      const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
      const groups = await getStudentMonthlyAttendance(studentId, year, month);
      return NextResponse.json({ groups, year, month });
    }

    if (view === 'yearly') {
      const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
      const days = await getStudentYearlyAttendance(studentId, year);
      return NextResponse.json({ days, year });
    }

    if (view === 'byGroup') {
      const groups = await getStudentAttendanceByGroup(studentId);
      return NextResponse.json({ groups });
    }

    if (view === 'summary') {
      const groupId = searchParams.get('groupId') ? parseInt(searchParams.get('groupId')!, 10) : undefined;
      const startDate = searchParams.get('startDate') || undefined;
      const endDate = searchParams.get('endDate') || undefined;
      const summary = await getStudentAttendanceStats(studentId, groupId, startDate, endDate);
      return NextResponse.json({ summary });
    }

    // Default: paginated lesson list
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const groupId = searchParams.get('groupId') ? parseInt(searchParams.get('groupId')!, 10) : undefined;
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const result = await getStudentAttendanceLessons(studentId, { limit, offset, groupId, status, startDate, endDate });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Student attendance error:', error);
    return NextResponse.json({ error: 'Не вдалося завантажити відвідуваність' }, { status: 500 });
  }
}
