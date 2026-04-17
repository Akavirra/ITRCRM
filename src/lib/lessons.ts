import { run, get, all, transaction } from '@/db';
import { addDays, addMonths, setHours, setMinutes, format, parse, isAfter, isBefore, startOfDay, endOfMonth } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';
import { formatShortDateKyiv } from '@/lib/date-utils';
import { deleteLessonPhotoFolder } from '@/lib/lesson-photos';

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
  original_date?: string | null;
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
  try {
    const group = await get<Group>(
      `SELECT id, weekly_day, start_time, duration_minutes, timezone, start_date, end_date
       FROM groups WHERE id = $1`,
      [groupId]
    );

    if (!group) {
      throw new Error('Group not found');
    }

    // Validate required fields
    if (!group.start_time) {
      throw new Error('Missing start_time for group');
    }
    
    const today = startOfDay(new Date());
    
    // Calculate target end date based on monthsAhead
    // monthsAhead = 1 means current month + next month (end of next month)
    const targetEndDate = endOfMonth(addMonths(today, monthsAhead));
    const endDate = group.end_date ? new Date(group.end_date) : targetEndDate;
    
    // Use the earlier of group end date or target end date
    const finalEndDate = group.end_date && isBefore(endDate, targetEndDate) ? endDate : targetEndDate;
    
    // Get existing lessons for this group (only scheduled and done, not canceled)
    const existingLessons = await all<{ lesson_date: string, original_date: string | null }>(
      `SELECT lesson_date, original_date FROM lessons WHERE group_id = $1 AND status != 'canceled'`,
      [groupId]
    );
    // Convert dates to yyyy-MM-dd format for proper comparison
    // (PostgreSQL returns DATE as ISO string with time component)
    const existingDates = new Set();
    existingLessons.forEach(l => {
      const date = new Date(l.lesson_date);
      existingDates.add(format(date, 'yyyy-MM-dd'));
      if (l.original_date) {
        const origDate = new Date(l.original_date);
        existingDates.add(format(origDate, 'yyyy-MM-dd'));
      }
    });
    
    let generated = 0;
    let skipped = 0;
    
    // Start from group start date or today, whichever is later
    // Handle null/undefined start_date
    let currentDate: Date;
    if (!group.start_date) {
      currentDate = today;
    } else {
      currentDate = new Date(group.start_date);
      if (isBefore(currentDate, today)) {
        currentDate = today;
      }
    }
    
    // Validate weekly_day and adjust for JavaScript (0-6) vs database (1-7)
    const jsWeeklyDay = group.weekly_day === 7 ? 0 : group.weekly_day;

    if (jsWeeklyDay === undefined || jsWeeklyDay === null || jsWeeklyDay < 0 || jsWeeklyDay > 6) {
      throw new Error('Invalid weekly_day for group: ' + group.weekly_day);
    }
    
    // Find the first occurrence of the weekly_day
    while (currentDate.getDay() !== jsWeeklyDay) {
      currentDate = addDays(currentDate, 1);
    }
    
    // Generate lessons
    const lessonsToInsert: Array<[string, number, string, string, string, string, number]> = [];
    
    while (!isAfter(currentDate, finalEndDate)) {
      
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      if (!existingDates.has(dateStr)) {
        const [hours, minutes] = group.start_time.split(':').map(Number);
        
        // Create datetime in the group's timezone and convert to UTC for storage
        // This ensures consistent storage in UTC regardless of server timezone
        const groupTimezone = group.timezone || 'Europe/Kyiv';
        
        // Create a date with the correct local time in the group's timezone
        const localDate = new Date(currentDate);
        localDate.setHours(hours, minutes, 0, 0);
        
        // Convert to the group's timezone and then to UTC
        const utcDate = fromZonedTime(localDate, groupTimezone);
        
        // Format as UTC datetime string for database (always UTC regardless of server timezone)
        const startStr = formatInTimeZone(utcDate, 'UTC', "yyyy-MM-dd HH:mm:ss");

        // End time is duration minutes after start
        const endUtcDate = new Date(utcDate.getTime() + group.duration_minutes * 60 * 1000);
        const endStr = formatInTimeZone(endUtcDate, 'UTC', "yyyy-MM-dd HH:mm:ss");
        
        lessonsToInsert.push([generatePublicId('LSN'), groupId, dateStr, startStr, endStr, 'scheduled', createdBy]);
        generated++;
      } else {
        skipped++;
      }
      
      currentDate = addDays(currentDate, 7);
    }
    
    // Batch insert all lessons in a single query (atomic)
    if (lessonsToInsert.length > 0) {
      const placeholders: string[] = [];
      const params: unknown[] = [];
      for (let i = 0; i < lessonsToInsert.length; i++) {
        const offset = i * 7;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
        params.push(...lessonsToInsert[i]);
      }
      await run(
        `INSERT INTO lessons (public_id, group_id, lesson_date, start_datetime, end_datetime, status, created_by)
         VALUES ${placeholders.join(', ')}`,
        params
      );
    }
    
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
  const groups = await all<{ id: number }>(
    `SELECT id FROM groups WHERE is_active = TRUE AND status = 'active'`
  );

  const results: { groupId: number; generated: number; skipped: number }[] = [];

  for (const group of groups) {
    try {
      const result = await generateLessonsForGroup(group.id, weeksAhead, createdBy, monthsAhead);
      results.push({ groupId: group.id, ...result });
    } catch (error) {
      console.error(`[generateLessonsForAllGroups] Error processing group ${group.id}:`, error);
      // Continue with other groups instead of failing completely
      results.push({ groupId: group.id, generated: 0, skipped: 0 });
    }
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

// Get upcoming lessons for all groups (admin view) - supports both group and individual lessons
export async function getUpcomingLessons(limit: number = 10): Promise<Array<Lesson & { group_title: string | null; course_title: string | null; teacher_name: string | null }>> {
  return await all<Lesson & { group_title: string | null; course_title: string | null; teacher_name: string | null }>(
    `SELECT l.*, g.title as group_title, c.title as course_title, COALESCE(u.name, l_teacher.name) as teacher_name
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     LEFT JOIN users u ON g.teacher_id = u.id
     LEFT JOIN users l_teacher ON l.teacher_id = l_teacher.id
     WHERE l.lesson_date >= CURRENT_DATE AND l.status != 'canceled'
     ORDER BY l.lesson_date ASC
     LIMIT $1`,
    [limit]
  );
}

// Get today's lessons for all groups (admin view) - supports both group and individual lessons
export async function getTodayLessons(): Promise<Array<Lesson & { group_title: string | null; course_title: string | null; teacher_name: string | null; replacement_teacher_name: string | null }>> {
  const lessons = await all<Lesson & { group_title: string | null; course_title: string | null; teacher_name: string | null; replacement_teacher_name: string | null }>(
    `SELECT l.*, g.title as group_title, c.title as course_title, 
            COALESCE(u.name, l_teacher.name) as teacher_name, 
            ru.name as replacement_teacher_name
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     LEFT JOIN users u ON g.teacher_id = u.id
     LEFT JOIN users l_teacher ON l.teacher_id = l_teacher.id
     LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
     LEFT JOIN users ru ON ltr.replacement_teacher_id = ru.id
     WHERE l.lesson_date = CURRENT_DATE AND l.status != 'canceled'
     ORDER BY l.start_datetime ASC`
  );
  return lessons;
}

// Cancel lesson
export async function cancelLesson(lessonId: number): Promise<void> {
  await run(
    `UPDATE lessons SET status = 'canceled', updated_at = NOW() WHERE id = $1`,
    [lessonId]
  );

  try {
    await deleteLessonPhotoFolder(lessonId, { id: null, name: 'System', via: 'admin' });
  } catch (error) {
    console.error('Failed to delete lesson photo folder on cancel:', error);
  }
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

// Reschedule lesson
export async function rescheduleLesson(
  lessonId: number,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
  timezone: string = 'Europe/Kyiv'
): Promise<void> {
  // First get the current lesson to see if original_date is already set
  const currentLesson = await get<{ lesson_date: string, original_date: string | null }>(
    `SELECT lesson_date, original_date FROM lessons WHERE id = $1`,
    [lessonId]
  );
  
  if (!currentLesson) {
    throw new Error('Lesson not found');
  }
  
  // Set original_date only if it's the first time rescheduling
  const originalDate = currentLesson.original_date || format(new Date(currentLesson.lesson_date), 'yyyy-MM-dd');

  // Parse new start time
  const [startHours, startMinutes] = newStartTime.split(':').map(Number);
  const startLocal = new Date(newDate);
  startLocal.setHours(startHours, startMinutes, 0, 0);
  const startUtc = fromZonedTime(startLocal, timezone);
  const startStr = formatInTimeZone(startUtc, 'UTC', 'yyyy-MM-dd HH:mm:ss');

  // Parse new end time
  const [endHours, endMinutes] = newEndTime.split(':').map(Number);
  const endLocal = new Date(newDate);
  endLocal.setHours(endHours, endMinutes, 0, 0);
  const endUtc = fromZonedTime(endLocal, timezone);
  const endStr = formatInTimeZone(endUtc, 'UTC', 'yyyy-MM-dd HH:mm:ss');

  await run(
    `UPDATE lessons 
     SET lesson_date = $1, 
         start_datetime = $2, 
         end_datetime = $3, 
         original_date = $4,
         updated_at = NOW() 
     WHERE id = $5`,
    [newDate, startStr, endStr, originalDate, lessonId]
  );
}

// Auto-cancel lesson if all students are absent.
// Returns true if the lesson was cancelled.
export async function checkAndAutoCancelLesson(
  lessonId: number,
  userId: number,
  userName: string,
  source: 'admin' | 'telegram' = 'admin',
  telegramId?: string
): Promise<boolean> {
  const lesson = await get<{ status: string; group_id: number | null; notes: string | null }>(
    `SELECT status, group_id, notes FROM lessons WHERE id = $1`,
    [lessonId]
  );

  if (!lesson || lesson.status !== 'scheduled') return false;

  // For group lessons: total = regular roster size + trial visitors attached
  // via attendance.is_trial = TRUE. Trial visitors should count toward the
  // auto-cancel threshold just like regular students.
  const counts = lesson.group_id !== null
    ? await get<{ total: number; absent: number; recorded: number }>(
        `SELECT
          (
            (SELECT COUNT(*) FROM student_groups WHERE group_id = $2 AND is_active = TRUE)
            +
            (SELECT COUNT(*) FROM attendance a
              WHERE a.lesson_id = $1 AND a.is_trial = TRUE
                AND a.student_id NOT IN (
                  SELECT student_id FROM student_groups
                  WHERE group_id = $2 AND is_active = TRUE
                ))
          ) as total,
          (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1 AND status IN ('absent', 'makeup_planned')) as absent,
          (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1 AND status IS NOT NULL) as recorded`,
        [lessonId, lesson.group_id]
      )
    : await get<{ total: number; absent: number; recorded: number }>(
        `SELECT
          (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1) as total,
          (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1 AND status IN ('absent', 'makeup_planned')) as absent,
          (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1 AND status IS NOT NULL) as recorded`,
        [lessonId]
      );

  if (!counts || Number(counts.total) === 0) return false;
  if (Number(counts.recorded) < Number(counts.total)) return false;
  if (Number(counts.absent) < Number(counts.total)) return false;

  // All students absent вЂ” cancel the lesson and add a note
  const cancelNote = 'РђРІС‚РѕРјР°С‚РёС‡РЅРѕ СЃРєР°СЃРѕРІР°РЅРѕ: РІСЃС– СѓС‡РЅС– РІС–РґСЃСѓС‚РЅС–';
  const newNotes = lesson.notes ? `${lesson.notes}\n${cancelNote}` : cancelNote;

  await run(
    `UPDATE lessons SET status = 'canceled', notes = $1, updated_at = NOW() WHERE id = $2`,
    [newNotes, lessonId]
  );

  try {
    await deleteLessonPhotoFolder(lessonId, {
      id: userId,
      name: userName,
      via: source,
      telegramId: telegramId ?? null,
    });
  } catch (error) {
    console.error('Failed to delete lesson photo folder on auto-cancel:', error);
  }

  await logLessonChange(lessonId, 'notes', lesson.notes ?? null, cancelNote, userId, userName, source, telegramId ?? null);

  return true;
}

// Log lesson change to history table
export async function logLessonChange(
  lessonId: number,
  fieldName: 'topic' | 'notes' | 'attendance' | 'photos',
  oldValue: string | null,
  newValue: string | null,
  changedBy: number | null,
  changedByName: string | null,
  changedVia: 'admin' | 'telegram' = 'admin',
  changedByTelegramId: string | null = null
): Promise<void> {
  // Only log if there's an actual change (skip for attendance which always has a change)
  if (fieldName !== 'attendance' && oldValue === newValue) return;
  
  await run(
    `INSERT INTO lesson_change_logs 
     (lesson_id, field_name, old_value, new_value, changed_by, changed_by_name, changed_by_telegram_id, changed_via)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [lessonId, fieldName, oldValue || null, newValue || null, changedBy, changedByName, changedByTelegramId, changedVia]
  );

  try {
    const lesson = await get<{
      public_id: string | null;
      lesson_date: string;
      group_id: number | null;
      group_title: string | null;
      group_public_id: string | null;
      course_title: string | null;
    }>(
      `SELECT
        l.public_id,
        l.lesson_date::text as lesson_date,
        l.group_id,
        g.title as group_title,
        g.public_id as group_public_id,
        c.title as course_title
       FROM lessons l
       LEFT JOIN groups g ON l.group_id = g.id
       LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
       WHERE l.id = $1`,
      [lessonId]
    );

    if (lesson) {
      const lessonDateLabel = formatShortDateKyiv(lesson.lesson_date);
      const entityTitle = lesson.group_title
        ? `${lesson.group_title} · ${lessonDateLabel}`
        : `Індивідуальне заняття · ${lessonDateLabel}`;
      const eventType = `lesson_${fieldName}_updated`;
      const description = fieldName === 'topic'
        ? `Оновлено тему заняття${newValue ? `: ${newValue}` : ''}`
        : fieldName === 'notes'
          ? 'Оновлено нотатки заняття'
          : fieldName === 'photos'
            ? 'Оновлено фото заняття'
            : newValue || 'Оновлено відвідуваність заняття';

      await safeAddAuditEvent({
        entityType: 'lesson',
        entityId: lessonId,
        entityPublicId: lesson.public_id ?? null,
        entityTitle,
        eventType,
        eventBadge: toAuditBadge(fieldName),
        description,
        userId: changedBy ?? null,
        userName: changedByName || (changedVia === 'telegram' ? 'Telegram' : 'Система'),
        groupId: lesson.group_id ?? null,
        lessonId,
        metadata: {
          source: 'lesson_change_logs',
          fieldName,
          oldValue: oldValue ?? null,
          newValue: newValue ?? null,
          changedVia,
          changedByTelegramId: changedByTelegramId ?? null,
          groupPublicId: lesson.group_public_id ?? null,
          courseTitle: lesson.course_title ?? null,
        },
      });
    }
  } catch (error) {
    console.error('[lessons] Failed to mirror audit event:', error);
  }
}

// Get lesson change history
export async function getLessonChangeHistory(
  lessonId: number
): Promise<Array<{
  id: number;
  lesson_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: number | null;
  changed_by_name: string | null;
  changed_by_telegram_id: string | null;
  changed_via: string;
  created_at: string;
}>> {
  const history = await all(
    `SELECT * FROM lesson_change_logs 
     WHERE lesson_id = $1 
     ORDER BY created_at DESC`,
    [lessonId]
  );
  
  // Format created_at to Ukrainian date/time format
  return history.map((entry: any) => ({
    ...entry,
    created_at: format(new Date(entry.created_at), 'dd.MM.yyyy HH:mm')
  }));
}

export interface ManualLessonSlot {
  lessonDate: string;
  startTime: string;
  durationMinutes: number;
}

interface NormalizedManualLessonSlot extends ManualLessonSlot {
  startUtc: Date;
  endUtc: Date;
  startStr: string;
  endStr: string;
}

export interface TeacherLessonConflict {
  id: number;
  lesson_date: string;
  start_time: string;
  end_time: string;
  group_title: string | null;
  course_title: string | null;
}

function normalizeManualLessonSlot(
  slot: ManualLessonSlot,
  timezone: string
): NormalizedManualLessonSlot {
  const [hours, minutes] = slot.startTime.split(':').map(Number);
  const localDate = new Date(slot.lessonDate);
  localDate.setHours(hours, minutes, 0, 0);

  const startUtc = fromZonedTime(localDate, timezone);
  const endUtc = new Date(startUtc.getTime() + slot.durationMinutes * 60 * 1000);

  return {
    ...slot,
    startUtc,
    endUtc,
    startStr: formatInTimeZone(startUtc, 'UTC', 'yyyy-MM-dd HH:mm:ss'),
    endStr: formatInTimeZone(endUtc, 'UTC', 'yyyy-MM-dd HH:mm:ss'),
  };
}

function rangesOverlap(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date
): boolean {
  return leftStart < rightEnd && leftEnd > rightStart;
}

export async function findTeacherScheduleConflicts(
  teacherId: number,
  slots: ManualLessonSlot[],
  timezone: string = 'Europe/Kyiv'
): Promise<TeacherLessonConflict[]> {
  if (slots.length === 0) {
    return [];
  }

  const normalizedSlots = slots.map(slot => normalizeManualLessonSlot(slot, timezone));
  const orderedDates = normalizedSlots
    .map(slot => slot.lessonDate)
    .sort((left, right) => left.localeCompare(right));

  const minDate = orderedDates[0];
  const maxDate = orderedDates[orderedDates.length - 1];

  const existingLessons = await all<{
    id: number;
    lesson_date: string;
    start_datetime: string;
    end_datetime: string;
    start_time: string;
    end_time: string;
    group_title: string | null;
    course_title: string | null;
  }>(
    `SELECT
       l.id,
       l.lesson_date::text as lesson_date,
       l.start_datetime,
       l.end_datetime,
       TO_CHAR(l.start_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as start_time,
       TO_CHAR(l.end_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as end_time,
       g.title as group_title,
       c.title as course_title
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     WHERE l.status != 'canceled'
       AND COALESCE(l.teacher_id, g.teacher_id) = $1
       AND l.lesson_date BETWEEN $2 AND $3`,
    [teacherId, minDate, maxDate]
  );

  const conflicts: TeacherLessonConflict[] = [];

  for (const existing of existingLessons) {
    const existingStart = new Date(existing.start_datetime);
    const existingEnd = new Date(existing.end_datetime);

    if (
      normalizedSlots.some(slot =>
        rangesOverlap(slot.startUtc, slot.endUtc, existingStart, existingEnd)
      )
    ) {
      conflicts.push({
        id: existing.id,
        lesson_date: existing.lesson_date,
        start_time: existing.start_time,
        end_time: existing.end_time,
        group_title: existing.group_title,
        course_title: existing.course_title,
      });
    }
  }

  return conflicts;
}

// Create a single lesson (for admin manual scheduling)
export async function createSingleLesson(
  lessonData: {
    groupId?: number | null;  // Optional - can be null for individual lessons
    courseId?: number | null;  // Optional - for individual lessons
    lessonDate: string; // YYYY-MM-DD
    startTime: string; // HH:MM
    durationMinutes: number;
    teacherId?: number;
    isTrial?: boolean;
  },
  createdBy: number
): Promise<{ id: number; publicId: string }> {
  const { groupId, courseId, lessonDate, startTime, durationMinutes, teacherId, isTrial } = lessonData;
  
  // Get group details (if group is provided)
  let group = null;
  let timezone = 'Europe/Kyiv';
  
  if (groupId) {
    group = await get<{
      id: number;
      title: string;
      course_id: number;
      teacher_id: number;
      timezone: string;
    }>(
      `SELECT id, title, course_id, teacher_id, timezone FROM groups WHERE id = $1`,
      [groupId]
    );
    
    if (!group) {
      throw new Error('Р“СЂСѓРїСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ');
    }
    
    timezone = group.timezone || 'Europe/Kyiv';
  }

  const normalizedSlot = normalizeManualLessonSlot(
    { lessonDate, startTime, durationMinutes },
    timezone
  );
  
  // Generate public ID
  const publicId = generatePublicId('LSN');
  
  // Determine teacher ID: use provided teacherId, or group teacher, or null
  const finalTeacherId = teacherId || (group ? group.teacher_id : null);
  
  // Determine course ID: use provided courseId, or get from group, or null
  const finalCourseId = courseId || (group ? group.course_id : null);
  
  // Insert lesson (groupId can be null for individual lessons)
  const result = await get<{ id: number }>(
    `INSERT INTO lessons (public_id, group_id, course_id, lesson_date, start_datetime, end_datetime, status, created_by, teacher_id, is_trial)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [publicId, groupId || null, finalCourseId, lessonDate, normalizedSlot.startStr, normalizedSlot.endStr, 'scheduled', createdBy, finalTeacherId, isTrial ?? false]
  );
  
  return {
    id: result?.id || 0,
    publicId
  };
}

export async function createLessonsBatch(
  lessonData: {
    groupId?: number | null;
    courseId?: number | null;
    teacherId?: number;
    isTrial?: boolean;
    slots: ManualLessonSlot[];
  },
  createdBy: number
): Promise<Array<{ id: number; publicId: string; lessonDate: string; startTime: string }>> {
  const createdLessons: Array<{ id: number; publicId: string; lessonDate: string; startTime: string }> = [];

  for (const slot of lessonData.slots) {
    const lesson = await createSingleLesson(
      {
        groupId: lessonData.groupId,
        courseId: lessonData.courseId,
        lessonDate: slot.lessonDate,
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
        teacherId: lessonData.teacherId,
        isTrial: lessonData.isTrial,
      },
      createdBy
    );

    createdLessons.push({
      ...lesson,
      lessonDate: slot.lessonDate,
      startTime: slot.startTime,
    });
  }

  return createdLessons;
}

// Create an individual (ad-hoc) group for selected students
export async function createIndividualGroup(
  groupData: {
    title: string;
    courseId: number;
    teacherId: number;
    studentIds: number[];
    createdBy?: number;
  }
): Promise<{ id: number }> {
  const { title, courseId, teacherId, studentIds, createdBy } = groupData;
  
  const publicId = generatePublicId('GRP');
  
  const groupIdResult = await get<{ id: number }>(
    `INSERT INTO groups (public_id, title, course_id, teacher_id, status, is_active, weekly_day, start_time, duration_minutes, created_by)
     VALUES ($1, $2, $3, $4, 'active', TRUE, 1, '00:00', 60, $5)
     RETURNING id`,
    [publicId, title, courseId, teacherId, createdBy || null]
  );
  
  const groupId = groupIdResult?.id || 0;
  
  // Add students to group
  if (studentIds.length > 0) {
    for (const studentId of studentIds) {
      await run(
        `INSERT INTO student_groups (group_id, student_id)
         VALUES ($1, $2)`,
        [groupId, studentId]
      );
    }
  }
  
  return { id: groupId };
}
