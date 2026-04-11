import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const rows = await all<{
    id: number;
    student_id: number;
    lesson_id: number;
    full_name: string;
    public_id: string;
    lesson_date: string;
    group_title: string;
    course_title: string;
    start_time: string;
  }>(
    `SELECT a.id, a.student_id, l.id as lesson_id, s.full_name, s.public_id, l.lesson_date::text as lesson_date,
       COALESCE(g.title, 'Інд.') as group_title,
       COALESCE(c.title, '') as course_title,
       TO_CHAR(l.start_datetime AT TIME ZONE 'Europe/Kyiv', 'HH24:MI') as start_time
     FROM attendance a
     JOIN lessons l ON a.lesson_id = l.id
     JOIN students s ON a.student_id = s.id
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     WHERE a.status = 'absent' AND l.status = 'done' AND s.is_active = TRUE
     ORDER BY l.lesson_date DESC, s.full_name ASC`
  );

  const absences = rows.map((a) => ({
    ...a,
    lessonDateLabel: new Intl.DateTimeFormat('uk-UA', {
      day: '2-digit',
      month: 'long',
      timeZone: 'Europe/Kyiv',
    }).format(new Date(a.lesson_date + 'T12:00:00Z')),
  }));

  return NextResponse.json({ absences });
}
