import { all, get } from '@/db';
import { getStudentsWithDebt } from '@/lib/students';
import type { DashboardStatsPayload } from '@/lib/dashboard-types';
import { addDays, format, startOfMonth, subMonths } from 'date-fns';

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
  const prevMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
  const prevMonthEnd = format(startOfMonth(now), 'yyyy-MM-dd');
  const nextWeek = format(addDays(now, 7), 'MM-dd');
  const todayMonthDay = format(now, 'MM-dd');

  const statsPromise = Promise.all([
    get<{ count: number }>(`SELECT COUNT(*) as count FROM students WHERE is_active = TRUE`),
    get<{ count: number }>(`SELECT COUNT(*) as count FROM groups WHERE status = 'active' AND is_active = TRUE`),
    get<{ count: number }>(`SELECT COUNT(*) as count FROM lessons WHERE lesson_date = $1 AND status != 'canceled'`, [todayStr]),
    get<{ total: number }>(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE month >= $1`, [firstDayOfMonth]),
    get<{ total: number }>(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE month >= $1 AND month < $2`, [prevMonthStart, prevMonthEnd]),
    // Unpaid students: active students in groups who haven't paid this month
    get<{ count: number }>(`
      SELECT COUNT(DISTINCT sg.student_id) as count
      FROM student_groups sg
      JOIN students s ON sg.student_id = s.id
      JOIN groups g ON sg.group_id = g.id
      WHERE sg.status = 'active' AND s.is_active = TRUE AND g.status = 'active' AND g.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.student_id = sg.student_id AND p.group_id = sg.group_id AND p.month >= $1
        )
    `, [firstDayOfMonth]),
    // Attendance % this month
    get<{ total: number; present: number }>(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE a.status = 'present' OR a.status = 'makeup_done') as present
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.lesson_date >= $1 AND l.status = 'done'
    `, [firstDayOfMonth]),
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

  // Next upcoming lesson (not done/canceled, today or future)
  const nextLessonPromise = get<DashboardStatsPayload['nextLesson']>(
    `SELECT
      l.id, l.start_datetime, l.group_id,
      g.title as group_title, c.title as course_title, u.name as teacher_name
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     LEFT JOIN users u ON COALESCE(l.teacher_id, g.teacher_id) = u.id
     WHERE l.start_datetime > NOW() AND l.status = 'scheduled'
     ORDER BY l.start_datetime ASC
     LIMIT 1`
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

  // Group capacity: active groups with student count
  const groupCapacityPromise = all<DashboardStatsPayload['groupCapacity'][number]>(
    `SELECT g.id, g.title, g.capacity, c.title as course_title,
       COUNT(sg.id) FILTER (WHERE sg.status = 'active') as student_count
     FROM groups g
     LEFT JOIN courses c ON g.course_id = c.id
     LEFT JOIN student_groups sg ON sg.group_id = g.id
     WHERE g.status = 'active' AND g.is_active = TRUE
     GROUP BY g.id, g.title, g.capacity, c.title
     ORDER BY g.title ASC`
  );

  // Problem students: many absences this month OR unpaid
  const problemStudentsPromise = all<DashboardStatsPayload['problemStudents'][number]>(
    `SELECT
      s.id, s.full_name, s.public_id,
      COALESCE(abs.cnt, 0) as absences_this_month,
      CASE WHEN debt.student_id IS NOT NULL THEN true ELSE false END as has_debt
     FROM students s
     LEFT JOIN (
       SELECT a.student_id, COUNT(*) as cnt
       FROM attendance a
       JOIN lessons l ON a.lesson_id = l.id
       WHERE a.status = 'absent' AND l.lesson_date >= $1 AND l.status = 'done'
       GROUP BY a.student_id
     ) abs ON abs.student_id = s.id
     LEFT JOIN (
       SELECT DISTINCT sg.student_id
       FROM student_groups sg
       JOIN groups g ON sg.group_id = g.id
       WHERE sg.status = 'active' AND g.status = 'active' AND g.is_active = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM payments p
           WHERE p.student_id = sg.student_id AND p.group_id = sg.group_id AND p.month >= $1
         )
     ) debt ON debt.student_id = s.id
     WHERE s.is_active = TRUE AND (COALESCE(abs.cnt, 0) >= 2 OR debt.student_id IS NOT NULL)
     ORDER BY COALESCE(abs.cnt, 0) DESC, s.full_name ASC
     LIMIT 10`,
    [firstDayOfMonth]
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

  const debtorsPromise = getStudentsWithDebt(firstDayOfMonth);

  const absencesPromise = all<{
    id: number;
    student_id: number;
    full_name: string;
    public_id: string;
    lesson_date: string;
    group_title: string;
    course_title: string;
    start_time: string;
  }>(
    `SELECT a.id, a.student_id, s.full_name, s.public_id, l.lesson_date,
       COALESCE(g.title, 'Інд.') as group_title,
       COALESCE(c.title, '') as course_title,
       TO_CHAR(l.start_datetime AT TIME ZONE 'Europe/Kyiv', 'HH24:MI') as start_time
     FROM attendance a
     JOIN lessons l ON a.lesson_id = l.id
     JOIN students s ON a.student_id = s.id
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     WHERE a.status = 'absent' AND l.lesson_date >= $1 AND l.status = 'done' AND s.is_active = TRUE
     ORDER BY l.lesson_date DESC, s.full_name ASC`,
    [firstDayOfMonth]
  );

  const [
    [studentCount, groupCount, lessonCount, revenue, prevRevenue, unpaidCount, attendanceData],
    todaySchedule,
    nextLesson,
    upcomingBirthdays,
    groupCapacity,
    problemStudents,
    recentPayments,
    recentHistory,
    debtorsRaw,
    absencesRaw,
  ] = await Promise.all([
    statsPromise,
    schedulePromise,
    nextLessonPromise,
    birthdaysPromise,
    groupCapacityPromise,
    problemStudentsPromise,
    recentPaymentsPromise,
    recentHistoryPromise,
    debtorsPromise,
    absencesPromise,
  ]);

  const monthlyRevenue = revenue?.total || 0;
  const prevMonthRevenue = prevRevenue?.total || 0;
  const attTotal = attendanceData?.total || 0;
  const attPresent = attendanceData?.present || 0;
  const attendancePercent = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : null;

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
      unpaidStudents: unpaidCount?.count || 0,
      attendancePercent,
      prevMonthRevenue,
      prevMonthRevenueLabel: formatCurrencyLabel(prevMonthRevenue),
    },
    nextLesson: nextLesson ? {
      ...nextLesson,
      startTimeLabel: formatTimeLabel(nextLesson.start_datetime),
    } : null,
    todaySchedule: todaySchedule.map((lesson) => ({
      ...lesson,
      startTimeLabel: formatTimeLabel(lesson.start_datetime),
      endTimeLabel: formatTimeLabel(lesson.end_datetime),
    })),
    upcomingBirthdays,
    groupCapacity: groupCapacity.map((g) => ({ ...g, student_count: Number(g.student_count) })),
    problemStudents: problemStudents.map((s) => ({ ...s, absences_this_month: Number(s.absences_this_month) })),
    debtorsList: debtorsRaw.map((d) => ({
      id: d.id,
      full_name: d.full_name,
      public_id: d.public_id,
      phone: d.phone,
      parent_name: d.parent_name,
      parent_phone: d.parent_phone,
      group_title: d.group_title,
      debt: d.debt,
      debtLabel: formatCurrencyLabel(d.debt),
      expected_amount: d.expected_amount,
      paid_amount: d.paid_amount,
      lessons_count: d.lessons_count,
      discount_percent: d.discount_percent,
    })),
    absencesList: absencesRaw.map((a) => ({
      ...a,
      lessonDateLabel: formatDateLabel(a.lesson_date + 'T12:00:00Z'),
    })),
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
