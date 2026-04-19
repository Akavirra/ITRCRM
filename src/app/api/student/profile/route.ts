/**
 * GET /api/student/profile — розширений профіль учня: дані + групи + курси.
 *
 * Відрізняється від /api/student/auth/me тим, що тягне список груп учня,
 * де він активний, разом з назвами курсів. Потрібно для сторінки профілю.
 *
 * ТІЛЬКИ роль crm_student (@/db/neon-student).
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentFromRequest } from '@/lib/student-auth';
import { studentAll } from '@/db/neon-student';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GroupRow {
  id: number;
  public_id: string | null;
  title: string | null;
  course_id: number | null;
  course_title: string | null;
  weekly_day: number | null;
  start_time: string | null;
  duration_minutes: number | null;
  start_date: string | null;
  end_date: string | null;
  join_date: string | null;
  status: string | null;
}

export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const groups = await studentAll<GroupRow>(
    `SELECT
       g.id,
       g.public_id,
       g.title,
       g.course_id,
       c.title AS course_title,
       g.weekly_day,
       g.start_time,
       g.duration_minutes,
       g.start_date,
       g.end_date,
       sg.join_date,
       sg.status
     FROM student_groups sg
     JOIN groups g ON g.id = sg.group_id
     LEFT JOIN courses c ON c.id = g.course_id
     WHERE sg.student_id = $1 AND sg.is_active = TRUE
     ORDER BY g.start_date DESC NULLS LAST, g.id DESC`,
    [student.id]
  );

  return NextResponse.json({
    id: student.id,
    full_name: student.full_name,
    code: student.code,
    sessionExpiresAt: student.sessionExpiresAt,
    groups,
  });
}
