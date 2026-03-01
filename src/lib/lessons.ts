import { run, get, all, transaction } from '@/db';
import { addDays, addMonths, setHours, setMinutes, format, parse, isAfter, isBefore, startOfDay, endOfMonth } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// Character set for generating random alphanumeric strings (uppercase only)
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MIN_RANDOM_LENGTH = 8;
const MAX_RANDOM_LENGTH = 10;

function generateRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  
  for (let i = 0; i < length; i++) {
    const index = bytes[i] % CHARSET.length;
    result += CHARSET[index];
  }
  
  return result;
}

function generatePublicId(prefix: string): string {
  const length = MIN_RANDOM_LENGTH + Math.floor(Math.random() * (MAX_RANDOM_LENGTH - MIN_RANDOM_LENGTH + 1));
  const randomPart = generateRandomString(length);
  return `${prefix}-${randomPart}`;
}

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
  public_id: string;
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
  createdBy: number,
  monthsAhead: number = 1
): Promise<{ generated: number; skipped: number }> {
  console.log('[generateLessonsForGroup] ================= START ================');
  console.log('[generateLessonsForGroup] Function called with groupId:', groupId);
  
  try {
    console.log('[generateLessonsForGroup] About to query database for group data...');
    
    const group = await get<Group>(
      `SELECT id, weekly_day, start_time, duration_minutes, timezone, start_date, end_date 
       FROM groups WHERE id = $1`,
      [groupId]
    );
    console.log('[generateLessonsForGroup] Group query completed, group:', group);
    
    if (!group) {
      console.error('[generateLessonsForGroup] Group not found:', groupId);
      throw new Error('Group not found');
    }
    
    console.log('[generateLessonsForGroup] Group data:', JSON.stringify(group));

    // Validate required fields
    if (!group.start_time) {
      console.error('[generateLessonsForGroup] Missing start_time for group:', groupId);
      throw new Error('Missing start_time for group');
    }
    
    const today = startOfDay(new Date());
    
    // Calculate target end date based on monthsAhead
    // monthsAhead = 1 means current month + next month (end of next month)
    const targetEndDate = endOfMonth(addMonths(today, monthsAhead));
    const endDate = group.end_date ? new Date(group.end_date) : targetEndDate;
    
    // Use the earlier of group end date or target end date
    const finalEndDate = group.end_date && isBefore(endDate, targetEndDate) ? endDate : targetEndDate;
    
    console.log('[generateLessonsForGroup] Date range - today:', today, 'finalEndDate:', finalEndDate);
    
    // Get existing lessons for this group
    const existingLessons = await all<{ lesson_date: string }>(
      `SELECT lesson_date FROM lessons WHERE group_id = $1`,
      [groupId]
    );
    console.log('[generateLessonsForGroup] Existing lessons count:', existingLessons.length);
    // Convert dates to yyyy-MM-dd format for proper comparison
    // (PostgreSQL returns DATE as ISO string with time component)
    const existingDates = new Set(existingLessons.map(l => {
      const date = new Date(l.lesson_date);
      return format(date, 'yyyy-MM-dd');
    }));
    
    let generated = 0;
    let skipped = 0;
    
    // Start from group start date or today, whichever is later
    // Handle null/undefined start_date
    let currentDate: Date;
    if (!group.start_date) {
      console.log('[generateLessonsForGroup] No start_date, using today');
      currentDate = today;
    } else {
      currentDate = new Date(group.start_date);
      if (isBefore(currentDate, today)) {
        currentDate = today;
      }
    }
    
    console.log('[generateLessonsForGroup] Starting from:', currentDate, 'weekly_day:', group.weekly_day);
    
    // Validate weekly_day and adjust for JavaScript (0-6) vs database (1-7)
    const jsWeeklyDay = group.weekly_day === 7 ? 0 : group.weekly_day;
    
    if (jsWeeklyDay === undefined || jsWeeklyDay === null || jsWeeklyDay < 0 || jsWeeklyDay > 6) {
      console.error('[generateLessonsForGroup] Invalid weekly_day:', group.weekly_day, '-> jsWeeklyDay:', jsWeeklyDay);
      throw new Error('Invalid weekly_day for group: ' + group.weekly_day);
    }
    
    console.log('[generateLessonsForGroup] Finding first occurrence of day', group.weekly_day, '(JS day:', jsWeeklyDay, ')');
    
    // Find the first occurrence of the weekly_day
    while (currentDate.getDay() !== jsWeeklyDay) {
      currentDate = addDays(currentDate, 1);
    }
    
    console.log('[generateLessonsForGroup] First lesson date:', currentDate);
    
    // Generate lessons
    const lessonsToInsert: Array<[string, number, string, string, string, string, number]> = [];
    
    console.log('[generateLessonsForGroup] Starting loop, finalEndDate:', finalEndDate);
    console.log('[generateLessonsForGroup] currentDate:', currentDate, 'isAfter check:', isAfter(currentDate, finalEndDate));
    
    let lessonCount = 0;
    while (!isAfter(currentDate, finalEndDate)) {
      lessonCount++;
      if (lessonCount <= 5) {
        console.log('[generateLessonsForGroup] Processing lesson', lessonCount, 'date:', currentDate);
      }
      
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      if (!existingDates.has(dateStr)) {
        const [hours, minutes] = group.start_time.split(':').map(Number);
        
        // Create datetime in the group's timezone and convert to UTC for storage
        // This ensures consistent storage in UTC regardless of server timezone
        const groupTimezone = group.timezone || 'Europe/Kyiv';
        
        // Create a date at the start of the day in the group's timezone
        const dateInTz = toZonedTime(currentDate, groupTimezone);
        dateInTz.setHours(hours, minutes, 0, 0);
        
        // Convert to UTC (subtract the timezone offset)
        const utcDate = fromZonedTime(dateInTz, groupTimezone);
        
        // Format as UTC datetime string for database
        const startStr = format(utcDate, "yyyy-MM-dd HH:mm:ss");
        
        // End time is duration minutes after start
        const endUtcDate = new Date(utcDate.getTime() + group.duration_minutes * 60 * 1000);
        const endStr = format(endUtcDate, "yyyy-MM-dd HH:mm:ss");
        
        lessonsToInsert.push([generatePublicId('LSN'), groupId, dateStr, startStr, endStr, 'scheduled', createdBy]);
        generated++;
      } else {
        skipped++;
      }
      
      currentDate = addDays(currentDate, 7);
    }
    
    console.log('[generateLessonsForGroup] Generated', generated, 'lessons, skipped', skipped, 'total lessons processed:', lessonCount);
    
    // Insert all lessons in a transaction
    if (lessonsToInsert.length > 0) {
      console.log('[generateLessonsForGroup] Inserting', lessonsToInsert.length, 'lessons');
      await transaction(async () => {
        for (const lesson of lessonsToInsert) {
          await run(
            `INSERT INTO lessons (public_id, group_id, lesson_date, start_datetime, end_datetime, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            lesson
          );
        }
      });
    }
    
    console.log('[generateLessonsForGroup] Completed. Generated:', generated, 'Skipped:', skipped);
    
    return { generated, skipped };
  } catch (error) {
    console.error('[generateLessonsForGroup] Error:', error);
    throw error;
  }
}

// Generate lessons for all active groups
export async function generateLessonsForAllGroups(
  weeksAhead: number = 8,
  createdBy: number,
  monthsAhead: number = 1
): Promise<{ groupId: number; generated: number; skipped: number }[]> {
  console.log('[generateLessonsForAllGroups] Starting function');
  
  const groups = await all<{ id: number }>(
    `SELECT id FROM groups WHERE is_active = TRUE OR status = 'active'`
  );
  
  console.log('[generateLessonsForAllGroups] Found groups:', groups.length, 'groups:', groups);
  
  const results: { groupId: number; generated: number; skipped: number }[] = [];
  
  for (const group of groups) {
    try {
      console.log('[generateLessonsForAllGroups] Processing group:', group.id);
      
      // Check if this group already has lessons
      const existingLessons = await all<{ id: number }>(
        `SELECT id FROM lessons WHERE group_id = $1 LIMIT 1`,
        [group.id]
      );
      
      // Skip groups that already have lessons
      if (existingLessons.length > 0) {
        console.log('[generateLessonsForAllGroups] Skipping group', group.id, '- already has lessons');
        results.push({ groupId: group.id, generated: 0, skipped: 0 });
        continue;
      }
      
      const result = await generateLessonsForGroup(group.id, weeksAhead, createdBy, monthsAhead);
      results.push({ groupId: group.id, ...result });
    } catch (error) {
      console.error(`[generateLessonsForAllGroups] Error processing group ${group.id}:`, error);
      // Continue with other groups instead of failing completely
      results.push({ groupId: group.id, generated: 0, skipped: 0 });
    }
  }
  
  console.log('[generateLessonsForAllGroups] Completed. Results:', results);
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

// Get today's lessons for all groups (admin view)
export async function getTodayLessons(): Promise<Array<Lesson & { group_title: string; course_title: string; teacher_name: string; replacement_teacher_name: string | null }>> {
  const lessons = await all<Lesson & { group_title: string; course_title: string; teacher_name: string; replacement_teacher_name: string | null }>(
    `SELECT l.*, g.title as group_title, c.title as course_title, 
            u.name as teacher_name, 
            ru.name as replacement_teacher_name
     FROM lessons l
     JOIN groups g ON l.group_id = g.id
     JOIN courses c ON g.course_id = c.id
     JOIN users u ON g.teacher_id = u.id
     LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
     LEFT JOIN users ru ON ltr.replacement_teacher_id = ru.id
     WHERE l.lesson_date = CURRENT_DATE AND l.status != 'canceled'
     ORDER BY l.start_datetime ASC`
  );
  console.log('[getTodayLessons] Found lessons:', lessons.map(l => ({ id: l.id, date: l.lesson_date })));
  return lessons;
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
