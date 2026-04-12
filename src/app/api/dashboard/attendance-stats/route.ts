import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  // Monthly attendance stats for the last 6 months
  const monthlyStats = await all<{
    month: string;
    total: number;
    present: number;
    absent: number;
  }>(
    `SELECT
      TO_CHAR(l.lesson_date, 'YYYY-MM') as month,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE a.status = 'present' OR a.status = 'makeup_done') as present,
      COUNT(*) FILTER (WHERE a.status = 'absent') as absent
     FROM attendance a
     JOIN lessons l ON a.lesson_id = l.id
     WHERE l.status = 'done'
       AND l.lesson_date >= (CURRENT_DATE - INTERVAL '6 months')
     GROUP BY TO_CHAR(l.lesson_date, 'YYYY-MM')
     ORDER BY month ASC`
  );

  // Top absentees (students with most absences in last 3 months)
  const topAbsentees = await all<{
    student_id: number;
    full_name: string;
    public_id: string;
    absences: number;
    total_lessons: number;
  }>(
    `SELECT
      s.id as student_id,
      s.full_name,
      s.public_id,
      COUNT(*) FILTER (WHERE a.status = 'absent') as absences,
      COUNT(*) as total_lessons
     FROM attendance a
     JOIN lessons l ON a.lesson_id = l.id
     JOIN students s ON a.student_id = s.id
     WHERE l.status = 'done'
       AND l.lesson_date >= (CURRENT_DATE - INTERVAL '3 months')
       AND s.is_active = TRUE
     GROUP BY s.id, s.full_name, s.public_id
     HAVING COUNT(*) FILTER (WHERE a.status = 'absent') > 0
     ORDER BY absences DESC
     LIMIT 10`
  );

  // Absences grouped by month for drill-down
  const absencesByMonth = await all<{
    id: number;
    student_id: number;
    lesson_id: number;
    full_name: string;
    public_id: string;
    lesson_date: string;
    month: string;
    group_title: string;
    course_title: string;
    start_time: string;
  }>(
    `SELECT
      a.id, a.student_id, l.id as lesson_id,
      s.full_name, s.public_id,
      l.lesson_date::text as lesson_date,
      TO_CHAR(l.lesson_date, 'YYYY-MM') as month,
      COALESCE(g.title, 'Інд.') as group_title,
      COALESCE(c.title, '') as course_title,
      TO_CHAR(l.start_datetime AT TIME ZONE 'Europe/Kyiv', 'HH24:MI') as start_time
     FROM attendance a
     JOIN lessons l ON a.lesson_id = l.id
     JOIN students s ON a.student_id = s.id
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     WHERE a.status = 'absent' AND l.status = 'done' AND s.is_active = TRUE
       AND l.lesson_date >= (CURRENT_DATE - INTERVAL '6 months')
     ORDER BY l.lesson_date DESC, s.full_name ASC`
  );

  const formatDateLabel = (dateStr: string) =>
    new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: 'long', timeZone: 'Europe/Kyiv' })
      .format(new Date(dateStr));

  const formatMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 15);
    return new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(date);
  };

  return NextResponse.json({
    monthlyStats: monthlyStats.map((m) => ({
      month: m.month,
      monthLabel: formatMonthLabel(m.month),
      total: Number(m.total),
      present: Number(m.present),
      absent: Number(m.absent),
      percent: m.total > 0 ? Math.round((Number(m.present) / Number(m.total)) * 100) : 0,
    })),
    topAbsentees: topAbsentees.map((s) => ({
      ...s,
      absences: Number(s.absences),
      total_lessons: Number(s.total_lessons),
      percent: s.total_lessons > 0 ? Math.round(((Number(s.total_lessons) - Number(s.absences)) / Number(s.total_lessons)) * 100) : 0,
    })),
    absencesByMonth: absencesByMonth.map((a) => ({
      ...a,
      lessonDateLabel: formatDateLabel(a.lesson_date),
    })),
  });
}
