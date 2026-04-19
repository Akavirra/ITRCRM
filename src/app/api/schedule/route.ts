import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, getAccessibleGroupIds } from '@/lib/api-utils';
import { get, all } from '@/db';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

interface LessonRow {
  id: number;
  group_id: number | null;
  course_id: number | null;
  lesson_date: string;
  original_date: string | null;
  is_makeup: boolean;
  is_trial: boolean;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  status: 'scheduled' | 'done' | 'canceled';
  group_title: string | null;
  course_title: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  original_teacher_id: number | null;
  is_replaced: boolean;
  weekly_day: number | null;
  start_time_formatted: string | null;
  end_time_formatted: string | null;
}

// GET /api/schedule - Get schedule for a week
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const groupId = searchParams.get('groupId');
  const teacherId = searchParams.get('teacherId');
  
  // Determine the week range
  let startDate: Date;
  let endDate: Date;
  
  if (startDateParam && endDateParam) {
    startDate = parseISO(startDateParam);
    endDate = parseISO(endDateParam);
  } else if (startDateParam) {
    startDate = parseISO(startDateParam);
    endDate = addDays(startDate, 6);
  } else {
    // Default: current week (Monday to Sunday)
    startDate = startOfWeek(new Date(), { weekStartsOn: 1, locale: uk });
    endDate = addDays(startDate, 6);
  }
  
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');
  
  // Get accessible group IDs
  const accessibleGroupIds = await getAccessibleGroupIds(user);
  
  // Build the query - use LEFT JOIN to support individual lessons (without group)
  let sql = `
    SELECT 
      l.id,
      l.group_id,
      l.course_id as lesson_course_id,
      COALESCE(l.course_id, g.course_id) as course_id,
      l.lesson_date,
      l.original_date,
      COALESCE(l.is_makeup, FALSE) as is_makeup,
      COALESCE(l.is_trial, FALSE) as is_trial,
      l.start_datetime,
      l.end_datetime,
      l.topic,
      l.status,
      l.teacher_id,
      g.title as group_title,
      c.title as course_title,
      COALESCE(l.teacher_id, g.teacher_id) as teacher_id,
      COALESCE(u.name, g_teacher.name) as teacher_name,
      g.teacher_id as original_teacher_id,
      CASE WHEN l.teacher_id IS NOT NULL AND l.group_id IS NOT NULL AND l.teacher_id != g.teacher_id THEN TRUE ELSE FALSE END as is_replaced,
      COALESCE(g.weekly_day::integer, 1) as weekly_day,
      COALESCE(
        TO_CHAR(l.start_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI'),
        TO_CHAR(g.start_time::time, 'HH24:MI'),
        '00:00'
      ) as start_time_formatted,
      COALESCE(
        TO_CHAR(l.end_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI'),
        TO_CHAR((g.start_time::time + (COALESCE(g.duration_minutes, 60) || ' minutes')::interval), 'HH24:MI'),
        '01:00'
      ) as end_time_formatted
    FROM lessons l
    LEFT JOIN groups g ON l.group_id = g.id
    LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
    LEFT JOIN users u ON l.teacher_id = u.id
    LEFT JOIN users g_teacher ON g.teacher_id = g_teacher.id
    WHERE l.lesson_date >= $1 AND l.lesson_date <= $2
  `;
  
  const params: (string | number)[] = [startDateStr, endDateStr];
  let paramIndex = 3;
  
  // Add filters
  if (groupId) {
    sql += ` AND l.group_id = ${paramIndex++}`;
    params.push(parseInt(groupId));
  }
  
  if (teacherId) {
    // Check both group teacher and lesson teacher (for individual lessons)
    sql += ` AND (g.teacher_id = ${paramIndex} OR l.teacher_id = ${paramIndex})`;
    params.push(parseInt(teacherId));
  }
  
  // Filter by accessible groups - also include individual lessons (group_id IS NULL)
  if (user.role !== 'admin' && accessibleGroupIds.length > 0) {
    sql += ` AND (l.group_id IN (${accessibleGroupIds.map(() => `${paramIndex++}`).join(',')}) OR l.group_id IS NULL)`;
    params.push(...accessibleGroupIds);
  }
  
  sql += ` ORDER BY l.lesson_date ASC, g.start_time ASC`;

  // Try with is_makeup column; fall back silently if the migration hasn't run yet
  let lessons: LessonRow[];
  try {
    lessons = await all<LessonRow>(sql, params);
  } catch (err: any) {
    if (String(err?.message ?? err).toLowerCase().includes('is_makeup') || String(err?.message ?? err).toLowerCase().includes('is_trial')) {
      const fallback = sql
        .replace('COALESCE(l.is_makeup, FALSE) as is_makeup,', 'FALSE as is_makeup,')
        .replace('COALESCE(l.is_trial, FALSE) as is_trial,', 'FALSE as is_trial,');
      lessons = await all<LessonRow>(fallback, params);
    } else {
      throw err;
    }
  }
  
  // Calculate total days in range
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Group lessons by day
  const daysMap: Record<string, LessonRow[]> = {};

  for (let d = 0; d < totalDays; d++) {
    const date = addDays(startDate, d);
    const dateStr = format(date, 'yyyy-MM-dd');
    daysMap[dateStr] = [];
  }

  for (const lesson of lessons) {
    const lessonDateStr = format(new Date(lesson.lesson_date), 'yyyy-MM-dd');
    if (daysMap[lessonDateStr]) {
      daysMap[lessonDateStr].push(lesson);
    }
  }

  // Fetch camp working days overlapping the date range (admins only for now)
  interface CampDayRow {
    day_date: string;
    camp_id: number;
    camp_title: string;
    season: string;
    shift_id: number;
    shift_title: string;
    participants_count: number;
  }
  let campDays: CampDayRow[] = [];
  if (user.role === 'admin') {
    try {
      campDays = await all<CampDayRow>(
        `SELECT
           csd.day_date::text AS day_date,
           cs.camp_id,
           c.title AS camp_title,
           c.season,
           cs.id AS shift_id,
           cs.title AS shift_title,
           (
             SELECT COUNT(*)::int FROM camp_participants cp
             WHERE cp.camp_id = cs.camp_id
               AND cp.status = 'active'
               AND EXISTS (
                 SELECT 1 FROM camp_participant_days cpd
                 WHERE cpd.participant_id = cp.id AND cpd.day_date = csd.day_date
               )
           ) AS participants_count
         FROM camp_shift_days csd
         JOIN camp_shifts cs ON cs.id = csd.shift_id
         JOIN camps c ON c.id = cs.camp_id
         WHERE csd.day_date >= $1::date
           AND csd.day_date <= $2::date
           AND csd.is_working = TRUE
           AND c.is_archived = FALSE
         ORDER BY csd.day_date ASC, cs.start_date ASC`,
        [startDateStr, endDateStr]
      );
    } catch (err) {
      // If camp tables are not yet migrated, silently proceed
      const msg = String((err as Error)?.message ?? err).toLowerCase();
      if (!msg.includes('camp_shift_days') && !msg.includes('camps') && !msg.includes('does not exist')) {
        throw err;
      }
      campDays = [];
    }
  }

  const campsByDay: Record<string, CampDayRow[]> = {};
  for (const row of campDays) {
    if (!campsByDay[row.day_date]) campsByDay[row.day_date] = [];
    campsByDay[row.day_date].push(row);
  }

  // Build response
  const days = [];
  for (let d = 0; d < totalDays; d++) {
    const date = addDays(startDate, d);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

    days.push({
      date: dateStr,
      dayOfWeek,
      dayName: getDayNameUk(dayOfWeek),
      lessons: daysMap[dateStr].map(lesson => ({
        id: lesson.id,
        groupId: lesson.group_id,
        courseId: lesson.course_id,
        groupTitle: lesson.group_title || 'Індивідуальне',
        courseTitle: lesson.course_title || 'Без курсу',
        teacherId: lesson.teacher_id,
        teacherName: lesson.teacher_name || 'Немає викладача',
        originalTeacherId: lesson.original_teacher_id,
        isReplaced: lesson.is_replaced,
        startTime: lesson.start_time_formatted || '00:00',
        endTime: lesson.end_time_formatted || '00:00',
        status: lesson.status,
        topic: lesson.topic,
        originalDate: lesson.original_date ? new Date(lesson.original_date).toISOString().split('T')[0] : null,
        isRescheduled: !!lesson.original_date,
        isMakeup: !!lesson.is_makeup,
        isTrial: !!lesson.is_trial,
      })),
      camps: (campsByDay[dateStr] || []).map(row => ({
        campId: row.camp_id,
        campTitle: row.camp_title,
        season: row.season,
        shiftId: row.shift_id,
        shiftTitle: row.shift_title,
        participantsCount: row.participants_count,
      })),
    });
  }

  return NextResponse.json({
    weekStart: startDateStr,
    weekEnd: endDateStr,
    days,
    totalLessons: lessons.length,
    totalCampDays: campDays.length,
  });
}

function getDayNameUk(day: number): string {
  const names: Record<number, string> = {
    1: 'Понеділок',
    2: 'Вівторок',
    3: 'Середа',
    4: 'Четвер',
    5: "П'ятниця",
    6: 'Субота',
    7: 'Неділя',
  };
  return names[day] || '';
}

