import { run, get, all, transaction } from '@/db';
import { addDays, setHours, setMinutes, format, parse, isAfter, isBefore, startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

interface Group {
  id: number;
  weekly_day: number; // 0-6 (Sunday-Saturday)
  start_time: string; // HH:MM
  duration_minutes: number;
  timezone: string;
  start_date: string;
  end_date: string | null;
}

interface Lesson {
  id: number;
  group_id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
}

// Generate lessons for a group
export async function generateLessonsForGroup(
  groupId: number,
  weeksAhead: number = 8,
  createdBy: number
): Promise<{ generated: number; skipped: number }> {
  const group = await get<Group>(
    `SELECT id, weekly_day, start_time, duration_minutes, timezone, start_date, end_date 
     FROM groups WHERE id = $1`,
    [groupId]
  );
  
  if (!group) {
    throw new Error('Group not found');
  }
  
  const today = startOfDay(new Date());
  const endDate = group.end_date ? new Date(group.end_date) : addDays(today, weeksAhead * 7);
  const targetEndDate = addDays(today, weeksAhead * 7);
  
  // Use the earlier of group end date or target end date
  const finalEndDate = group.end_date && isBefore(endDate, targetEndDate) ? endDate : targetEndDate;
  
  // Get existing lessons for this group
  const existingLessons = await all<{ lesson_date: string }>(
    `SELECT lesson_date FROM lessons WHERE group_id = $1`,
    [groupId]
  );
  // Convert dates to yyyy-MM-dd format for proper comparison
  // (PostgreSQL returns DATE as ISO string with time component)
  const existingDates = new Set(existingLessons.map(l => {
    const date = new Date(l.lesson_date);
    return format(date, 'yyyy-MM-dd');
  }));
  
  let generated = 0;
  let skipped = 0;
  
  // Start from group start date or today, whichever is later
  let currentDate = new Date(group.start_date);
  if (isBefore(currentDate, today)) {
    currentDate = today;
  }
  
  // Find the first occurrence of the weekly_day
  while (currentDate.getDay() !== group.weekly_day) {
    currentDate = addDays(currentDate, 1);
  }
  
  // Generate lessons
  const lessonsToInsert: Array<[number, string, string, string, string, number]> = [];
  
  while (!isAfter(currentDate, finalEndDate)) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    if (!existingDates.has(dateStr)) {
      const [hours, minutes] = group.start_time.split(':').map(Number);
      const startDateTime = new Date(currentDate);
      startDateTime.setHours(hours, minutes, 0, 0);
      
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + group.duration_minutes);
      
      const startStr = format(startDateTime, 'yyyy-MM-dd HH:mm:ss');
      const endStr = format(endDateTime, 'yyyy-MM-dd HH:mm:ss');
      
      lessonsToInsert.push([groupId, dateStr, startStr, endStr, 'scheduled', createdBy]);
      generated++;
    } else {
      skipped++;
    }
    
    currentDate = addDays(currentDate, 7);
  }
  
  // Insert all lessons in a transaction
  if (lessonsToInsert.length > 0) {
    await transaction(async () => {
      for (const lesson of lessonsToInsert) {
        await run(
          `INSERT INTO lessons (group_id, lesson_date, start_datetime, end_datetime, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          lesson
        );
      }
    });
  }
  
  return { generated, skipped };
}

// Generate lessons for all active groups
export async function generateLessonsForAllGroups(
  weeksAhead: number = 8,
  createdBy: number
): Promise<{ groupId: number; generated: number; skipped: number }[]> {
  const groups = await all<{ id: number }>(
    `SELECT id FROM groups WHERE is_active = TRUE`
  );
  
  const results: { groupId: number; generated: number; skipped: number }[] = [];
  
  for (const group of groups) {
    const result = await generateLessonsForGroup(group.id, weeksAhead, createdBy);
    results.push({ groupId: group.id, ...result });
  }
  
  return results;
}

// Get lessons for a group within a date range
export async function getLessonsForGroup(
  groupId: number,
  startDate?: string,
  endDate?: string
): Promise<Lesson[]> {
  let sql = `SELECT * FROM lessons WHERE group_id = $1`;
  const params: (string | number)[] = [groupId];
  let paramIndex = 2;
  
  if (startDate) {
    sql += ` AND lesson_date >= $${paramIndex++}`;
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ` AND lesson_date <= $${paramIndex++}`;
    params.push(endDate);
  }
  
  sql += ` ORDER BY lesson_date ASC`;
  
  return await all<Lesson>(sql, params);
}

// Get upcoming lessons for a teacher
export async function getUpcomingLessonsForTeacher(
  teacherId: number,
  limit: number = 10
): Promise<Array<Lesson & { group_title: string; course_title: string }>> {
  return await all<Lesson & { group_title: string; course_title: string }>(
    `SELECT l.*, g.title as group_title, c.title as course_title
     FROM lessons l
     JOIN groups g ON l.group_id = g.id
     JOIN courses c ON g.course_id = c.id
     WHERE g.teacher_id = $1 AND l.lesson_date >= CURRENT_DATE AND l.status != 'canceled'
     ORDER BY l.lesson_date ASC
     LIMIT $2`,
    [teacherId, limit]
  );
}

// Get upcoming lessons for all groups (admin view)
export async function getUpcomingLessons(limit: number = 10): Promise<Array<Lesson & { group_title: string; course_title: string; teacher_name: string }>> {
  return await all<Lesson & { group_title: string; course_title: string; teacher_name: string }>(
    `SELECT l.*, g.title as group_title, c.title as course_title, u.name as teacher_name
     FROM lessons l
     JOIN groups g ON l.group_id = g.id
     JOIN courses c ON g.course_id = c.id
     JOIN users u ON g.teacher_id = u.id
     WHERE l.lesson_date >= CURRENT_DATE AND l.status != 'canceled'
     ORDER BY l.lesson_date ASC
     LIMIT $1`,
    [limit]
  );
}

// Cancel lesson
export async function cancelLesson(lessonId: number): Promise<void> {
  await run(
    `UPDATE lessons SET status = 'canceled', updated_at = NOW() WHERE id = $1`,
    [lessonId]
  );
}

// Update lesson topic
export async function updateLessonTopic(lessonId: number, topic: string): Promise<void> {
  await run(
    `UPDATE lessons SET topic = $1, updated_at = NOW() WHERE id = $2`,
    [topic, lessonId]
  );
}

// Mark lesson as done
export async function markLessonDone(lessonId: number): Promise<void> {
  await run(
    `UPDATE lessons SET status = 'done', updated_at = NOW() WHERE id = $1`,
    [lessonId]
  );
}
