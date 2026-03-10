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
