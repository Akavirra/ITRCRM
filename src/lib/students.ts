import { run, get, all } from '@/db';
import { generateUniquePublicId } from './public-id';

export interface Student {
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface StudentWithGroups extends Student {
  groups: Array<{
    id: number;
    title: string;
    course_title: string;
    join_date: string;
  }>;
}

export interface StudentWithDebt extends Student {
  group_id: number;
  group_title: string;
  monthly_price: number;
  month: string;
  paid_amount: number;
  debt: number;
}

// Get all students
export function getStudents(includeInactive: boolean = false): Student[] {
  const sql = includeInactive
    ? `SELECT * FROM students ORDER BY full_name`
    : `SELECT * FROM students WHERE is_active = 1 ORDER BY full_name`;
  
  return all<Student>(sql);
}

// Get students with group count
export function getStudentsWithGroupCount(includeInactive: boolean = false): Array<Student & { groups_count: number }> {
  const sql = includeInactive
    ? `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = 1
       GROUP BY s.id
       ORDER BY s.full_name`
    : `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = 1
       WHERE s.is_active = 1
       GROUP BY s.id
       ORDER BY s.full_name`;
  
  return all<Student & { groups_count: number }>(sql);
}

// Get student by ID
export function getStudentById(id: number): Student | null {
  const student = get<Student>(`SELECT * FROM students WHERE id = ?`, [id]);
  return student || null;
}

// Get student with groups
export function getStudentWithGroups(id: number): StudentWithGroups | null {
  const student = getStudentById(id);
  
  if (!student) {
    return null;
  }
  
  const groups = all<{
    id: number;
    title: string;
    course_title: string;
    join_date: string;
  }>(
    `SELECT g.id, g.title, c.title as course_title, sg.join_date
     FROM student_groups sg
     JOIN groups g ON sg.group_id = g.id
     JOIN courses c ON g.course_id = c.id
     WHERE sg.student_id = ? AND sg.is_active = 1
     ORDER BY sg.join_date DESC`,
    [id]
  );
  
  return { ...student, groups };
}

// Check if public_id is unique for students
function isPublicIdUnique(publicId: string): boolean {
  const existing = get<{ id: number }>(
    `SELECT id FROM students WHERE public_id = ?`,
    [publicId]
  );
  return !existing;
}

// Create student
export function createStudent(
  fullName: string,
  phone?: string,
  parentName?: string,
  parentPhone?: string,
  notes?: string
): { id: number; public_id: string } {
  const publicId = generateUniquePublicId('student', isPublicIdUnique);
  const result = run(
    `INSERT INTO students (public_id, full_name, phone, parent_name, parent_phone, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    [publicId, fullName, phone || null, parentName || null, parentPhone || null, notes || null]
  );
  
  return { id: Number(result.lastInsertRowid), public_id: publicId };
}

// Update student
export function updateStudent(
  id: number,
  fullName: string,
  phone?: string,
  parentName?: string,
  parentPhone?: string,
  notes?: string
): void {
  run(
    `UPDATE students SET full_name = ?, phone = ?, parent_name = ?, parent_phone = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [fullName, phone || null, parentName || null, parentPhone || null, notes || null, id]
  );
}

// Archive student
export function archiveStudent(id: number): void {
  run(`UPDATE students SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

// Restore student
export function restoreStudent(id: number): void {
  run(`UPDATE students SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

// Delete student permanently
export function deleteStudent(id: number): void {
  run(`DELETE FROM students WHERE id = ?`, [id]);
}

// Search students
export function searchStudents(query: string, includeInactive: boolean = false): Array<Student & { groups_count: number }> {
  const searchTerm = `%${query}%`;
  const sql = includeInactive
    ? `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = 1
       WHERE s.full_name LIKE ? OR s.phone LIKE ? OR s.parent_name LIKE ? OR s.parent_phone LIKE ?
       GROUP BY s.id
       ORDER BY s.full_name`
    : `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = 1
       WHERE s.is_active = 1 AND (s.full_name LIKE ? OR s.phone LIKE ? OR s.parent_name LIKE ? OR s.parent_phone LIKE ?)
       GROUP BY s.id
       ORDER BY s.full_name`;
  
  return all<Student & { groups_count: number }>(sql, [searchTerm, searchTerm, searchTerm, searchTerm]);
}

// Get student attendance history
export function getStudentAttendanceHistory(
  studentId: number,
  groupId?: number
): Array<{
  lesson_date: string;
  topic: string | null;
  status: string;
  comment: string | null;
  group_title: string;
}> {
  let sql = `SELECT l.lesson_date, l.topic, a.status, a.comment, g.title as group_title
             FROM attendance a
             JOIN lessons l ON a.lesson_id = l.id
             JOIN groups g ON l.group_id = g.id
             WHERE a.student_id = ?`;
  
  const params: (number | string)[] = [studentId];
  
  if (groupId) {
    sql += ` AND l.group_id = ?`;
    params.push(groupId);
  }
  
  sql += ` ORDER BY l.lesson_date DESC LIMIT 50`;
  
  return all<{
    lesson_date: string;
    topic: string | null;
    status: string;
    comment: string | null;
    group_title: string;
  }>(sql, params);
}

// Get student payment history
export function getStudentPaymentHistory(
  studentId: number,
  groupId?: number
): Array<{
  id: number;
  month: string;
  amount: number;
  method: string;
  paid_at: string;
  note: string | null;
  group_title: string;
}> {
  let sql = `SELECT p.id, p.month, p.amount, p.method, p.paid_at, p.note, g.title as group_title
             FROM payments p
             JOIN groups g ON p.group_id = g.id
             WHERE p.student_id = ?`;
  
  const params: (number | string)[] = [studentId];
  
  if (groupId) {
    sql += ` AND p.group_id = ?`;
    params.push(groupId);
  }
  
  sql += ` ORDER BY p.paid_at DESC`;
  
  return all<{
    id: number;
    month: string;
    amount: number;
    method: string;
    paid_at: string;
    note: string | null;
    group_title: string;
  }>(sql, params);
}

// Get students with debt for a specific month
export function getStudentsWithDebt(month: string): StudentWithDebt[] {
  // Get all active student-group combinations with their monthly price
  // and subtract payments made for that month
  const sql = `SELECT 
    s.id, s.full_name, s.phone, s.parent_name, s.parent_phone, s.notes, s.is_active, s.created_at, s.updated_at,
    g.id as group_id, g.title as group_title, g.monthly_price,
    ? as month,
    COALESCE(SUM(p.amount), 0) as paid_amount,
    g.monthly_price - COALESCE(SUM(p.amount), 0) as debt
   FROM student_groups sg
   JOIN students s ON sg.student_id = s.id
   JOIN groups g ON sg.group_id = g.id
   LEFT JOIN payments p ON p.student_id = s.id AND p.group_id = g.id AND p.month = ?
   WHERE sg.is_active = 1 AND s.is_active = 1 AND g.is_active = 1
   GROUP BY s.id, g.id
   HAVING debt > 0
   ORDER BY debt DESC, s.full_name`;
  
  return all<StudentWithDebt>(sql, [month, month]);
}

// Get total debt for current month
export function getTotalDebtForMonth(month: string): { total_debt: number; students_count: number } {
  const result = get<{ total_debt: number; students_count: number }>(
    `SELECT 
      SUM(debt) as total_debt,
      COUNT(DISTINCT student_id) as students_count
     FROM (
       SELECT 
         s.id as student_id,
         g.monthly_price - COALESCE(SUM(p.amount), 0) as debt
       FROM student_groups sg
       JOIN students s ON sg.student_id = s.id
       JOIN groups g ON sg.group_id = g.id
       LEFT JOIN payments p ON p.student_id = s.id AND p.group_id = g.id AND p.month = ?
       WHERE sg.is_active = 1 AND s.is_active = 1 AND g.is_active = 1
       GROUP BY s.id, g.id
       HAVING debt > 0
     )`,
    [month]
  );
  
  return result || { total_debt: 0, students_count: 0 };
}