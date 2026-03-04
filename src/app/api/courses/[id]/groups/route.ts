import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidCourseId: 'Невірний ID курсу',
};

// Group interface for course groups response
interface CourseGroup {
  id: number;
  public_id: string | null;
  title: string;
  weekly_day: number;
  start_time: string;
  teacher_id: number;
  status: string;
  teacher_name: string | null;
  created_at: string;
}

// GET /api/courses/[id]/groups - Get groups for a course
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const courseId = parseInt(params.id, 10);
  
  if (isNaN(courseId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidCourseId }, { status: 400 });
  }
  
  // Fetch groups for the course with teacher name join
  const groups = await all<CourseGroup>(
    `SELECT g.id, g.public_id, g.title, g.weekly_day, g.start_time, g.teacher_id, g.status, u.name as teacher_name, g.created_at
     FROM groups g
     LEFT JOIN users u ON g.teacher_id = u.id
     WHERE g.course_id = $1
     ORDER BY g.weekly_day, g.start_time`,
    [courseId]
  );
  
  return NextResponse.json({ groups });
}
