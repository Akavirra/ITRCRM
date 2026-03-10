import { run, get, all, transaction } from '@/db';
import { format } from 'date-fns';

export type AttendanceStatus = 'present' | 'absent' | 'makeup_planned' | 'makeup_done';
export type StudyStatus = 'studying' | 'not_studying';

export interface AttendanceRecord {
  id: number;
  lesson_id: number;
  student_id: number;
  status: AttendanceStatus;
  comment: string | null;
  makeup_lesson_id: number | null;
  updated_by: number;
  updated_at: string;
}

export interface AttendanceWithStudent extends AttendanceRecord {
  student_name: string;
  student_phone: string | null;
}

// Get attendance for a lesson
export async function getAttendanceForLesson(lessonId: number): Promise<AttendanceWithStudent[]> {
  return await all<AttendanceWithStudent>(
    `SELECT a.*, s.full_name as student_name, s.phone as student_phone
     FROM attendance a
     JOIN students s ON a.student_id = s.id
     WHERE a.lesson_id = $1
     ORDER BY s.full_name`,
    [lessonId]
  );
}

// Get attendance for a lesson (with all students in group, or individual lesson students)
export async function getAttendanceForLessonWithStudents(lessonId: number): Promise<Array<{
  student_id: number;
  student_name: string;
  student_phone: string | null;
  attendance_id: number | null;
  status: AttendanceStatus | null;
  comment: string | null;
  makeup_lesson_id: number | null;
}>> {
  // Get the lesson's group
  const lesson = await get<{ group_id: number }>(
    `SELECT group_id FROM lessons WHERE id = $1`,
    [lessonId]
  );
  
  if (!lesson) {
    return [];
  }
  
  const groupId = lesson.group_id;
  
  // If there's a group, get students from the group
  if (groupId) {
    return await all<{
      student_id: number;
      student_name: string;
      student_phone: string | null;
      attendance_id: number | null;
      status: AttendanceStatus | null;
      comment: string | null;
      makeup_lesson_id: number | null;
    }>(
      `SELECT 
        s.id as student_id,
        s.full_name as student_name,
        s.phone as student_phone,
        a.id as attendance_id,
        a.status,
        a.comment,
        a.makeup_lesson_id
       FROM students s
       JOIN student_groups sg ON s.id = sg.student_id
       LEFT JOIN attendance a ON a.student_id = s.id AND a.lesson_id = $1
       WHERE sg.group_id = $2 AND sg.is_active = TRUE AND s.is_active = TRUE
       ORDER BY s.full_name`,
      [lessonId, groupId]
    );
  }
  
  // For individual lessons (no group), get students from attendance table
  return await all<{
    student_id: number;
    student_name: string;
    student_phone: string | null;
    attendance_id: number | null;
    status: AttendanceStatus | null;
    comment: string | null;
    makeup_lesson_id: number | null;
  }>(
    `SELECT 
      s.id as student_id,
      s.full_name as student_name,
      s.phone as student_phone,
      a.id as attendance_id,
      a.status,
      a.comment,
      a.makeup_lesson_id
     FROM students s
     JOIN attendance a ON a.student_id = s.id
     WHERE a.lesson_id = $1
     ORDER BY s.full_name`,
    [lessonId]
  );
}

// Set attendance for a student in a lesson
export async function setAttendance(
  lessonId: number,
  studentId: number,
  status: AttendanceStatus,
  updatedBy: number,
  comment?: string,
  makeupLessonId?: number
): Promise<number> {
  // Check if attendance record exists
  const existing = await get<{ id: number }>(
    `SELECT id FROM attendance WHERE lesson_id = $1 AND student_id = $2`,
    [lessonId, studentId]
  );
  
  if (existing) {
    await run(
      `UPDATE attendance SET status = $1, comment = $2, makeup_lesson_id = $3, updated_by = $4, updated_at = NOW() WHERE id = $5`,
      [status, comment || null, makeupLessonId || null, updatedBy, existing.id]
    );
    return existing.id;
  } else {
    const result = await run(
      `INSERT INTO attendance (lesson_id, student_id, status, comment, makeup_lesson_id, updated_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [lessonId, studentId, status, comment || null, makeupLessonId || null, updatedBy]
    );
    return Number(result[0]?.id);
  }
}

// Set attendance for all students in a lesson (bulk)
export async function setAttendanceForAll(
  lessonId: number,
  status: AttendanceStatus,
  updatedBy: number
): Promise<void> {
  // Get the lesson's group
  const lesson = await get<{ group_id: number }>(
    `SELECT group_id FROM lessons WHERE id = $1`,
    [lessonId]
  );
  
  if (!lesson) {
    return;
  }
  
  const groupId = lesson.group_id;
  
  // Get all students in the group
  const students = await all<{ id: number }>(
    `SELECT s.id FROM students s
     JOIN student_groups sg ON s.id = sg.student_id
     WHERE sg.group_id = $1 AND sg.is_active = TRUE AND s.is_active = TRUE`,
    [groupId]
  );
  
  await transaction(async () => {
    for (const student of students) {
      await setAttendance(lessonId, student.id, status, updatedBy);
    }
  });
}

// Copy attendance from previous lesson
export async function copyAttendanceFromPreviousLesson(
  lessonId: number,
  updatedBy: number
): Promise<{ copied: number }> {
  // Get the current lesson
  const currentLesson = await get<{ group_id: number; lesson_date: string }>(
    `SELECT group_id, lesson_date FROM lessons WHERE id = $1`,
    [lessonId]
  );
  
  if (!currentLesson) {
    return { copied: 0 };
  }
  
  // Get the previous lesson
  // Convert lesson_date to yyyy-MM-dd format for proper comparison
  // (PostgreSQL returns DATE as ISO string with time component)
  const currentLessonDate = format(new Date(currentLesson.lesson_date), 'yyyy-MM-dd');
  
  const previousLesson = await get<{ id: number }>(
    `SELECT id FROM lessons 
     WHERE group_id = $1 AND lesson_date < $2 AND status != 'canceled'
     ORDER BY lesson_date DESC LIMIT 1`,
    [currentLesson.group_id, currentLessonDate]
  );
  
  if (!previousLesson) {
    return { copied: 0 };
  }
  
  // Get attendance from previous lesson
  const previousAttendance = await all<{ student_id: number; status: AttendanceStatus; comment: string | null }>(
    `SELECT student_id, status, comment FROM attendance WHERE lesson_id = $1`,
    [previousLesson.id]
  );
  
  let copied = 0;
  
  await transaction(async () => {
    for (const att of previousAttendance) {
      await setAttendance(lessonId, att.student_id, att.status, updatedBy, att.comment || undefined);
      copied++;
    }
  });
  
  return { copied };
}

// Clear attendance for a lesson
export async function clearAttendanceForLesson(lessonId: number): Promise<void> {
  await run(`DELETE FROM attendance WHERE lesson_id = $1`, [lessonId]);
}

// Get attendance statistics for a student
export async function getStudentAttendanceStats(
  studentId: number,
  groupId?: number,
  startDate?: string,
  endDate?: string
): Promise<{
  total: number;
  present: number;
  absent: number;
  makeup_planned: number;
  makeup_done: number;
  attendance_rate: number;
}> {
  let sql = `SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
    SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
    SUM(CASE WHEN a.status = 'makeup_planned' THEN 1 ELSE 0 END) as makeup_planned,
    SUM(CASE WHEN a.status = 'makeup_done' THEN 1 ELSE 0 END) as makeup_done
   FROM attendance a
   JOIN lessons l ON a.lesson_id = l.id
   WHERE a.student_id = $1`;
  
  const params: (number | string)[] = [studentId];
  let paramIndex = 2;
  
  if (groupId) {
    sql += ` AND l.group_id = $${paramIndex++}`;
    params.push(groupId);
  }
  
  if (startDate) {
    sql += ` AND l.lesson_date >= $${paramIndex++}`;
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ` AND l.lesson_date <= $${paramIndex++}`;
    params.push(endDate);
  }
  
  const result = await get<{
    total: number;
    present: number;
    absent: number;
    makeup_planned: number;
    makeup_done: number;
  }>(sql, params);
  
  if (!result || result.total === 0) {
    return { total: 0, present: 0, absent: 0, makeup_planned: 0, makeup_done: 0, attendance_rate: 0 };
  }
  
  return {
    ...result,
    attendance_rate: Math.round((result.present / result.total) * 100)
  };
}

// Get paginated lesson attendance history for a student
export async function getStudentAttendanceLessons(
  studentId: number,
  options: {
    limit?: number;
    offset?: number;
    groupId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<{
  lessons: Array<{
    lesson_id: number;
    lesson_date: string;
    start_datetime: string | null;
    group_id: number | null;
    group_title: string | null;
    course_title: string | null;
    topic: string | null;
    status: AttendanceStatus | null;
  }>;
  total: number;
}> {
  const { limit = 50, offset = 0, groupId, status, startDate, endDate } = options;
  const params: (number | string)[] = [studentId];
  let idx = 2;
  let where = '';

  if (groupId) { where += ` AND l.group_id = $${idx++}`; params.push(groupId); }
  if (status) { where += ` AND a.status = $${idx++}`; params.push(status); }
  if (startDate) { where += ` AND l.lesson_date >= $${idx++}`; params.push(startDate); }
  if (endDate) { where += ` AND l.lesson_date <= $${idx++}`; params.push(endDate); }

  params.push(limit, offset);
  const limitIdx = idx; const offsetIdx = idx + 1;

  const rows = await all<{
    lesson_id: number;
    lesson_date: string;
    start_datetime: string | null;
    group_id: number | null;
    group_title: string | null;
    course_title: string | null;
    topic: string | null;
    status: AttendanceStatus | null;
    total_count: number;
  }>(
    `SELECT
      l.id as lesson_id,
      l.lesson_date,
      l.start_datetime,
      l.group_id,
      g.title as group_title,
      c.title as course_title,
      l.topic,
      a.status,
      COUNT(*) OVER() as total_count
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = $1
     WHERE l.status != 'canceled'
       AND (
         l.group_id IN (SELECT group_id FROM student_groups WHERE student_id = $1 AND is_active = TRUE)
         OR EXISTS (SELECT 1 FROM attendance a2 WHERE a2.lesson_id = l.id AND a2.student_id = $1)
       )
       ${where}
     ORDER BY l.lesson_date DESC, l.start_datetime DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return {
    lessons: rows.map(({ total_count: _, ...r }) => r),
    total: rows[0]?.total_count ?? 0,
  };
}

// Get per-group attendance breakdown for a student
export async function getStudentAttendanceByGroup(studentId: number): Promise<Array<{
  group_id: number;
  group_title: string;
  course_title: string | null;
  total: number;
  present: number;
  absent: number;
  makeup_planned: number;
  makeup_done: number;
  attendance_rate: number;
}>> {
  const rows = await all<{
    group_id: number;
    group_title: string;
    course_title: string | null;
    total: number;
    present: number;
    absent: number;
    makeup_planned: number;
    makeup_done: number;
  }>(
    `SELECT
      g.id as group_id,
      g.title as group_title,
      c.title as course_title,
      COUNT(l.id) as total,
      SUM(CASE WHEN a.status = 'present'       THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status = 'absent'         THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status = 'makeup_planned' THEN 1 ELSE 0 END) as makeup_planned,
      SUM(CASE WHEN a.status = 'makeup_done'    THEN 1 ELSE 0 END) as makeup_done
     FROM student_groups sg
     JOIN groups g ON sg.group_id = g.id
     LEFT JOIN courses c ON g.course_id = c.id
     JOIN lessons l ON l.group_id = g.id AND l.status != 'canceled'
     LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = $1
     WHERE sg.student_id = $1
     GROUP BY g.id, g.title, c.title
     ORDER BY g.title`,
    [studentId]
  );

  return rows.map(r => ({
    ...r,
    attendance_rate: r.total > 0 ? Math.round((r.present / r.total) * 100) : 0,
  }));
}

// Get global attendance stats per student (for the /attendance page)
export async function getGlobalAttendanceStats(options: {
  groupId?: number;
  search?: string;
  sortBy?: 'name' | 'rate' | 'absent';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
} = {}): Promise<{
  rows: Array<{
    student_id: number;
    student_name: string;
    group_id: number | null;
    group_title: string | null;
    total: number;
    present: number;
    absent: number;
    makeup_planned: number;
    makeup_done: number;
    attendance_rate: number;
  }>;
  total: number;
}> {
  const { groupId, search, sortBy = 'name', sortDir = 'asc', limit = 50, offset = 0 } = options;
  const params: (number | string)[] = [];
  let idx = 1;
  let where = 's.is_active = TRUE';

  if (groupId) { where += ` AND sg.group_id = $${idx++}`; params.push(groupId); }
  if (search) { where += ` AND s.full_name ILIKE $${idx++}`; params.push(`%${search}%`); }

  const orderMap = {
    name: 's.full_name',
    rate: 'attendance_rate',
    absent: 'absent',
  };
  const orderCol = orderMap[sortBy] ?? 's.full_name';
  const orderDir = sortDir === 'desc' ? 'DESC' : 'ASC';

  params.push(limit, offset);
  const limitIdx = idx; const offsetIdx = idx + 1;

  const rows = await all<{
    student_id: number;
    student_name: string;
    group_id: number | null;
    group_title: string | null;
    total: number;
    present: number;
    absent: number;
    makeup_planned: number;
    makeup_done: number;
    attendance_rate: number;
    total_count: number;
  }>(
    `SELECT
      s.id as student_id,
      s.full_name as student_name,
      g.id as group_id,
      g.title as group_title,
      COUNT(l.id) as total,
      SUM(CASE WHEN a.status = 'present'       THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status = 'absent'         THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status = 'makeup_planned' THEN 1 ELSE 0 END) as makeup_planned,
      SUM(CASE WHEN a.status = 'makeup_done'    THEN 1 ELSE 0 END) as makeup_done,
      CASE WHEN COUNT(l.id) > 0
        THEN ROUND(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(l.id))
        ELSE 0 END as attendance_rate,
      COUNT(*) OVER() as total_count
     FROM students s
     JOIN student_groups sg ON sg.student_id = s.id AND sg.is_active = TRUE
     JOIN groups g ON sg.group_id = g.id
     JOIN lessons l ON l.group_id = g.id AND l.status != 'canceled'
     LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = s.id
     WHERE ${where}
     GROUP BY s.id, s.full_name, g.id, g.title
     ORDER BY ${orderCol} ${orderDir}
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return {
    rows: rows.map(({ total_count: _, ...r }) => r),
    total: rows[0]?.total_count ?? 0,
  };
}

// Get global KPI totals for the attendance page header
export async function getGlobalAttendanceTotals(): Promise<{
  total_lessons: number;
  total_records: number;
  present: number;
  absent: number;
  makeup_planned: number;
  makeup_done: number;
  overall_rate: number;
  students_count: number;
}> {
  const result = await get<{
    total_lessons: number;
    total_records: number;
    present: number;
    absent: number;
    makeup_planned: number;
    makeup_done: number;
    students_count: number;
  }>(
    `SELECT
      COUNT(DISTINCT l.id) as total_lessons,
      COUNT(a.id) as total_records,
      SUM(CASE WHEN a.status = 'present'       THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status = 'absent'         THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status = 'makeup_planned' THEN 1 ELSE 0 END) as makeup_planned,
      SUM(CASE WHEN a.status = 'makeup_done'    THEN 1 ELSE 0 END) as makeup_done,
      COUNT(DISTINCT a.student_id) as students_count
     FROM lessons l
     LEFT JOIN attendance a ON a.lesson_id = l.id
     WHERE l.status != 'canceled'`,
    []
  );

  if (!result) {
    return { total_lessons: 0, total_records: 0, present: 0, absent: 0, makeup_planned: 0, makeup_done: 0, overall_rate: 0, students_count: 0 };
  }

  return {
    ...result,
    overall_rate: result.total_records > 0 ? Math.round((result.present / result.total_records) * 100) : 0,
  };
}

// Get attendance statistics for a group
export async function getGroupAttendanceStats(
  groupId: number,
  startDate?: string,
  endDate?: string
): Promise<Array<{
  student_id: number;
  student_name: string;
  total: number;
  present: number;
  absent: number;
  makeup_planned: number;
  makeup_done: number;
  attendance_rate: number;
}>> {
  let sql = `SELECT 
    s.id as student_id,
    s.full_name as student_name,
    COUNT(a.id) as total,
    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
    SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
    SUM(CASE WHEN a.status = 'makeup_planned' THEN 1 ELSE 0 END) as makeup_planned,
    SUM(CASE WHEN a.status = 'makeup_done' THEN 1 ELSE 0 END) as makeup_done
   FROM students s
   JOIN student_groups sg ON s.id = sg.student_id
   JOIN lessons l ON l.group_id = sg.group_id
   LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = s.id
   WHERE sg.group_id = $1 AND sg.is_active = TRUE AND s.is_active = TRUE`;
  
  const params: (number | string)[] = [groupId];
  let paramIndex = 2;
  
  if (startDate) {
    sql += ` AND l.lesson_date >= $${paramIndex++}`;
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ` AND l.lesson_date <= $${paramIndex++}`;
    params.push(endDate);
  }
  
  sql += ` GROUP BY s.id ORDER BY s.full_name`;
  
  const results = await all<{
    student_id: number;
    student_name: string;
    total: number;
    present: number;
    absent: number;
    makeup_planned: number;
    makeup_done: number;
  }>(sql, params);
  
  return results.map(r => ({
    ...r,
    attendance_rate: r.total > 0 ? Math.round((r.present / r.total) * 100) : 0
  }));
}

// ─── Monthly view types ────────────────────────────────────────────────────

export interface MonthlyLessonItem {
  lesson_id: number;
  lesson_date: string;
  start_datetime: string | null;
  topic: string | null;
  lesson_status: string;
  attendance_status: AttendanceStatus | null;
}

export interface MonthlyGroupAttendance {
  group_id: number | null;
  group_title: string | null;
  course_title: string | null;
  weekly_day: number | null;
  start_time: string | null;
  lessons: MonthlyLessonItem[];
  total: number;
  present: number;
  absent: number;
  not_marked: number;
  makeup: number;
  rate: number;
}

// Get all lessons for a student in a specific month, grouped by group
export async function getStudentMonthlyAttendance(
  studentId: number,
  year: number,
  month: number
): Promise<MonthlyGroupAttendance[]> {
  const rows = await all<{
    lesson_id: number;
    lesson_date: string;
    start_datetime: string | null;
    topic: string | null;
    lesson_status: string;
    group_id: number | null;
    group_title: string | null;
    course_title: string | null;
    weekly_day: number | null;
    start_time: string | null;
    attendance_status: AttendanceStatus | null;
  }>(
    `SELECT
      l.id as lesson_id,
      l.lesson_date,
      l.start_datetime,
      l.topic,
      l.status as lesson_status,
      l.group_id,
      g.title as group_title,
      c.title as course_title,
      g.weekly_day,
      g.start_time,
      a.status as attendance_status
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = $1
     WHERE l.status != 'canceled'
       AND EXTRACT(YEAR FROM l.lesson_date) = $2
       AND EXTRACT(MONTH FROM l.lesson_date) = $3
       AND (
         l.group_id IN (
           SELECT group_id FROM student_groups
           WHERE student_id = $1 AND is_active = TRUE
         )
         OR EXISTS (
           SELECT 1 FROM attendance a2
           WHERE a2.lesson_id = l.id AND a2.student_id = $1
         )
       )
     ORDER BY l.group_id NULLS LAST, l.lesson_date`,
    [studentId, year, month]
  );

  const groupsMap = new Map<number | null, MonthlyGroupAttendance>();

  for (const row of rows) {
    const key = row.group_id ?? null;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        group_id: row.group_id,
        group_title: row.group_title,
        course_title: row.course_title,
        weekly_day: row.weekly_day,
        start_time: row.start_time,
        lessons: [],
        total: 0,
        present: 0,
        absent: 0,
        not_marked: 0,
        makeup: 0,
        rate: 0,
      });
    }
    const g = groupsMap.get(key)!;
    g.lessons.push({
      lesson_id: row.lesson_id,
      lesson_date: row.lesson_date,
      start_datetime: row.start_datetime,
      topic: row.topic,
      lesson_status: row.lesson_status,
      attendance_status: row.attendance_status,
    });
    g.total++;
    if (row.attendance_status === 'present') g.present++;
    else if (row.attendance_status === 'absent') g.absent++;
    else if (row.attendance_status === 'makeup_planned' || row.attendance_status === 'makeup_done') g.makeup++;
    else g.not_marked++;
  }

  Array.from(groupsMap.values()).forEach(g => {
    g.rate = g.total > 0 ? Math.round((g.present / g.total) * 100) : 0;
  });

  return Array.from(groupsMap.values());
}

// ─── Global monthly stats ──────────────────────────────────────────────────

export interface GlobalMonthlyRow {
  student_id: number;
  student_name: string;
  group_id: number;
  group_title: string;
  course_title: string | null;
  total: number;
  present: number;
  absent: number;
  makeup_planned: number;
  makeup_done: number;
  not_marked: number;
  attendance_rate: number;
}

export async function getGlobalMonthlyStats(
  year: number,
  month: number,
  options: { groupId?: number; search?: string } = {}
): Promise<GlobalMonthlyRow[]> {
  const { groupId, search } = options;
  const params: (number | string)[] = [year, month];
  let idx = 3;
  let where = 's.is_active = TRUE';

  if (groupId) { where += ` AND sg.group_id = $${idx++}`; params.push(groupId); }
  if (search) { where += ` AND s.full_name ILIKE $${idx++}`; params.push(`%${search}%`); }

  // Group lessons
  const groupRows = await all<{
    student_id: number;
    student_name: string;
    group_id: number;
    group_title: string;
    course_title: string | null;
    total: number;
    present: number;
    absent: number;
    makeup_planned: number;
    makeup_done: number;
    not_marked: number;
  }>(
    `SELECT
      s.id as student_id,
      s.full_name as student_name,
      g.id as group_id,
      g.title as group_title,
      c.title as course_title,
      COUNT(l.id) as total,
      SUM(CASE WHEN a.status = 'present'       THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status = 'absent'         THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status = 'makeup_planned' THEN 1 ELSE 0 END) as makeup_planned,
      SUM(CASE WHEN a.status = 'makeup_done'    THEN 1 ELSE 0 END) as makeup_done,
      SUM(CASE WHEN a.status IS NULL            THEN 1 ELSE 0 END) as not_marked
     FROM students s
     JOIN student_groups sg ON sg.student_id = s.id AND sg.is_active = TRUE
     JOIN groups g ON sg.group_id = g.id
     LEFT JOIN courses c ON g.course_id = c.id
     JOIN lessons l ON l.group_id = g.id
       AND l.status != 'canceled'
       AND EXTRACT(YEAR FROM l.lesson_date) = $1
       AND EXTRACT(MONTH FROM l.lesson_date) = $2
     LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = s.id
     WHERE ${where}
     GROUP BY s.id, s.full_name, g.id, g.title, c.title
     HAVING COUNT(l.id) > 0
     ORDER BY s.full_name, g.title`,
    params
  );

  // Individual lessons (group_id IS NULL)
  let indivWhere = 's.is_active = TRUE';
  const indivParams: (number | string)[] = [year, month];
  let indivIdx = 3;
  if (search) { indivWhere += ` AND s.full_name ILIKE $${indivIdx++}`; indivParams.push(`%${search}%`); }

  const indivRows = !groupId ? await all<{
    student_id: number;
    student_name: string;
    group_id: number;
    group_title: string;
    course_title: string | null;
    total: number;
    present: number;
    absent: number;
    makeup_planned: number;
    makeup_done: number;
    not_marked: number;
  }>(
    `SELECT
      s.id as student_id,
      s.full_name as student_name,
      0 as group_id,
      'Індивідуальні' as group_title,
      c.title as course_title,
      COUNT(l.id) as total,
      SUM(CASE WHEN a.status = 'present'       THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status = 'absent'         THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status = 'makeup_planned' THEN 1 ELSE 0 END) as makeup_planned,
      SUM(CASE WHEN a.status = 'makeup_done'    THEN 1 ELSE 0 END) as makeup_done,
      SUM(CASE WHEN a.status IS NULL            THEN 1 ELSE 0 END) as not_marked
     FROM students s
     JOIN attendance a ON a.student_id = s.id
     JOIN lessons l ON a.lesson_id = l.id
       AND l.group_id IS NULL
       AND l.status != 'canceled'
       AND EXTRACT(YEAR FROM l.lesson_date) = $1
       AND EXTRACT(MONTH FROM l.lesson_date) = $2
     LEFT JOIN courses c ON l.course_id = c.id
     WHERE ${indivWhere}
     GROUP BY s.id, s.full_name, c.title
     HAVING COUNT(l.id) > 0
     ORDER BY s.full_name`,
    indivParams
  ) : [];

  const allRows = [...groupRows, ...indivRows];

  return allRows.map(r => ({
    ...r,
    attendance_rate: r.total > 0 ? Math.round((r.present / r.total) * 100) : 0,
  }));
}

export async function getGlobalMonthlyTotals(year: number, month: number): Promise<{
  total_lessons: number;
  group_lessons: number;
  individual_lessons: number;
  total_records: number;
  present: number;
  absent: number;
  makeup: number;
  not_marked: number;
  overall_rate: number;
  students_count: number;
}> {
  const result = await get<{
    total_lessons: number;
    group_lessons: number;
    individual_lessons: number;
    total_records: number;
    present: number;
    absent: number;
    makeup: number;
    not_marked: number;
    students_count: number;
  }>(
    `SELECT
      COUNT(DISTINCT l.id) as total_lessons,
      COUNT(DISTINCT CASE WHEN l.group_id IS NOT NULL THEN l.id END) as group_lessons,
      COUNT(DISTINCT CASE WHEN l.group_id IS NULL THEN l.id END) as individual_lessons,
      COUNT(a.id) as total_records,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status IN ('makeup_planned','makeup_done') THEN 1 ELSE 0 END) as makeup,
      SUM(CASE WHEN a.status IS NULL THEN 1 ELSE 0 END) as not_marked,
      COUNT(DISTINCT a.student_id) as students_count
     FROM lessons l
     LEFT JOIN attendance a ON a.lesson_id = l.id
     WHERE l.status != 'canceled'
       AND EXTRACT(YEAR FROM l.lesson_date) = $1
       AND EXTRACT(MONTH FROM l.lesson_date) = $2`,
    [year, month]
  );

  if (!result) {
    return { total_lessons: 0, group_lessons: 0, individual_lessons: 0, total_records: 0, present: 0, absent: 0, makeup: 0, not_marked: 0, overall_rate: 0, students_count: 0 };
  }
  return {
    ...result,
    overall_rate: result.total_records > 0 ? Math.round((result.present / result.total_records) * 100) : 0,
  };
}

// ─── Global monthly grouped stats (for Attendance page "По групах" view) ──

export interface GroupedMonthlyGroup {
  group_id: number;
  group_title: string;
  course_title: string | null;
  weekly_day: number | null;
  start_time: string | null;
  duration_minutes: number;
  students: Array<{
    student_id: number;
    student_name: string;
    total: number;
    present: number;
    absent: number;
    makeup: number;
    not_marked: number;
    rate: number;
  }>;
  total_lessons: number;
  avg_rate: number;
}

export interface GroupedMonthlyIndividual {
  lesson_id: number;
  lesson_date: string;
  start_time: string | null;
  topic: string | null;
  course_title: string | null;
  students: Array<{
    student_id: number;
    student_name: string;
    status: AttendanceStatus | null;
  }>;
}

export interface GroupedMonthlyResult {
  groups: GroupedMonthlyGroup[];
  individual_lessons: GroupedMonthlyIndividual[];
}

export async function getGlobalMonthlyGroupedStats(
  year: number,
  month: number,
  options: { groupId?: number; search?: string } = {}
): Promise<GroupedMonthlyResult> {
  const { groupId, search } = options;

  // --- Group lessons ---
  const gParams: (number | string)[] = [year, month];
  let gIdx = 3;
  let gWhere = 'sg.is_active = TRUE AND s.is_active = TRUE';
  if (groupId) { gWhere += ` AND g.id = $${gIdx++}`; gParams.push(groupId); }
  if (search) { gWhere += ` AND s.full_name ILIKE $${gIdx++}`; gParams.push(`%${search}%`); }

  const groupRows = await all<{
    group_id: number;
    group_title: string;
    course_title: string | null;
    weekly_day: number | null;
    start_time: string | null;
    duration_minutes: number;
    student_id: number;
    student_name: string;
    total: number;
    present: number;
    absent: number;
    makeup: number;
    not_marked: number;
  }>(
    `SELECT
      g.id as group_id,
      g.title as group_title,
      c.title as course_title,
      g.weekly_day,
      g.start_time,
      g.duration_minutes,
      s.id as student_id,
      s.full_name as student_name,
      COUNT(l.id) as total,
      SUM(CASE WHEN a.status = 'present'       THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status = 'absent'         THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status IN ('makeup_planned','makeup_done') THEN 1 ELSE 0 END) as makeup,
      SUM(CASE WHEN a.status IS NULL            THEN 1 ELSE 0 END) as not_marked
     FROM students s
     JOIN student_groups sg ON sg.student_id = s.id
     JOIN groups g ON sg.group_id = g.id
     LEFT JOIN courses c ON g.course_id = c.id
     JOIN lessons l ON l.group_id = g.id
       AND l.status != 'canceled'
       AND EXTRACT(YEAR FROM l.lesson_date) = $1
       AND EXTRACT(MONTH FROM l.lesson_date) = $2
     LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = s.id
     WHERE ${gWhere}
     GROUP BY g.id, g.title, c.title, g.weekly_day, g.start_time, g.duration_minutes, s.id, s.full_name
     HAVING COUNT(l.id) > 0
     ORDER BY g.title, s.full_name`,
    gParams
  );

  // Aggregate into groups
  const groupsMap = new Map<number, GroupedMonthlyGroup>();
  for (const row of groupRows) {
    if (!groupsMap.has(row.group_id)) {
      groupsMap.set(row.group_id, {
        group_id: row.group_id,
        group_title: row.group_title,
        course_title: row.course_title,
        weekly_day: row.weekly_day,
        start_time: row.start_time,
        duration_minutes: row.duration_minutes,
        students: [],
        total_lessons: 0,
        avg_rate: 0,
      });
    }
    const g = groupsMap.get(row.group_id)!;
    const rate = row.total > 0 ? Math.round((row.present / row.total) * 100) : 0;
    g.students.push({
      student_id: row.student_id,
      student_name: row.student_name,
      total: row.total,
      present: row.present,
      absent: row.absent,
      makeup: row.makeup,
      not_marked: row.not_marked,
      rate,
    });
    g.total_lessons = row.total; // same for all students in a group
  }

  // Compute avg rate per group
  Array.from(groupsMap.values()).forEach(g => {
    if (g.students.length > 0) {
      g.avg_rate = Math.round(g.students.reduce((sum: number, st: { rate: number }) => sum + st.rate, 0) / g.students.length);
    }
  });

  // --- Individual lessons ---
  let indivLessons: GroupedMonthlyIndividual[] = [];
  if (!groupId) {
    const iParams: (number | string)[] = [year, month];
    let iWhere = `l.group_id IS NULL AND l.status != 'canceled'
       AND EXTRACT(YEAR FROM l.lesson_date) = $1
       AND EXTRACT(MONTH FROM l.lesson_date) = $2`;

    const lessonRows = await all<{
      lesson_id: number;
      lesson_date: string;
      start_time_formatted: string | null;
      topic: string | null;
      course_title: string | null;
      student_id: number;
      student_name: string;
      att_status: AttendanceStatus | null;
    }>(
      `SELECT
        l.id as lesson_id,
        l.lesson_date,
        TO_CHAR(l.start_datetime AT TIME ZONE 'Europe/Kyiv', 'HH24:MI') as start_time_formatted,
        l.topic,
        c.title as course_title,
        s.id as student_id,
        s.full_name as student_name,
        a.status as att_status
       FROM lessons l
       LEFT JOIN courses c ON l.course_id = c.id
       JOIN attendance a ON a.lesson_id = l.id
       JOIN students s ON a.student_id = s.id
       WHERE ${iWhere}
       ORDER BY l.lesson_date, l.start_datetime, s.full_name`,
      iParams
    );

    const lessonMap = new Map<number, GroupedMonthlyIndividual>();
    for (const row of lessonRows) {
      if (!lessonMap.has(row.lesson_id)) {
        lessonMap.set(row.lesson_id, {
          lesson_id: row.lesson_id,
          lesson_date: row.lesson_date,
          start_time: row.start_time_formatted,
          topic: row.topic,
          course_title: row.course_title,
          students: [],
        });
      }
      const lesson = lessonMap.get(row.lesson_id)!;
      if (!search || row.student_name.toLowerCase().includes(search.toLowerCase())) {
        lesson.students.push({
          student_id: row.student_id,
          student_name: row.student_name,
          status: row.att_status,
        });
      }
    }
    // Filter out lessons with no matching students after search
    indivLessons = Array.from(lessonMap.values()).filter(l => l.students.length > 0);
  }

  return {
    groups: Array.from(groupsMap.values()),
    individual_lessons: indivLessons,
  };
}

// ─── Group register (matrix view) ─────────────────────────────────────────

export interface GroupRegisterLesson {
  lesson_id: number;
  lesson_date: string;
  topic: string | null;
}

export interface GroupRegisterStudent {
  student_id: number;
  student_name: string;
  attendance: Record<number, AttendanceStatus | null>;
  present: number;
  absent: number;
  not_marked: number;
  rate: number;
}

export interface GroupRegister {
  lessons: GroupRegisterLesson[];
  students: GroupRegisterStudent[];
}

export async function getGroupMonthlyRegister(
  groupId: number,
  year: number,
  month: number
): Promise<GroupRegister> {
  const lessons = await all<{ lesson_id: number; lesson_date: string; topic: string | null }>(
    `SELECT id as lesson_id, lesson_date, topic
     FROM lessons
     WHERE group_id = $1
       AND status != 'canceled'
       AND EXTRACT(YEAR FROM lesson_date) = $2
       AND EXTRACT(MONTH FROM lesson_date) = $3
     ORDER BY lesson_date`,
    [groupId, year, month]
  );

  if (lessons.length === 0) return { lessons: [], students: [] };

  const students = await all<{ student_id: number; student_name: string }>(
    `SELECT s.id as student_id, s.full_name as student_name
     FROM students s
     JOIN student_groups sg ON sg.student_id = s.id
     WHERE sg.group_id = $1 AND sg.is_active = TRUE AND s.is_active = TRUE
     ORDER BY s.full_name`,
    [groupId]
  );

  if (students.length === 0) return { lessons, students: [] };

  const lessonIdList = lessons.map(l => l.lesson_id).join(',');
  const attendance = await all<{ lesson_id: number; student_id: number; status: AttendanceStatus }>(
    `SELECT lesson_id, student_id, status
     FROM attendance
     WHERE lesson_id IN (${lessonIdList})`,
    []
  );

  const attMap = new Map<string, AttendanceStatus>();
  for (const att of attendance) {
    attMap.set(`${att.lesson_id}-${att.student_id}`, att.status);
  }

  const studentRows: GroupRegisterStudent[] = students.map(s => {
    const att: Record<number, AttendanceStatus | null> = {};
    let present = 0, absent = 0, not_marked = 0;
    for (const l of lessons) {
      const status = attMap.get(`${l.lesson_id}-${s.student_id}`) ?? null;
      att[l.lesson_id] = status;
      if (status === 'present') present++;
      else if (status === 'absent' || status === 'makeup_planned' || status === 'makeup_done') absent++;
      else not_marked++;
    }
    return {
      student_id: s.student_id,
      student_name: s.student_name,
      attendance: att,
      present,
      absent,
      not_marked,
      rate: lessons.length > 0 ? Math.round((present / lessons.length) * 100) : 0,
    };
  });

  return { lessons, students: studentRows };
}
