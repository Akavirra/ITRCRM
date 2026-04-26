import { all, get } from '@/db';
import { getStudentsWithDebt } from '@/lib/students';
import type { DashboardHistoryEntry, DashboardHistoryPagePayload, DashboardStatsPayload } from '@/lib/dashboard-types';
import { addDays, format, startOfMonth, startOfYear, subMonths, subDays } from 'date-fns';

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

function mapDashboardHistoryEntries<T extends {
  entity_type: string;
  entity_id: number | null;
  entity_public_id: string | null;
  entity_title: string;
  student_id: number | null;
  student_title: string | null;
  group_id: number | null;
  group_title: string | null;
  course_id: number | null;
  course_title: string | null;
  event_type: string;
  event_badge: string;
  description: string;
  created_at: string;
  user_name: string;
}>(items: T[]): DashboardHistoryEntry[] {
  return items.map((history) => ({
    ...history,
    createdAtLabel: formatDateLabel(history.created_at),
  }));
}

async function loadDashboardHistoryEntries(limit: number, offset = 0): Promise<DashboardHistoryEntry[]> {
  try {
    const auditEvents = await all<{
      entity_type: string;
      entity_id: number | null;
      entity_public_id: string | null;
      entity_title: string;
      student_id: number | null;
      student_title: string | null;
      group_id: number | null;
      group_title: string | null;
      course_id: number | null;
      course_title: string | null;
      event_type: string;
      event_badge: string;
      description: string;
      created_at: string;
      user_name: string;
    }>(
      `SELECT
        audit_events.entity_type,
        audit_events.entity_id,
        audit_events.entity_public_id,
        audit_events.entity_title,
        audit_events.student_id,
        COALESCE(related_student.full_name, CASE WHEN audit_events.entity_type = 'student' THEN audit_events.entity_title ELSE NULL END) as student_title,
        audit_events.group_id,
        COALESCE(related_group.title, CASE WHEN audit_events.entity_type = 'group' THEN audit_events.entity_title ELSE NULL END) as group_title,
        audit_events.course_id,
        COALESCE(related_course.title, CASE WHEN audit_events.entity_type = 'course' THEN audit_events.entity_title ELSE NULL END) as course_title,
        audit_events.event_type,
        audit_events.event_badge,
        audit_events.description,
        audit_events.created_at,
        audit_events.user_name
       FROM audit_events
       LEFT JOIN students related_student ON audit_events.student_id = related_student.id
       LEFT JOIN groups related_group ON audit_events.group_id = related_group.id
       LEFT JOIN courses related_course ON audit_events.course_id = related_course.id
       ORDER BY audit_events.created_at DESC
       LIMIT $1
       OFFSET $2`,
      [limit, offset]
    );

    if (auditEvents.length > 0) {
      return mapDashboardHistoryEntries(auditEvents);
    }
  } catch (error) {
    console.error('[dashboard] Failed to load extended audit_events history, retrying basic query:', error);
  }

  try {
    const basicAuditEvents = await all<{
      entity_type: string;
      entity_id: number | null;
      entity_public_id: string | null;
      entity_title: string;
      student_id: number | null;
      student_title: string | null;
      group_id: number | null;
      group_title: string | null;
      course_id: number | null;
      course_title: string | null;
      event_type: string;
      event_badge: string;
      description: string;
      created_at: string;
      user_name: string;
    }>(
      `SELECT
        audit_events.entity_type,
        audit_events.entity_id,
        audit_events.entity_public_id,
        audit_events.entity_title,
        NULL as student_id,
        NULL as student_title,
        NULL as group_id,
        NULL as group_title,
        NULL as course_id,
        NULL as course_title,
        audit_events.event_type,
        audit_events.event_badge,
        audit_events.description,
        audit_events.created_at,
        audit_events.user_name
       FROM audit_events
       ORDER BY audit_events.created_at DESC
       LIMIT $1
       OFFSET $2`,
      [limit, offset]
    );

    if (basicAuditEvents.length > 0) {
      return mapDashboardHistoryEntries(basicAuditEvents);
    }
  } catch (error) {
    console.error('[dashboard] Failed to load basic audit_events history, falling back to student_history:', error);
  }

  const legacyHistory = await all<{
    entity_type: string;
    entity_id: number | null;
    entity_public_id: string | null;
    entity_title: string;
    student_id: number | null;
    student_title: string | null;
    group_id: number | null;
    group_title: string | null;
    course_id: number | null;
    course_title: string | null;
    event_type: string;
    event_badge: string;
    description: string;
    created_at: string;
    user_name: string;
  }>(
    `SELECT
      'student' as entity_type,
      s.id as entity_id,
      s.public_id as entity_public_id,
      s.full_name as entity_title,
      s.id as student_id,
      s.full_name as student_title,
      NULL as group_id,
      NULL as group_title,
      NULL as course_id,
      NULL as course_title,
      h.action_type as event_type,
      UPPER(h.action_type) as event_badge,
      h.action_description as description,
      h.created_at,
      h.user_name
     FROM student_history h
     JOIN students s ON h.student_id = s.id
     ORDER BY h.created_at DESC
     LIMIT $1
     OFFSET $2`,
    [limit, offset]
  );

  return mapDashboardHistoryEntries(legacyHistory);
}

export async function getDashboardHistoryPage(page = 1, pageSize = 30): Promise<DashboardHistoryPagePayload> {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const offset = (safePage - 1) * safePageSize;

  let total = 0;

  try {
    const auditTotal = await get<{ count: number }>(`SELECT COUNT(*) as count FROM audit_events`);
    total = Number(auditTotal?.count || 0);
  } catch (error) {
    console.error('[dashboard] Failed to count audit_events, falling back to student_history:', error);
  }

  if (total === 0) {
    const legacyTotal = await get<{ count: number }>(`SELECT COUNT(*) as count FROM student_history`);
    total = Number(legacyTotal?.count || 0);
  }

  const items = await loadDashboardHistoryEntries(safePageSize, offset);

  return {
    items,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  };
}

export async function getDashboardStatsPayload(): Promise<DashboardStatsPayload> {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const firstDayOfMonth = format(startOfMonth(now), 'yyyy-MM-dd');
  const firstDayOfYear = format(startOfYear(now), 'yyyy-MM-dd');
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
    // Active courses
    get<{ count: number }>(`SELECT COUNT(*) as count FROM courses WHERE is_active = TRUE`),
    // All-time revenue
    get<{ total: number }>(`SELECT COALESCE(SUM(amount), 0) as total FROM payments`),
    // All-time attendance %
    get<{ total: number; present: number }>(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE a.status = 'present' OR a.status = 'makeup_done') as present
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.status = 'done'
    `),
    // All-time unpaid students (same as month but without date filter — students with any unmatched group)
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
    // Today's unique students count (only confirmed presence)
    get<{ count: number }>(`
      SELECT COUNT(DISTINCT a.student_id) as count
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.lesson_date = $1 AND l.status != 'canceled'
        AND a.status IN ('present', 'makeup_done')
    `, [todayStr]),
    // This month's unique students count (only confirmed presence)
    get<{ count: number }>(`
      SELECT COUNT(DISTINCT a.student_id) as count
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.lesson_date >= $1 AND l.status != 'canceled'
        AND a.status IN ('present', 'makeup_done')
    `, [firstDayOfMonth]),
    // This year's unique students count (only confirmed presence)
    get<{ count: number }>(`
      SELECT COUNT(DISTINCT a.student_id) as count
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.lesson_date >= $1 AND l.status != 'canceled'
        AND a.status IN ('present', 'makeup_done')
    `, [firstDayOfYear]),
    // All-time unique students count (only confirmed presence)
    get<{ count: number }>(`
      SELECT COUNT(DISTINCT a.student_id) as count
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.status != 'canceled'
        AND a.status IN ('present', 'makeup_done')
    `),
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

  const recentHistoryPromise = loadDashboardHistoryEntries(12);

  const debtorsPromise = getStudentsWithDebt(firstDayOfMonth);

  const absencesPromise = all<{
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
     WHERE a.status = 'absent' AND l.lesson_date >= $1 AND l.status = 'done' AND s.is_active = TRUE
     ORDER BY l.lesson_date DESC, s.full_name ASC`,
    [firstDayOfMonth]
  );

  const revenueTrendPromise = all<{ date: string; value: number }>(`
    SELECT TO_CHAR(paid_at AT TIME ZONE 'Europe/Kyiv', 'YYYY-MM-DD') as date, SUM(amount) as value 
    FROM payments 
    WHERE paid_at >= NOW() - INTERVAL '30 days' 
    GROUP BY TO_CHAR(paid_at AT TIME ZONE 'Europe/Kyiv', 'YYYY-MM-DD') 
    ORDER BY date ASC
  `);

  const attendanceTrendPromise = all<{ date: string; value: number }>(`
    SELECT 
      l.lesson_date::text as date, 
      ROUND((COUNT(*) FILTER (WHERE a.status = 'present' OR a.status = 'makeup_done')::numeric / NULLIF(COUNT(*), 0)) * 100) as value
    FROM attendance a
    JOIN lessons l ON a.lesson_id = l.id
    WHERE l.lesson_date >= CURRENT_DATE - 30 AND l.status = 'done'
    GROUP BY l.lesson_date
    ORDER BY l.lesson_date ASC
  `);

  const debtTrendPromise = all<{ date: string; value: number }>(`
    WITH dates AS (
      SELECT generate_series(CURRENT_DATE - 30, CURRENT_DATE, '1 day'::interval)::date as day
    )
    SELECT 
      TO_CHAR(d.day, 'YYYY-MM-DD') as date,
      COUNT(DISTINCT sg.student_id) as value
    FROM dates d
    JOIN student_groups sg ON 
      sg.status = 'active' 
      AND sg.join_date <= d.day 
      AND (sg.leave_date IS NULL OR sg.leave_date >= d.day)
    JOIN students s ON sg.student_id = s.id AND s.is_active = TRUE
    JOIN groups g ON sg.group_id = g.id AND g.status = 'active' AND g.is_active = TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM payments p
      WHERE p.student_id = sg.student_id 
        AND p.group_id = sg.group_id 
        AND p.month >= DATE_TRUNC('month', d.day)::date
    )
    GROUP BY d.day
    ORDER BY d.day ASC
  `);

  const studentsTrendPromise = all<{ date: string; value: number }>(`
    SELECT 
      TO_CHAR(l.start_datetime AT TIME ZONE 'Europe/Kyiv', 'HH24') as date,
      COUNT(DISTINCT a.student_id) as value
    FROM attendance a
    JOIN lessons l ON a.lesson_id = l.id
    WHERE l.lesson_date = CURRENT_DATE
      AND l.status != 'canceled'
      AND a.status IN ('present', 'makeup_done')
    GROUP BY TO_CHAR(l.start_datetime AT TIME ZONE 'Europe/Kyiv', 'HH24')
    ORDER BY TO_CHAR(l.start_datetime AT TIME ZONE 'Europe/Kyiv', 'HH24') ASC
  `);

  const studentsTrendMonthPromise = all<{ date: string; value: number }>(`
    SELECT 
      l.lesson_date::text as date,
      COUNT(DISTINCT a.student_id) as value
    FROM attendance a
    JOIN lessons l ON a.lesson_id = l.id
    WHERE l.lesson_date >= DATE_TRUNC('month', CURRENT_DATE)
      AND l.lesson_date <= CURRENT_DATE
      AND l.status != 'canceled'
      AND a.status IN ('present', 'makeup_done')
    GROUP BY l.lesson_date
    ORDER BY l.lesson_date ASC
  `);

  const studentsTrendYearPromise = all<{ date: string; value: number }>(`
    SELECT 
      TO_CHAR(l.lesson_date, 'YYYY-MM') as date,
      COUNT(DISTINCT a.student_id) as value
    FROM attendance a
    JOIN lessons l ON a.lesson_id = l.id
    WHERE l.lesson_date >= DATE_TRUNC('year', CURRENT_DATE)
      AND l.lesson_date <= CURRENT_DATE
      AND l.status != 'canceled'
      AND a.status IN ('present', 'makeup_done')
    GROUP BY TO_CHAR(l.lesson_date, 'YYYY-MM')
    ORDER BY TO_CHAR(l.lesson_date, 'YYYY-MM') ASC
  `);

  const revenueTrendAllTimePromise = all<{ date: string; value: number }>(`
    SELECT 
      TO_CHAR(paid_at AT TIME ZONE 'Europe/Kyiv', 'YYYY-MM') as date,
      SUM(amount) as value 
    FROM payments 
    GROUP BY TO_CHAR(paid_at AT TIME ZONE 'Europe/Kyiv', 'YYYY-MM') 
    ORDER BY date ASC
  `);

  const attendanceTrendAllTimePromise = all<{ date: string; value: number }>(`
    SELECT 
      TO_CHAR(l.lesson_date, 'YYYY-MM') as date,
      ROUND((COUNT(*) FILTER (WHERE a.status = 'present' OR a.status = 'makeup_done')::numeric / NULLIF(COUNT(*), 0)) * 100) as value
    FROM attendance a
    JOIN lessons l ON a.lesson_id = l.id
    WHERE l.status = 'done'
    GROUP BY TO_CHAR(l.lesson_date, 'YYYY-MM')
    ORDER BY TO_CHAR(l.lesson_date, 'YYYY-MM') ASC
  `);

  const studentsTrendAllTimePromise = all<{ date: string; value: number }>(`
    SELECT 
      TO_CHAR(l.lesson_date, 'YYYY-MM') as date,
      COUNT(DISTINCT a.student_id) as value
    FROM attendance a
    JOIN lessons l ON a.lesson_id = l.id
    WHERE l.status != 'canceled'
      AND a.status IN ('present', 'makeup_done')
    GROUP BY TO_CHAR(l.lesson_date, 'YYYY-MM')
    ORDER BY TO_CHAR(l.lesson_date, 'YYYY-MM') ASC
  `);

  const debtTrendAllTimePromise = all<{ date: string; value: number }>(`
    WITH months AS (
      SELECT TO_CHAR(generate_series(
        COALESCE(DATE_TRUNC('month', (SELECT MIN(month) FROM payments)), DATE_TRUNC('month', CURRENT_DATE)),
        DATE_TRUNC('month', CURRENT_DATE),
        '1 month'::interval
      ), 'YYYY-MM') as month
    )
    SELECT 
      m.month as date,
      COUNT(DISTINCT sg.student_id) as value
    FROM months m
    JOIN student_groups sg ON 
      sg.join_date <= (m.month || '-01')::date + interval '1 month' - interval '1 day'
      AND (sg.leave_date IS NULL OR sg.leave_date >= (m.month || '-01')::date)
    JOIN students s ON sg.student_id = s.id AND s.is_active = TRUE
    JOIN groups g ON sg.group_id = g.id AND g.status = 'active' AND g.is_active = TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM payments p
      WHERE p.student_id = sg.student_id 
        AND p.group_id = sg.group_id 
        AND p.month >= (m.month || '-01')::date
        AND p.month < (m.month || '-01')::date + interval '1 month'
    )
    GROUP BY m.month
    ORDER BY m.month ASC
  `);

  const [
    [studentCount, groupCount, lessonCount, revenue, prevRevenue, unpaidCount, attendanceData,
     courseCount, allTimeRevenue, allTimeAttendanceData, allTimeUnpaidCount,
     todayStudentsCount, monthStudentsCount, yearStudentsCount, allTimeStudentsCount],
    todaySchedule,
    nextLesson,
    upcomingBirthdays,
    groupCapacity,
    problemStudents,
    recentPayments,
    recentHistory,
    debtorsRaw,
    absencesRaw,
    revenueTrendRaw,
    attendanceTrendRaw,
    debtTrendRaw,
    studentsTrendRaw,
    studentsTrendMonthRaw,
    studentsTrendYearRaw,
    revenueTrendAllTimeRaw,
    attendanceTrendAllTimeRaw,
    studentsTrendAllTimeRaw,
    debtTrendAllTimeRaw,
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
    revenueTrendPromise,
    attendanceTrendPromise,
    debtTrendPromise,
    studentsTrendPromise,
    studentsTrendMonthPromise,
    studentsTrendYearPromise,
    revenueTrendAllTimePromise,
    attendanceTrendAllTimePromise,
    studentsTrendAllTimePromise,
    debtTrendAllTimePromise,
  ]);

  const monthlyRevenue = revenue?.total || 0;
  const prevMonthRevenue = prevRevenue?.total || 0;
  const attTotal = attendanceData?.total || 0;
  const attPresent = attendanceData?.present || 0;
  const attendancePercent = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : null;

  const allTimeRevenueVal = allTimeRevenue?.total || 0;
  const allTimeAttTotal = allTimeAttendanceData?.total || 0;
  const allTimeAttPresent = allTimeAttendanceData?.present || 0;
  const allTimeAttendancePercent = allTimeAttTotal > 0 ? Math.round((allTimeAttPresent / allTimeAttTotal) * 100) : null;

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    return format(subDays(now, 29 - i), 'yyyy-MM-dd');
  });

  const revenueTrend = last30Days.map(date => {
    const record = revenueTrendRaw.find(r => r.date === date);
    return record ? Number(record.value) : 0;
  });

  const attendanceTrend = last30Days.map(date => {
    const record = attendanceTrendRaw.find(r => r.date === date);
    return record ? Number(record.value) : 0;
  });

  const debtTrend = last30Days.map(date => {
    const record = debtTrendRaw.find(r => r.date === date);
    return record ? Number(record.value) : 0;
  });

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const studentsTrend = hours.map(hour => {
    const record = studentsTrendRaw.find(r => r.date === hour);
    return record ? Number(record.value) : 0;
  });

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();
  const daysInMonth = Array.from({ length: currentDate }, (_, i) => {
    return format(new Date(currentYear, currentMonth, i + 1), 'yyyy-MM-dd');
  });
  const studentsTrendMonth = daysInMonth.map(date => {
    const record = studentsTrendMonthRaw.find(r => r.date === date);
    return record ? Number(record.value) : 0;
  });

  const monthsInYear = Array.from({ length: currentMonth + 1 }, (_, i) => {
    return format(new Date(currentYear, i, 1), 'yyyy-MM');
  });
  const studentsTrendYear = monthsInYear.map(month => {
    const record = studentsTrendYearRaw.find(r => r.date === month);
    return record ? Number(record.value) : 0;
  });

  const allTimeMonthsSet = new Set<string>();
  [
    ...revenueTrendAllTimeRaw,
    ...attendanceTrendAllTimeRaw,
    ...studentsTrendAllTimeRaw,
    ...debtTrendAllTimeRaw,
  ].forEach((r) => {
    if (r.date) allTimeMonthsSet.add(r.date);
  });
  const sortedAllTimeMonths = Array.from(allTimeMonthsSet).sort();
  const firstAllTimeMonth = sortedAllTimeMonths[0] || format(now, 'yyyy-MM');
  const lastAllTimeMonth = format(now, 'yyyy-MM');

  const [firstAllYear, firstAllMon] = firstAllTimeMonth.split('-').map(Number);
  const [lastAllYear, lastAllMon] = lastAllTimeMonth.split('-').map(Number);
  const allTimeMonthRange: string[] = [];
  for (let y = firstAllYear; y <= lastAllYear; y++) {
    const startM = y === firstAllYear ? firstAllMon : 1;
    const endM = y === lastAllYear ? lastAllMon : 12;
    for (let m = startM; m <= endM; m++) {
      allTimeMonthRange.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }

  const revenueTrendAllTime = allTimeMonthRange.map((month) => {
    const record = revenueTrendAllTimeRaw.find((r) => r.date === month);
    return record ? Number(record.value) : 0;
  });

  const attendanceTrendAllTime = allTimeMonthRange.map((month) => {
    const record = attendanceTrendAllTimeRaw.find((r) => r.date === month);
    return record ? Number(record.value) : 0;
  });

  const studentsTrendAllTime = allTimeMonthRange.map((month) => {
    const record = studentsTrendAllTimeRaw.find((r) => r.date === month);
    return record ? Number(record.value) : 0;
  });

  const debtTrendAllTime = allTimeMonthRange.map((month) => {
    const record = debtTrendAllTimeRaw.find((r) => r.date === month);
    return record ? Number(record.value) : 0;
  });

  return {
    generatedAtLabel: formatFullDateLabel(now),
    todayDate: todayStr,
    greeting: getGreetingForDate(now),
    stats: {
      activeStudents: studentCount?.count || 0,
      activeGroups: groupCount?.count || 0,
      activeCourses: courseCount?.count || 0,
      todayLessons: lessonCount?.count || 0,
      monthlyRevenue,
      monthlyRevenueLabel: formatCurrencyLabel(monthlyRevenue),
      unpaidStudents: unpaidCount?.count || 0,
      attendancePercent,
      prevMonthRevenue,
      prevMonthRevenueLabel: formatCurrencyLabel(prevMonthRevenue),
      allTimeRevenue: allTimeRevenueVal,
      allTimeRevenueLabel: formatCurrencyLabel(allTimeRevenueVal),
      allTimeUnpaidStudents: allTimeUnpaidCount?.count || 0,
      allTimeAttendancePercent,
      todayStudents: todayStudentsCount?.count || 0,
      monthStudents: monthStudentsCount?.count || 0,
      yearStudents: yearStudentsCount?.count || 0,
      allTimeStudents: allTimeStudentsCount?.count || 0,
      revenueTrend,
      attendanceTrend,
      debtTrend,
      studentsTrend,
      studentsTrendMonth,
      studentsTrendYear,
      revenueTrendAllTime,
      attendanceTrendAllTime,
      debtTrendAllTime,
      studentsTrendAllTime,
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
    recentHistory,
  };
}
