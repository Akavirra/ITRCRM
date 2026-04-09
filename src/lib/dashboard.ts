import { all, get } from '@/db';
import type { DashboardStatsPayload } from '@/lib/dashboard-types';
import { addDays, format, startOfMonth } from 'date-fns';

const KYIV_TIME_ZONE = 'Europe/Kyiv';

function getGreetingForDate(date: Date) {
  const kyivHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: KYIV_TIME_ZONE,
    }).format(date)
  );

  if (kyivHour < 12) return 'Доброго ранку';
  if (kyivHour < 18) return 'Доброго дня';
  return 'Доброго вечора';
}

function formatCurrencyLabel(amount: number) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatTimeLabel(dateStr: string) {
  return new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KYIV_TIME_ZONE,
  }).format(new Date(dateStr));
}

function formatDateLabel(dateStr: string) {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'long',
    timeZone: KYIV_TIME_ZONE,
  }).format(new Date(dateStr));
}

function formatFullDateLabel(date: Date) {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: KYIV_TIME_ZONE,
  }).format(date);
}

export async function getDashboardStatsPayload(): Promise<DashboardStatsPayload> {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const firstDayOfMonth = format(startOfMonth(now), 'yyyy-MM-dd');
  const nextWeek = format(addDays(now, 7), 'MM-dd');
  const todayMonthDay = format(now, 'MM-dd');

  const statsPromise = Promise.all([
    get<{ count: number }>(`SELECT COUNT(*) as count FROM students WHERE is_active = TRUE`),
    get<{ count: number }>(`SELECT COUNT(*) as count FROM groups WHERE status = 'active' AND is_active = TRUE`),
    get<{ count: number }>(`SELECT COUNT(*) as count FROM lessons WHERE lesson_date = $1 AND status != 'canceled'`, [todayStr]),
    get<{ total: number }>(`SELECT SUM(amount) as total FROM payments WHERE month >= $1`, [firstDayOfMonth]),
  ]);

  const schedulePromise = all<DashboardStatsPayload['todaySchedule'][number]>(
    `SELECT
      l.id, l.start_datetime, l.end_datetime, l.status, l.topic,
      l.group_id, l.is_makeup, l.is_trial, l.original_date,
      g.title as group_title, c.title as course_title, u.name as teacher_name,
      CASE WHEN l.teacher_id IS NOT NULL AND g.teacher_id IS NOT NULL AND l.teacher_id != g.teacher_id THEN true ELSE false END as is_replaced
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

  const monthlyRevenue = revenue?.total || 0;

  return {
    generatedAtLabel: formatFullDateLabel(now),
    todayDate: todayStr,
    greeting: getGreetingForDate(now),
    stats: {
      activeStudents: studentCount?.count || 0,
      activeGroups: groupCount?.count || 0,
      todayLessons: lessonCount?.count || 0,
      monthlyRevenue,
      monthlyRevenueLabel: formatCurrencyLabel(monthlyRevenue),
    },
    todaySchedule: todaySchedule.map((lesson) => ({
      ...lesson,
      startTimeLabel: formatTimeLabel(lesson.start_datetime),
      endTimeLabel: formatTimeLabel(lesson.end_datetime),
    })),
    upcomingBirthdays,
    recentPayments: recentPayments.map((payment) => ({
      ...payment,
      amountLabel: formatCurrencyLabel(payment.amount),
      paidAtLabel: formatDateLabel(payment.paid_at),
    })),
    recentHistory: recentHistory.map((history) => ({
      ...history,
      createdAtLabel: formatDateLabel(history.created_at),
    })),
  };
}
