import { run, get, all, transaction } from '@/db';

export type AttendanceStatus = 'present' | 'absent' | 'makeup_planned' | 'makeup_done';

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
export function getAttendanceForLesson(lessonId: number): AttendanceWithStudent[] {
  return all<AttendanceWithStudent>(
    `SELECT a.*, s.full_name as student_name, s.phone as student_phone
     FROM attendance a
     JOIN students s ON a.student_id = s.id
     WHERE a.lesson_id = ?
     ORDER BY s.full_name`,
    [lessonId]
  );
}

// Get attendance for a lesson (with all students in group, even if no record yet)
export function getAttendanceForLessonWithStudents(lessonId: number): Array<{
  student_id: number;
  student_name: string;
  student_phone: string | null;
  attendance_id: number | null;
  status: AttendanceStatus | null;
  comment: string | null;
  makeup_lesson_id: number | null;
}> {
  // Get the lesson's group
  const lesson = get<{ group_id: number }>(
    `SELECT group_id FROM lessons WHERE id = ?`,
    [lessonId]
  );
  
  if (!lesson) {
    return [];
  }
  
  // Get all students in the group with their attendance for this lesson
  return all<{
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
     LEFT JOIN attendance a ON a.student_id = s.id AND a.lesson_id = ?
     WHERE sg.group_id = ? AND sg.is_active = 1 AND s.is_active = 1
     ORDER BY s.full_name`,
    [lessonId, lesson.group_id]
  );
}

// Set attendance for a student in a lesson
export function setAttendance(
  lessonId: number,
  studentId: number,
  status: AttendanceStatus,
  updatedBy: number,
  comment?: string,
  makeupLessonId?: number
): number {
  // Check if attendance record exists
  const existing = get<{ id: number }>(
    `SELECT id FROM attendance WHERE lesson_id = ? AND student_id = ?`,
    [lessonId, studentId]
  );
  
  if (existing) {
    run(
      `UPDATE attendance SET status = ?, comment = ?, makeup_lesson_id = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, comment || null, makeupLessonId || null, updatedBy, existing.id]
    );
    return existing.id;
  } else {
    const result = run(
      `INSERT INTO attendance (lesson_id, student_id, status, comment, makeup_lesson_id, updated_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [lessonId, studentId, status, comment || null, makeupLessonId || null, updatedBy]
    );
    return result.lastInsertRowid;
  }
}

// Set attendance for all students in a lesson (bulk)
export function setAttendanceForAll(
  lessonId: number,
  status: AttendanceStatus,
  updatedBy: number
): void {
  // Get the lesson's group
  const lesson = get<{ group_id: number }>(
    `SELECT group_id FROM lessons WHERE id = ?`,
    [lessonId]
  );
  
  if (!lesson) {
    return;
  }
  
  // Get all students in the group
  const students = all<{ id: number }>(
    `SELECT s.id FROM students s
     JOIN student_groups sg ON s.id = sg.student_id
     WHERE sg.group_id = ? AND sg.is_active = 1 AND s.is_active = 1`,
    [lesson.group_id]
  );
  
  transaction(() => {
    for (const student of students) {
      setAttendance(lessonId, student.id, status, updatedBy);
    }
  });
}

// Copy attendance from previous lesson
export function copyAttendanceFromPreviousLesson(
  lessonId: number,
  updatedBy: number
): { copied: number } {
  // Get the current lesson
  const currentLesson = get<{ group_id: number; lesson_date: string }>(
    `SELECT group_id, lesson_date FROM lessons WHERE id = ?`,
    [lessonId]
  );
  
  if (!currentLesson) {
    return { copied: 0 };
  }
  
  // Get the previous lesson
  const previousLesson = get<{ id: number }>(
    `SELECT id FROM lessons 
     WHERE group_id = ? AND lesson_date < ? AND status != 'canceled'
     ORDER BY lesson_date DESC LIMIT 1`,
    [currentLesson.group_id, currentLesson.lesson_date]
  );
  
  if (!previousLesson) {
    return { copied: 0 };
  }
  
  // Get attendance from previous lesson
  const previousAttendance = all<{ student_id: number; status: AttendanceStatus; comment: string | null }>(
    `SELECT student_id, status, comment FROM attendance WHERE lesson_id = ?`,
    [previousLesson.id]
  );
  
  let copied = 0;
  
  transaction(() => {
    for (const att of previousAttendance) {
      setAttendance(lessonId, att.student_id, att.status, updatedBy, att.comment || undefined);
      copied++;
    }
  });
  
  return { copied };
}

// Clear attendance for a lesson
export function clearAttendanceForLesson(lessonId: number): void {
  run(`DELETE FROM attendance WHERE lesson_id = ?`, [lessonId]);
}

// Get attendance statistics for a student
export function getStudentAttendanceStats(
  studentId: number,
  groupId?: number,
  startDate?: string,
  endDate?: string
): {
  total: number;
  present: number;
  absent: number;
  makeup_planned: number;
  makeup_done: number;
  attendance_rate: number;
} {
  let sql = `SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
    SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
    SUM(CASE WHEN a.status = 'makeup_planned' THEN 1 ELSE 0 END) as makeup_planned,
    SUM(CASE WHEN a.status = 'makeup_done' THEN 1 ELSE 0 END) as makeup_done
   FROM attendance a
   JOIN lessons l ON a.lesson_id = l.id
   WHERE a.student_id = ?`;
  
  const params: (number | string)[] = [studentId];
  
  if (groupId) {
    sql += ` AND l.group_id = ?`;
    params.push(groupId);
  }
  
  if (startDate) {
    sql += ` AND l.lesson_date >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ` AND l.lesson_date <= ?`;
    params.push(endDate);
  }
  
  const result = get<{
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

// Get attendance statistics for a group
export function getGroupAttendanceStats(
  groupId: number,
  startDate?: string,
  endDate?: string
): Array<{
  student_id: number;
  student_name: string;
  total: number;
  present: number;
  absent: number;
  makeup_planned: number;
  makeup_done: number;
  attendance_rate: number;
}> {
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
   WHERE sg.group_id = ? AND sg.is_active = 1 AND s.is_active = 1`;
  
  const params: (number | string)[] = [groupId];
  
  if (startDate) {
    sql += ` AND l.lesson_date >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ` AND l.lesson_date <= ?`;
    params.push(endDate);
  }
  
  sql += ` GROUP BY s.id ORDER BY s.full_name`;
  
  const results = all<{
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