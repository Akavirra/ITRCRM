import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, getAccessibleGroupIds } from '@/lib/api-utils';
import { getLessonsForGroup, getUpcomingLessonsForTeacher, getUpcomingLessons } from '@/lib/lessons';

export const dynamic = 'force-dynamic';

// GET /api/lessons - List lessons
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  
  if (groupId) {
    // Get lessons for a specific group
    const lessons = await getLessonsForGroup(parseInt(groupId), startDate, endDate);
    return NextResponse.json({ lessons });
  }
  
  // Get upcoming lessons
  const lessons = getUpcomingLessons(limit);
  return NextResponse.json({ lessons });
}
