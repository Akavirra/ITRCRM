import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getStudentAttendanceLessons, getStudentAttendanceByGroup, getStudentAttendanceStats } from '@/lib/attendance';

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
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const groupId = searchParams.get('groupId') ? parseInt(searchParams.get('groupId')!, 10) : undefined;
  const status = searchParams.get('status') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const view = searchParams.get('view') || 'lessons'; // 'lessons' | 'byGroup' | 'summary'

  try {
    if (view === 'byGroup') {
      const groups = await getStudentAttendanceByGroup(studentId);
      return NextResponse.json({ groups });
    }

    if (view === 'summary') {
      const summary = await getStudentAttendanceStats(studentId, groupId, startDate, endDate);
      return NextResponse.json({ summary });
    }

    // Default: paginated lesson list
    const result = await getStudentAttendanceLessons(studentId, {
      limit,
      offset,
      groupId,
      status,
      startDate,
      endDate,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Student attendance error:', error);
    return NextResponse.json({ error: 'Не вдалося завантажити відвідуваність' }, { status: 500 });
  }
}
