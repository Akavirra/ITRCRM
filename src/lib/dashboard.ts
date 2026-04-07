import { all, get } from '@/db';
import type { DashboardStatsPayload } from '@/lib/dashboard-types';
import { addDays, format, startOfMonth } from 'date-fns';

export async function getDashboardStatsPayload(): Promise<DashboardStatsPayload> {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const firstDayOfMonth = format(startOfMonth(today), 'yyyy-MM-dd');
  const nextWeek = format(addDays(today, 7), 'MM-dd');
  const todayMonthDay = format(today, 'MM-dd');

  const statsPromise = Promise.all([
    get<{ count: number }>(`SELECT COUNT(*) as count FROM students WHERE is_active = TRUE`),
    get<{ count: number }>(`SELECT COUNT(*) as count FROM groups WHERE status = 'active' AND is_active = TRUE`),
    get<{ count: number }>(`SELECT COUNT(*) as count FROM lessons WHERE lesson_date = $1 AND status != 'canceled'`, [todayStr]),
    get<{ total: number }>(`SELECT SUM(amount) as total FROM payments WHERE month >= $1`, [firstDayOfMonth]),
  ]);

  const schedulePromise = all<DashboardStatsPayload['todaySchedule'][number]>(
    `SELECT 
      l.id, l.start_datetime, l.end_datetime, l.status, l.topic,
      g.title as group_title, c.title as course_title, u.name as teacher_name
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     LEFT JOIN users u ON COALESCE(l.teacher_id, g.teacher_id) = u.id
     WHERE l.lesson_date = $1
     ORDER BY l.start_datetime ASC`,
    [todayStr]
  );

  const birthdaysPromise = all<DashboardStatsPayload['upcomingBirthdays'][number]>(
    `SELECT id, full_name, birth_date, public_id
     FROM students
     WHERE is_active = TRUE
       AND birth_date IS NOT NULL
       AND (
         TO_CHAR(birth_date, 'MM-DD') BETWEEN $1 AND $2
       )
     ORDER BY TO_CHAR(birth_date, 'MM-DD') ASC`,
    [todayMonthDay, nextWeek]
  );

  const recentPaymentsPromise = all<DashboardStatsPayload['recentPayments'][number]>(
    `SELECT p.amount, p.paid_at, s.full_name as student_name, s.public_id as student_public_id
     FROM payments p
     JOIN students s ON p.student_id = s.id
     ORDER BY p.created_at DESC
     LIMIT 5`
  );

  const recentHistoryPromise = all<DashboardStatsPayload['recentHistory'][number]>(
    `SELECT h.action_type, h.action_description, h.created_at, h.user_name, s.full_name as student_name, s.public_id as student_public_id
     FROM student_history h
     JOIN students s ON h.student_id = s.id
     ORDER BY h.created_at DESC
     LIMIT 5`
  );

  const [
    [studentCount, groupCount, lessonCount, revenue],
    todaySchedule,
    upcomingBirthdays,
    recentPayments,
    recentHistory,
  ] = await Promise.all([
    statsPromise,
    schedulePromise,
    birthdaysPromise,
    recentPaymentsPromise,
    recentHistoryPromise,
  ]);

  return {
    stats: {
      activeStudents: studentCount?.count || 0,
      activeGroups: groupCount?.count || 0,
      todayLessons: lessonCount?.count || 0,
      monthlyRevenue: revenue?.total || 0,
    },
    todaySchedule,
    upcomingBirthdays,
    recentPayments,
    recentHistory,
  };
}
