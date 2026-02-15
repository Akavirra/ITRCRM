import { run, get, all, transaction } from '@/db';
import { addDays, setHours, setMinutes, format, parse, isAfter, isBefore, startOfDay } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

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
export function generateLessonsForGroup(
  groupId: number,
  weeksAhead: number = 8,
  createdBy: number
): { generated: number; skipped: number } {
  const group = get<Group>(
    `SELECT id, weekly_day, start_time, duration_minutes, timezone, start_date, end_date 
     FROM groups WHERE id = ?`,
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
  const existingLessons = all<{ lesson_date: string }>(
    `SELECT lesson_date FROM lessons WHERE group_id = ?`,
    [groupId]
  );
  const existingDates = new Set(existingLessons.map(l => l.lesson_date));
  
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
    transaction(() => {
      const stmt = run(
        `INSERT INTO lessons (group_id, lesson_date, start_datetime, end_datetime, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        lessonsToInsert[0]
      );
      
      for (let i = 1; i < lessonsToInsert.length; i++) {
        run(
          `INSERT INTO lessons (group_id, lesson_date, start_datetime, end_datetime, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          lessonsToInsert[i]
        );
      }
    });
  }
  
  return { generated, skipped };
}

// Generate lessons for all active groups
export function generateLessonsForAllGroups(
  weeksAhead: number = 8,
  createdBy: number
): { groupId: number; generated: number; skipped: number }[] {
  const groups = all<{ id: number }>(
    `SELECT id FROM groups WHERE is_active = 1`
  );
  
  const results: { groupId: number; generated: number; skipped: number }[] = [];
  
  for (const group of groups) {
    const result = generateLessonsForGroup(group.id, weeksAhead, createdBy);
    results.push({ groupId: group.id, ...result });
  }
  
  return results;
}

// Get lessons for a group within a date range
export function getLessonsForGroup(
  groupId: number,
  startDate?: string,
  endDate?: string
): Lesson[] {
  let sql = `SELECT * FROM lessons WHERE group_id = ?`;
  const params: (string | number)[] = [groupId];
  
  if (startDate) {
    sql += ` AND lesson_date >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ` AND lesson_date <= ?`;
    params.push(endDate);
  }
  
  sql += ` ORDER BY lesson_date ASC`;
  
  return all<Lesson>(sql, params);
}

// Get upcoming lessons for a teacher
export function getUpcomingLessonsForTeacher(
  teacherId: number,
  limit: number = 10
): Array<Lesson & { group_title: string; course_title: string }> {
  return all<Lesson & { group_title: string; course_title: string }>(
    `SELECT l.*, g.title as group_title, c.title as course_title
     FROM lessons l
     JOIN groups g ON l.group_id = g.id
     JOIN courses c ON g.course_id = c.id
     WHERE g.teacher_id = ? AND l.lesson_date >= date('now') AND l.status != 'canceled'
     ORDER BY l.lesson_date ASC
     LIMIT ?`,
    [teacherId, limit]
  );
}

// Get upcoming lessons for all groups (admin view)
export function getUpcomingLessons(limit: number = 10): Array<Lesson & { group_title: string; course_title: string; teacher_name: string }> {
  return all<Lesson & { group_title: string; course_title: string; teacher_name: string }>(
    `SELECT l.*, g.title as group_title, c.title as course_title, u.name as teacher_name
     FROM lessons l
     JOIN groups g ON l.group_id = g.id
     JOIN courses c ON g.course_id = c.id
     JOIN users u ON g.teacher_id = u.id
     WHERE l.lesson_date >= date('now') AND l.status != 'canceled'
     ORDER BY l.lesson_date ASC
     LIMIT ?`,
    [limit]
  );
}

// Cancel lesson
export function cancelLesson(lessonId: number): void {
  run(
    `UPDATE lessons SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [lessonId]
  );
}

// Update lesson topic
export function updateLessonTopic(lessonId: number, topic: string): void {
  run(
    `UPDATE lessons SET topic = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [topic, lessonId]
  );
}

// Mark lesson as done
export function markLessonDone(lessonId: number): void {
  run(
    `UPDATE lessons SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [lessonId]
  );
}