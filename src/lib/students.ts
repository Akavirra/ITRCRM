import { run, get, all, transaction } from '@/db';
import { generateUniquePublicId } from './public-id';

export type StudyStatus = 'studying' | 'not_studying';

export interface Student {
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  notes: string | null;
  birth_date: string | null;
  photo: string | null;
  school: string | null;
  discount: string | null;
  parent_relation: string | null;
  parent2_name: string | null;
  parent2_relation: string | null;
  interested_courses: string | null;
  source: string | null;
  is_active: number;
  study_status: StudyStatus;
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

// Study status constants
export const STUDY_STATUS = {
  STUDYING: 'studying' as StudyStatus,
  NOT_STUDYING: 'not_studying' as StudyStatus,
};

// Helper function to compute study status based on groups count
export function computeStudyStatus(groupsCount: number): StudyStatus {
  return groupsCount > 0 ? STUDY_STATUS.STUDYING : STUDY_STATUS.NOT_STUDYING;
}

// Get all students with computed study_status
export function getStudents(includeInactive: boolean = false): Student[] {
  const sql = includeInactive
    ? `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = 1) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students ORDER BY full_name`
    : `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = 1) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students WHERE is_active = 1 ORDER BY full_name`;
  
  return all<Student>(sql);
}

// Get students with group count
export function getStudentsWithGroupCount(includeInactive: boolean = false): Array<Student & { groups_count: number }> {
  const sql = includeInactive
    ? `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count,
        CASE WHEN COUNT(DISTINCT sg.id) > 0 THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = 1
       GROUP BY s.id
       ORDER BY s.full_name`
    : `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count,
        CASE WHEN COUNT(DISTINCT sg.id) > 0 THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = 1
       WHERE s.is_active = 1
       GROUP BY s.id
       ORDER BY s.full_name`;
  
  return all<Student & { groups_count: number }>(sql);
}

// Get student by ID
export function getStudentById(id: number): Student | null {
  const student = get<Student>(
    `SELECT students.*, 
      CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = 1) > 0 
           THEN 'studying' ELSE 'not_studying' END as study_status
     FROM students WHERE students.id = ?`, 
    [id]
  );
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
  notes?: string,
  birthDate?: string,
  photo?: string,
  school?: string,
  discount?: string,
  parentRelation?: string,
  parent2Name?: string,
  parent2Relation?: string,
  interestedCourses?: string,
  source?: string
): { id: number; public_id: string } {
  const publicId = generateUniquePublicId('student', isPublicIdUnique);
  const result = run(
    `INSERT INTO students (public_id, full_name, phone, parent_name, parent_phone, notes, birth_date, photo, school, discount, parent_relation, parent2_name, parent2_relation, interested_courses, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [publicId, fullName, phone || null, parentName || null, parentPhone || null, notes || null, birthDate || null, photo || null, school || null, discount || null, parentRelation || null, parent2Name || null, parent2Relation || null, interestedCourses || null, source || null]
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
  notes?: string,
  birthDate?: string,
  photo?: string,
  school?: string,
  discount?: string,
  parentRelation?: string,
  parent2Name?: string,
  parent2Relation?: string,
  interestedCourses?: string,
  source?: string
): void {
  run(
    `UPDATE students SET full_name = ?, phone = ?, parent_name = ?, parent_phone = ?, notes = ?, birth_date = ?, photo = ?, school = ?, discount = ?, parent_relation = ?, parent2_name = ?, parent2_relation = ?, interested_courses = ?, source = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [fullName, phone || null, parentName || null, parentPhone || null, notes || null, birthDate || null, photo || null, school || null, discount || null, parentRelation || null, parent2Name || null, parent2Relation || null, interestedCourses || null, source || null, id]
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

// Get student's active groups (for warning before deletion)
export interface StudentGroupWarning {
  id: number;
  title: string;
  course_title: string;
  join_date: string;
}

export function getStudentActiveGroups(studentId: number): StudentGroupWarning[] {
  return all<StudentGroupWarning>(
    `SELECT g.id, g.title, c.title as course_title, sg.join_date
     FROM student_groups sg
     JOIN groups g ON sg.group_id = g.id
     JOIN courses c ON g.course_id = c.id
     WHERE sg.student_id = ? AND sg.is_active = 1 AND g.is_active = 1
     ORDER BY g.title`,
    [studentId]
  );
}

// Safe delete student with cascade - checks groups first
export interface SafeDeleteResult {
  success: boolean;
  error?: string;
  groups?: StudentGroupWarning[];
  deletedStudentId?: number;
}

export function safeDeleteStudent(studentId: number, adminUserId: number): SafeDeleteResult {
  // First, check if student exists
  const student = getStudentById(studentId);
  if (!student) {
    return { success: false, error: 'Учня не знайдено' };
  }
  
  // Get active groups for warning
  const activeGroups = getStudentActiveGroups(studentId);
  
  // If student is in groups, return warning info (caller should show confirmation)
  if (activeGroups.length > 0) {
    return {
      success: false,
      error: 'Учень бере участь у групах',
      groups: activeGroups
    };
  }
  
  // Perform cascade delete using transaction
  try {
    transaction(() => {
      // Delete from student_groups (cascade will handle this, but we do it explicitly for logging)
      run(`DELETE FROM student_groups WHERE student_id = ?`, [studentId]);
      
      // Delete attendance records (cascade will handle this, but explicit for safety)
      run(`DELETE FROM attendance WHERE student_id = ?`, [studentId]);
      
      // Delete payment records (cascade will handle this, but explicit for safety)
      run(`DELETE FROM payments WHERE student_id = ?`, [studentId]);
      
      // Delete the student
      run(`DELETE FROM students WHERE id = ?`, [studentId]);
    });
    
    // Log the deletion
    console.log(`[STUDENT_DELETE] Student ID ${studentId} (${student.full_name}) deleted by admin user ID ${adminUserId} at ${new Date().toISOString()}`);
    
    return {
      success: true,
      deletedStudentId: studentId
    };
  } catch (error) {
    console.error(`[STUDENT_DELETE_ERROR] Failed to delete student ID ${studentId}:`, error);
    return { success: false, error: 'Помилка при видаленні учня' };
  }
}

// Force delete student with cascade - bypasses group check (for confirmed deletions)
export function forceDeleteStudent(studentId: number, adminUserId: number): SafeDeleteResult {
  // First, check if student exists
  const student = getStudentById(studentId);
  if (!student) {
    return { success: false, error: 'Учня не знайдено' };
  }
  
  // Get active groups for logging
  const activeGroups = getStudentActiveGroups(studentId);
  const groupsCount = activeGroups.length;
  
  // Perform cascade delete using transaction
  try {
    transaction(() => {
      // Delete from student_groups
      run(`DELETE FROM student_groups WHERE student_id = ?`, [studentId]);
      
      // Delete attendance records
      run(`DELETE FROM attendance WHERE student_id = ?`, [studentId]);
      
      // Delete payment records
      run(`DELETE FROM payments WHERE student_id = ?`, [studentId]);
      
      // Delete the student
      run(`DELETE FROM students WHERE id = ?`, [studentId]);
    });
    
    // Log the deletion with group info
    console.log(`[STUDENT_DELETE] Student ID ${studentId} (${student.full_name}, public_id: ${student.public_id}) deleted by admin user ID ${adminUserId}. Removed from ${groupsCount} group(s) at ${new Date().toISOString()}`);
    
    return {
      success: true,
      deletedStudentId: studentId,
      groups: activeGroups
    };
  } catch (error) {
    console.error(`[STUDENT_DELETE_ERROR] Failed to force delete student ID ${studentId}:`, error);
    return { success: false, error: 'Помилка при видаленні учня' };
  }
}

// Verify no orphan records after student deletion
export function verifyNoOrphanRecords(studentId: number): { hasOrphans: boolean; orphanTables: string[] } {
  const orphanTables: string[] = [];
  
  // Check student_groups
  const sgCount = get<{ count: number }>(`SELECT COUNT(*) as count FROM student_groups WHERE student_id = ?`, [studentId]);
  if (sgCount && sgCount.count > 0) {
    orphanTables.push('student_groups');
  }
  
  // Check attendance
  const attCount = get<{ count: number }>(`SELECT COUNT(*) as count FROM attendance WHERE student_id = ?`, [studentId]);
  if (attCount && attCount.count > 0) {
    orphanTables.push('attendance');
  }
  
  // Check payments
  const payCount = get<{ count: number }>(`SELECT COUNT(*) as count FROM payments WHERE student_id = ?`, [studentId]);
  if (payCount && payCount.count > 0) {
    orphanTables.push('payments');
  }
  
  return {
    hasOrphans: orphanTables.length > 0,
    orphanTables
  };
}

// Search students
export function searchStudents(query: string, includeInactive: boolean = false, limit?: number): Array<Student & { groups_count: number }> {
  const searchTerm = `%${query}%`;
  const limitClause = limit ? `LIMIT ${limit}` : '';
  const sql = includeInactive
    ? `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count,
        CASE WHEN COUNT(DISTINCT sg.id) > 0 THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = 1
       WHERE s.full_name LIKE ? OR s.phone LIKE ? OR s.parent_name LIKE ? OR s.parent_phone LIKE ?
       GROUP BY s.id
       ORDER BY s.full_name ${limitClause}`
    : `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count,
        CASE WHEN COUNT(DISTINCT sg.id) > 0 THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = 1
       WHERE s.is_active = 1 AND (s.full_name LIKE ? OR s.phone LIKE ? OR s.parent_name LIKE ? OR s.parent_phone LIKE ?)
       GROUP BY s.id
       ORDER BY s.full_name ${limitClause}`;
  
  return all<Student & { groups_count: number }>(sql, [searchTerm, searchTerm, searchTerm, searchTerm]);
}

// Quick search for autocomplete - returns basic student info
export function quickSearchStudents(query: string, limit: number = 10): Student[] {
  const searchTerm = `%${query}%`;
  const sql = `SELECT students.*, 
                CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = 1) > 0 
                     THEN 'studying' ELSE 'not_studying' END as study_status
               FROM students 
               WHERE is_active = 1 AND (full_name LIKE ? OR phone LIKE ?)
               ORDER BY full_name
               LIMIT ?`;
  
  return all<Student>(sql, [searchTerm, searchTerm, limit]);
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
    CASE WHEN (SELECT COUNT(*) FROM student_groups sg WHERE sg.student_id = s.id AND sg.is_active = 1) > 0 
         THEN 'studying' ELSE 'not_studying' END as study_status,
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

// Get students with their groups for cards display
export interface StudentGroupInfo {
  id: number;
  public_id: string;
  title: string;
  course_title: string;
}

export function getStudentsWithGroups(includeInactive: boolean = false): Array<Student & { groups: StudentGroupInfo[] }> {
  // First get all students with study_status computed
  const studentsSql = includeInactive
    ? `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = 1) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students ORDER BY full_name`
    : `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = 1) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students WHERE is_active = 1 ORDER BY full_name`;
  
  const students = all<Student>(studentsSql);
  
  // Then get groups for each student
  const groupsSql = `
    SELECT g.id, g.public_id, g.title, c.title as course_title
    FROM student_groups sg
    JOIN groups g ON sg.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    WHERE sg.student_id = ? AND sg.is_active = 1 AND g.is_active = 1
    ORDER BY g.title
  `;
  
  return students.map(student => ({
    ...student,
    groups: all<StudentGroupInfo>(groupsSql, [student.id])
  }));
}

// Search students with their groups
export function searchStudentsWithGroups(query: string, includeInactive: boolean = false): Array<Student & { groups: StudentGroupInfo[] }> {
  const searchTerm = `%${query}%`;
  const studentsSql = includeInactive
    ? `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = 1) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students
       WHERE full_name LIKE ? OR phone LIKE ? OR parent_name LIKE ? OR parent_phone LIKE ?
       ORDER BY full_name`
    : `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = 1) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students
       WHERE is_active = 1 AND (full_name LIKE ? OR phone LIKE ? OR parent_name LIKE ? OR parent_phone LIKE ?)
       ORDER BY full_name`;
  
  const students = all<Student>(studentsSql, [searchTerm, searchTerm, searchTerm, searchTerm]);
  
  // Then get groups for each student
  const groupsSql = `
    SELECT g.id, g.public_id, g.title, c.title as course_title
    FROM student_groups sg
    JOIN groups g ON sg.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    WHERE sg.student_id = ? AND sg.is_active = 1 AND g.is_active = 1
    ORDER BY g.title
  `;
  
  return students.map(student => ({
    ...student,
    groups: all<StudentGroupInfo>(groupsSql, [student.id])
  }));
}