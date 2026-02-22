import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, getAccessibleGroupIds } from '@/lib/api-utils';
import { get, all } from '@/db';
import { format, addDays, startOfWeek, parseISO, isWithinInterval } from 'date-fns';
import { uk } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

interface LessonRow {
  id: number;
  group_id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  status: 'scheduled' | 'done' | 'canceled';
  group_title: string;
  course_title: string;
  teacher_id: number;
  teacher_name: string;
  weekly_day: number;
  start_time: string;
  duration_minutes: number;
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
  
  // Build the query
  let sql = `
    SELECT 
      l.id,
      l.group_id,
      l.lesson_date,
      l.start_datetime,
      l.end_datetime,
      l.topic,
      l.status,
      g.title as group_title,
      c.title as course_title,
      g.teacher_id,
      u.name as teacher_name,
      g.weekly_day,
      g.start_time,
      g.duration_minutes
    FROM lessons l
    JOIN groups g ON l.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    JOIN users u ON g.teacher_id = u.id
    WHERE l.lesson_date >= $1 AND l.lesson_date <= $2
  `;
  
  const params: (string | number)[] = [startDateStr, endDateStr];
  let paramIndex = 3;
  
  // Add filters
  if (groupId) {
    sql += ` AND l.group_id = $${paramIndex++}`;
    params.push(parseInt(groupId));
  }
  
  if (teacherId) {
    sql += ` AND g.teacher_id = $${paramIndex++}`;
    params.push(parseInt(teacherId));
  }
  
  // Filter by accessible groups
  if (user.role !== 'admin' && accessibleGroupIds.length > 0) {
    sql += ` AND l.group_id IN (${accessibleGroupIds.map(() => `$${paramIndex++}`).join(',')})`;
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
        groupTitle: lesson.group_title,
        courseTitle: lesson.course_title,
        teacherId: lesson.teacher_id,
        teacherName: lesson.teacher_name,
        startTime: lesson.start_time,
        endTime: calculateEndTime(lesson.start_time, lesson.duration_minutes),
        status: lesson.status,
        topic: lesson.topic,
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
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}
