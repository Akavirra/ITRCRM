import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidCourseId: 'Невірний ID курсу',
  courseNotFound: 'Курс не знайдено',
};

// Student with group info interface
interface CourseStudent {
  id: number;
  public_id: string | null;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  group_id: number | null;
  group_public_id: string | null;
  group_title: string | null;
  group_status: string | null;
  join_date: string | null;
}

// Student with individual lessons
interface IndividualStudent {
  id: number;
  public_id: string | null;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
}

// GET /api/courses/[id]/students - Get unique students from all groups of a course
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
  
  // Check if course exists
  const course = await all<{ id: number }>('SELECT id FROM courses WHERE id = $1', [courseId]);
  
  if (!course[0]) {
    return NextResponse.json({ error: ERROR_MESSAGES.courseNotFound }, { status: 404 });
  }
  
  // Get students from groups of this course
  const groupStudents = await all<CourseStudent>(
    `SELECT
      s.id,
      s.public_id,
      s.full_name,
      s.phone,
      s.parent_name,
      s.parent_phone,
      g.id as group_id,
      g.public_id as group_public_id,
      g.title as group_title,
      g.status as group_status,
      sg.join_date
    FROM students s
    JOIN student_groups sg ON s.id = sg.student_id
    JOIN groups g ON sg.group_id = g.id
    WHERE g.course_id = $1 AND sg.is_active = TRUE
    ORDER BY s.full_name, g.title`,
    [courseId]
  );

  // Get students with individual lessons (no group) for this course
  const individualStudents = await all<IndividualStudent>(
    `SELECT DISTINCT
      s.id,
      s.public_id,
      s.full_name,
      s.phone,
      s.parent_name,
      s.parent_phone
    FROM students s
    JOIN attendance a ON a.student_id = s.id
    JOIN lessons l ON a.lesson_id = l.id
    WHERE l.course_id = $1
      AND l.group_id IS NULL
      AND s.is_active = TRUE
    ORDER BY s.full_name`,
    [courseId]
  );

  // Merge: group students by their ID, include individual lesson students too
  const uniqueStudentsMap = new Map<number, {
    id: number;
    public_id: string | null;
    full_name: string;
    phone: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    groups: Array<{
      id: number;
      public_id: string | null;
      title: string;
      status: string;
      join_date: string;
    }>;
    hasIndividualLessons: boolean;
  }>();

  for (const row of groupStudents) {
    if (!uniqueStudentsMap.has(row.id)) {
      uniqueStudentsMap.set(row.id, {
        id: row.id,
        public_id: row.public_id,
        full_name: row.full_name,
        phone: row.phone,
        parent_name: row.parent_name,
        parent_phone: row.parent_phone,
        groups: [],
        hasIndividualLessons: false,
      });
    }

    uniqueStudentsMap.get(row.id)!.groups.push({
      id: row.group_id!,
      public_id: row.group_public_id!,
      title: row.group_title!,
      status: row.group_status!,
      join_date: row.join_date!,
    });
  }

  for (const row of individualStudents) {
    if (!uniqueStudentsMap.has(row.id)) {
      uniqueStudentsMap.set(row.id, {
        id: row.id,
        public_id: row.public_id,
        full_name: row.full_name,
        phone: row.phone,
        parent_name: row.parent_name,
        parent_phone: row.parent_phone,
        groups: [],
        hasIndividualLessons: true,
      });
    } else {
      uniqueStudentsMap.get(row.id)!.hasIndividualLessons = true;
    }
  }

  const uniqueStudents = Array.from(uniqueStudentsMap.values());
  
  return NextResponse.json({ 
    students: uniqueStudents,
    total: uniqueStudents.length 
  });
}
