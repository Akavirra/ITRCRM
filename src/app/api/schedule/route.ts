import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, getAccessibleGroupIds } from '@/lib/api-utils';
import { get, all } from '@/db';
import { format, addDays, startOfWeek, parseISO, isWithinInterval } from 'date-fns';
import { uk } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

interface LessonRow {
  id: number;
  group_id: number | null;
  course_id: number | null;
  lesson_date: string;
  original_date: string | null;
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
  start_time: string | null;
  duration_minutes: number | null;
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
      COALESCE(l.start_datetime::time, g.start_time::time, '00:00'::time) as start_time,
      COALESCE(g.duration_minutes, 60) as duration_minutes
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
  
  const lessons = await all<LessonRow>(sql, params);
  
  // Group lessons by day
  const daysMap: Record<string, LessonRow[]> = {};
  
  for (let d = 0; d < 7; d++) {
    const date = addDays(startDate, d);
    const dateStr = format(date, 'yyyy-MM-dd');
    daysMap[dateStr] = [];
  }
  
  for (const lesson of lessons) {
    // Convert lesson_date to yyyy-MM-dd format for proper matching
    // (PostgreSQL returns DATE as ISO string with time component)
    const lessonDateStr = format(new Date(lesson.lesson_date), 'yyyy-MM-dd');
    if (daysMap[lessonDateStr]) {
      daysMap[lessonDateStr].push(lesson);
    }
  }
  
  // Build response
  const days = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(startDate, d);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // Convert Sunday=0 to Sunday=7
    
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
        startTime: lesson.start_time ? lesson.start_time.split(':').slice(0, 2).join(':') : '00:00',
        endTime: calculateEndTime(lesson.start_time || '00:00', lesson.duration_minutes || 60),
        status: lesson.status,
        topic: lesson.topic,
        originalDate: lesson.original_date ? new Date(lesson.original_date).toISOString().split('T')[0] : null,
        isRescheduled: !!lesson.original_date,
      })),
    });
  }
  
  return NextResponse.json({
    weekStart: startDateStr,
    weekEnd: endDateStr,
    days,
    totalLessons: lessons.length,
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

function calculateEndTime(startTime: string, durationMinutes: number): string {
  // Handle time with seconds (e.g., "14:30:00") by taking only first two parts
  const timeParts = startTime.split(':');
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}
