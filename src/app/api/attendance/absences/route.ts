import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

export interface AbsenceRecord {
  attendance_id: number;
  student_id: number;
  student_name: string;
  status: 'absent' | 'makeup_planned';
  lesson_id: number;
  lesson_date: string;
  lesson_start_time: string | null;
  group_id: number | null;
  group_title: string | null;
  course_title: string | null;
}

// GET /api/attendance/absences
// Returns all unresolved absences (absent OR makeup_planned without a linked makeup lesson)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const { searchParams } = new URL(request.url);
  const studentName = searchParams.get('student') || '';

  const rows = await all<AbsenceRecord>(`
    SELECT
      a.id            AS attendance_id,
      a.student_id,
      s.full_name     AS student_name,
      a.status,
      l.id            AS lesson_id,
      l.lesson_date,
      l.start_datetime AS lesson_start_time,
      l.group_id,
      g.title         AS group_title,
      COALESCE(c_group.title, c_lesson.title) AS course_title
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN lessons  l ON a.lesson_id  = l.id
    LEFT JOIN groups  g        ON l.group_id  = g.id
    LEFT JOIN courses c_group  ON g.course_id = c_group.id
    LEFT JOIN courses c_lesson ON l.course_id = c_lesson.id
    WHERE s.is_active = true
      AND l.status != 'canceled'
      AND (
        a.status = 'absent'
        OR (a.status = 'makeup_planned' AND a.makeup_lesson_id IS NULL)
      )
      ${studentName ? `AND LOWER(s.full_name) LIKE LOWER($1)` : ''}
    ORDER BY l.lesson_date DESC, s.full_name
    LIMIT 300
  `, studentName ? [`%${studentName}%`] : []);

  return NextResponse.json({ absences: rows });
}
