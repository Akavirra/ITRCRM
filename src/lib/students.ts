import { run, get, all, transaction } from '@/db';
import { generateUniquePublicId } from './public-id';

export type StudyStatus = 'studying' | 'not_studying';

export interface Student {
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
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
  is_active: boolean;
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
export async function getStudents(includeInactive: boolean = false): Promise<Student[]> {
  const sql = includeInactive
    ? `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = TRUE) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students ORDER BY full_name`
    : `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = TRUE) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students WHERE is_active = TRUE ORDER BY full_name`;
  
  return await all<Student>(sql);
}

// Get students with group count
export async function getStudentsWithGroupCount(includeInactive: boolean = false): Promise<Array<Student & { groups_count: number }>> {
  const sql = includeInactive
    ? `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count,
        CASE WHEN COUNT(DISTINCT sg.id) > 0 THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = TRUE
       GROUP BY s.id
       ORDER BY s.full_name`
    : `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count,
        CASE WHEN COUNT(DISTINCT sg.id) > 0 THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = TRUE
       WHERE s.is_active = TRUE
       GROUP BY s.id
       ORDER BY s.full_name`;
  
  return await all<Student & { groups_count: number }>(sql);
}

// Get student by ID
export async function getStudentById(id: number): Promise<Student | null> {
  const student = await get<Student>(
    `SELECT students.*, 
      CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = TRUE) > 0 
           THEN 'studying' ELSE 'not_studying' END as study_status
     FROM students WHERE students.id = $1`, 
    [id]
  );
  return student || null;
}

// Get student with groups
export async function getStudentWithGroups(id: number): Promise<StudentWithGroups | null> {
  const student = await getStudentById(id);
  
  if (!student) {
    return null;
  }
  
  const groups = await all<{
    id: number;
    title: string;
    course_title: string;
    join_date: string;
  }>(
    `SELECT g.id, g.title, c.title as course_title, sg.join_date
     FROM student_groups sg
     JOIN groups g ON sg.group_id = g.id
     JOIN courses c ON g.course_id = c.id
     WHERE sg.student_id = $1 AND sg.is_active = TRUE
     ORDER BY sg.join_date DESC`,
    [id]
  );
  
  return { ...student, groups };
}

// Check if public_id is unique for students
async function isPublicIdUnique(publicId: string): Promise<boolean> {
  const existing = await get<{ id: number }>(
    `SELECT id FROM students WHERE public_id = $1`,
    [publicId]
  );
  return !existing;
}

// Create student
export async function createStudent(
  fullName: string,
  phone?: string,
  email?: string,
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
): Promise<{ id: number; public_id: string }> {
  const publicId = await generateUniquePublicId('student', isPublicIdUnique);
  const result = await run(
    `INSERT INTO students (public_id, full_name, phone, email, parent_name, parent_phone, notes, birth_date, photo, school, discount, parent_relation, parent2_name, parent2_relation, interested_courses, source) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [publicId, fullName, phone || null, email || null, parentName || null, parentPhone || null, notes || null, birthDate || null, photo || null, school || null, discount || null, parentRelation || null, parent2Name || null, parent2Relation || null, interestedCourses || null, source || null]
  );
  
  return { id: Number(result[0]?.id || 0), public_id: publicId };
}

// Update student
export async function updateStudent(
  id: number,
  fullName: string,
  phone?: string,
  email?: string,
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
): Promise<void> {
  await run(
    `UPDATE students SET full_name = $1, phone = $2, email = $3, parent_name = $4, parent_phone = $5, notes = $6, birth_date = $7, photo = $8, school = $9, discount = $10, parent_relation = $11, parent2_name = $12, parent2_relation = $13, interested_courses = $14, source = $15, updated_at = NOW() WHERE id = $16`,
    [fullName, phone || null, email || null, parentName || null, parentPhone || null, notes || null, birthDate || null, photo || null, school || null, discount || null, parentRelation || null, parent2Name || null, parent2Relation || null, interestedCourses || null, source || null, id]
  );
}

// Archive student
export async function archiveStudent(id: number): Promise<void> {
  await run(`UPDATE students SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
}

// Restore student
export async function restoreStudent(id: number): Promise<void> {
  await run(`UPDATE students SET is_active = TRUE, updated_at = NOW() WHERE id = $1`, [id]);
}

// Delete student permanently
export async function deleteStudent(id: number): Promise<void> {
  await run(`DELETE FROM students WHERE id = $1`, [id]);
}

// Get student's active groups (for warning before deletion)
export interface StudentGroupWarning {
  id: number;
  title: string;
  course_title: string;
  join_date: string;
}

export async function getStudentActiveGroups(studentId: number): Promise<StudentGroupWarning[]> {
  return await all<StudentGroupWarning>(
    `SELECT g.id, g.title, c.title as course_title, sg.join_date
     FROM student_groups sg
     JOIN groups g ON sg.group_id = g.id
     JOIN courses c ON g.course_id = c.id
     WHERE sg.student_id = $1 AND sg.is_active = TRUE AND g.is_active = TRUE
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

export async function safeDeleteStudent(studentId: number, adminUserId: number): Promise<SafeDeleteResult> {
  // First, check if student exists
  const student = await getStudentById(studentId);
  if (!student) {
    return { success: false, error: 'Учня не знайдено' };
  }
  
  // Get active groups for warning
  const activeGroups = await getStudentActiveGroups(studentId);
  
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
    await transaction(async () => {
      // Delete from student_groups (cascade will handle this, but we do it explicitly for logging)
      await run(`DELETE FROM student_groups WHERE student_id = $1`, [studentId]);
      
      // Delete attendance records (cascade will handle this, but explicit for safety)
      await run(`DELETE FROM attendance WHERE student_id = $1`, [studentId]);
      
      // Delete payment records (cascade will handle this, but explicit for safety)
      await run(`DELETE FROM payments WHERE student_id = $1`, [studentId]);;
      
      // Delete the student
      await run(`DELETE FROM students WHERE id = $1`, [studentId]);
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
export async function forceDeleteStudent(studentId: number, adminUserId: number): Promise<SafeDeleteResult> {
  // First, check if student exists
  const student = await getStudentById(studentId);
  if (!student) {
    return { success: false, error: 'Учня не знайдено' };
  }
  
  // Get active groups for logging
  const activeGroups = await getStudentActiveGroups(studentId);
  const groupsCount = activeGroups.length;
  
  // Perform cascade delete using transaction
  try {
    await transaction(async () => {
      // Delete from student_groups
      await run(`DELETE FROM student_groups WHERE student_id = $1`, [studentId]);
      
      // Delete attendance records
      await run(`DELETE FROM attendance WHERE student_id = $1`, [studentId]);;
      
      // Delete payment records
      await run(`DELETE FROM payments WHERE student_id = $1`, [studentId]);;
      
      // Delete the student
      await run(`DELETE FROM students WHERE id = $1`, [studentId]);
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
export async function verifyNoOrphanRecords(studentId: number): Promise<{ hasOrphans: boolean; orphanTables: string[] }> {
  const orphanTables: string[] = [];
  
  // Check student_groups
  const sgCount = await get<{ count: number }>(`SELECT COUNT(*) as count FROM student_groups WHERE student_id = $1`, [studentId]);
  if (sgCount && sgCount.count > 0) {
    orphanTables.push('student_groups');
  }
  
  // Check attendance
  const attCount = await get<{ count: number }>(`SELECT COUNT(*) as count FROM attendance WHERE student_id = $1`, [studentId]);
  if (attCount && attCount.count > 0) {
    orphanTables.push('attendance');
  }
  
  // Check payments
  const payCount = await get<{ count: number }>(`SELECT COUNT(*) as count FROM payments WHERE student_id = $1`, [studentId]);
  if (payCount && payCount.count > 0) {
    orphanTables.push('payments');
  }
  
  return {
    hasOrphans: orphanTables.length > 0,
    orphanTables
  };
}

// Search students
export async function searchStudents(query: string, includeInactive: boolean = false, limit?: number): Promise<Array<Student & { groups_count: number }>> {
  const searchTerm = `%${query}%`;
  const limitClause = limit ? `LIMIT ${limit}` : '';
  const sql = includeInactive
    ? `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count,
        CASE WHEN COUNT(DISTINCT sg.id) > 0 THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = TRUE
       WHERE s.full_name ILIKE $1 OR s.phone ILIKE $2 OR s.parent_name ILIKE $3 OR s.parent_phone ILIKE $4
       GROUP BY s.id
       ORDER BY s.full_name ${limitClause}`
    : `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count,
        CASE WHEN COUNT(DISTINCT sg.id) > 0 THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = TRUE
       WHERE s.is_active = TRUE AND (s.full_name ILIKE $1 OR s.phone ILIKE $2 OR s.parent_name ILIKE $3 OR s.parent_phone ILIKE $4)
       GROUP BY s.id
       ORDER BY s.full_name ${limitClause}`;
  
  return await all<Student & { groups_count: number }>(sql, [searchTerm, searchTerm, searchTerm, searchTerm]);
}

// Quick search for autocomplete - returns basic student info
export async function quickSearchStudents(query: string, limit: number = 10): Promise<Student[]> {
  const searchTerm = `%${query}%`;
  const sql = `SELECT students.*, 
                CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = TRUE) > 0 
                     THEN 'studying' ELSE 'not_studying' END as study_status
               FROM students 
                WHERE is_active = TRUE AND (full_name ILIKE $1 OR phone ILIKE $2)
               ORDER BY full_name
               LIMIT $3`;
  
  return await all<Student>(sql, [searchTerm, searchTerm, limit]);
}

// Get student attendance history
export async function getStudentAttendanceHistory(
  studentId: number,
  groupId?: number
): Promise<Array<{
  lesson_date: string;
  topic: string | null;
  status: string;
  comment: string | null;
  group_title: string;
}>> {
  let sql = `SELECT l.lesson_date, l.topic, a.status, a.comment, g.title as group_title
             FROM attendance a
             JOIN lessons l ON a.lesson_id = l.id
             JOIN groups g ON l.group_id = g.id
             WHERE a.student_id = $1`;
  
  const params: (number | string)[] = [studentId];
  
  if (groupId) {
    sql += ` AND l.group_id = $2`;
    params.push(groupId);
  }
  
  sql += ` ORDER BY l.lesson_date DESC LIMIT 50`;
  
  return await all<{
    lesson_date: string;
    topic: string | null;
    status: string;
    comment: string | null;
    group_title: string;
  }>(sql, params);
}

// Get student payment history
export async function getStudentPaymentHistory(
  studentId: number,
  groupId?: number
): Promise<Array<{
  id: number;
  month: string;
  amount: number;
  method: string;
  paid_at: string;
  note: string | null;
  group_title: string;
}>> {
  let sql = `SELECT p.id, p.month, p.amount, p.method, p.paid_at, p.note, g.title as group_title
             FROM payments p
             JOIN groups g ON p.group_id = g.id
             WHERE p.student_id = $1`;
  
  const params: (number | string)[] = [studentId];
  
  if (groupId) {
    sql += ` AND p.group_id = $2`;
    params.push(groupId);
  }
  
  sql += ` ORDER BY p.paid_at DESC`;
  
  return await all<{
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
export async function getStudentsWithDebt(month: string): Promise<StudentWithDebt[]> {
  // Get all active student-group combinations with their monthly price
  // and subtract payments made for that month
  const sql = `SELECT 
    s.id, s.full_name, s.phone, s.parent_name, s.parent_phone, s.notes, s.is_active, s.created_at, s.updated_at,
    CASE WHEN (SELECT COUNT(*) FROM student_groups sg WHERE sg.student_id = s.id AND sg.is_active = TRUE) > 0 
         THEN 'studying' ELSE 'not_studying' END as study_status,
    g.id as group_id, g.title as group_title, g.monthly_price,
    $1 as month,
    COALESCE(SUM(p.amount), 0) as paid_amount,
    g.monthly_price - COALESCE(SUM(p.amount), 0) as debt
   FROM student_groups sg
   JOIN students s ON sg.student_id = s.id
   JOIN groups g ON sg.group_id = g.id
   LEFT JOIN payments p ON p.student_id = s.id AND p.group_id = g.id AND p.month = $1
   WHERE sg.is_active = TRUE AND s.is_active = TRUE AND g.is_active = TRUE
   GROUP BY s.id, g.id
   HAVING g.monthly_price - COALESCE(SUM(p.amount), 0) > 0
   ORDER BY debt DESC, s.full_name`;
  
  return await all<StudentWithDebt>(sql, [month]);
}

// Get total debt for current month
export async function getTotalDebtForMonth(month: string): Promise<{ total_debt: number; students_count: number }> {
  const result = await get<{ total_debt: number; students_count: number }>(
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
       LEFT JOIN payments p ON p.student_id = s.id AND p.group_id = g.id AND p.month = $1
       WHERE sg.is_active = TRUE AND s.is_active = TRUE AND g.is_active = TRUE
       GROUP BY s.id, g.id
       HAVING g.monthly_price - COALESCE(SUM(p.amount), 0) > 0
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

export async function getStudentsWithGroups(includeInactive: boolean = false): Promise<Array<Student & { groups: StudentGroupInfo[] }>> {
  // First get all students with study_status computed
  const studentsSql = includeInactive
    ? `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = TRUE) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students ORDER BY full_name`
    : `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = TRUE) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students WHERE is_active = TRUE ORDER BY full_name`;
  
  const students = await all<Student>(studentsSql);
  
  // Then get groups for each student
  const groupsSql = `
    SELECT g.id, g.public_id, g.title, c.title as course_title
    FROM student_groups sg
    JOIN groups g ON sg.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    WHERE sg.student_id = $1 AND sg.is_active = TRUE AND g.is_active = TRUE
    ORDER BY g.title
  `;
  
  const groupsResults = await Promise.all(
    students.map(student => all<StudentGroupInfo>(groupsSql, [student.id]))
  );
  
  return students.map((student, index) => ({
    ...student,
    groups: groupsResults[index]
  }));
}

// Search students with their groups
export async function searchStudentsWithGroups(query: string, includeInactive: boolean = false): Promise<Array<Student & { groups: StudentGroupInfo[] }>> {
  const searchTerm = `%${query}%`;
  const studentsSql = includeInactive
    ? `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = TRUE) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students
       WHERE full_name ILIKE $1 OR phone ILIKE $2 OR parent_name ILIKE $3 OR parent_phone ILIKE $4
       ORDER BY full_name`
    : `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = TRUE) > 0 
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students
       WHERE is_active = TRUE AND (full_name ILIKE $1 OR phone ILIKE $2 OR parent_name ILIKE $3 OR parent_phone ILIKE $4)
       ORDER BY full_name`;
  
  const students = await all<Student>(studentsSql, [searchTerm, searchTerm, searchTerm, searchTerm]);
  
  // Then get groups for each student
  const groupsSql = `
    SELECT g.id, g.public_id, g.title, c.title as course_title
    FROM student_groups sg
    JOIN groups g ON sg.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    WHERE sg.student_id = $1 AND sg.is_active = TRUE AND g.is_active = TRUE
    ORDER BY g.title
  `;
  
  const groupsResults = await Promise.all(
    students.map(student => all<StudentGroupInfo>(groupsSql, [student.id]))
  );
  
  return students.map((student, index) => ({
    ...student,
    groups: groupsResults[index]
  }));
}
