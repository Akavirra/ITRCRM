import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, getAccessibleGroupIds } from '@/lib/api-utils';
import { getLessonsForGroup, getUpcomingLessonsForTeacher, getUpcomingLessons, getTodayLessons } from '@/lib/lessons';

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
  const today = searchParams.get('today') === 'true';
  
  if (today) {
    // Get today's lessons
    const lessons = await getTodayLessons();
    console.log('[API Lessons today=true] Returning lessons:', lessons.map(l => ({ id: l.id, date: l.lesson_date })));
    return NextResponse.json({ lessons });
  }
  
  if (groupId) {
    // Get lessons for a specific group
    const lessons = await getLessonsForGroup(parseInt(groupId), startDate, endDate);
    return NextResponse.json({ lessons });
  }
  
  // Get upcoming lessons
  const lessons = await getUpcomingLessons(limit);
  console.log('[Lessons API] Returning', lessons.length, 'upcoming lessons');
  lessons.forEach((lesson, index) => {
    console.log(`[Lessons API] Lesson ${index + 1}: ID=${lesson.id}, Group=${lesson.group_id}, Date=${lesson.lesson_date}`);
  });
  return NextResponse.json({ lessons });
}
