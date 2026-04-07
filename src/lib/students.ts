import { run, get, all } from '@/db';
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
  discount: number | null;
  parent_relation: string | null;
  parent2_name: string | null;
  parent2_phone: string | null;
  parent2_relation: string | null;
  interested_courses: string | null;
  source: string | null;
  is_active: boolean;
  study_status: StudyStatus;
  created_at: string;
  updated_at: string;
}

export interface StudentAutocompleteOption {
  id: number;
  full_name: string;
  public_id: string;
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
  lessons_count: number;
  lesson_price: number;
  discount_percent: number;
  expected_amount: number;
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
             OR EXISTS (SELECT 1 FROM attendance a2 JOIN lessons l2 ON a2.lesson_id = l2.id WHERE a2.student_id = students.id AND l2.group_id IS NULL AND l2.status = 'scheduled' AND l2.lesson_date >= CURRENT_DATE)
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students ORDER BY full_name`
    : `SELECT students.*, 
        CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = TRUE) > 0
             OR EXISTS (SELECT 1 FROM attendance a2 JOIN lessons l2 ON a2.lesson_id = l2.id WHERE a2.student_id = students.id AND l2.group_id IS NULL AND l2.status = 'scheduled' AND l2.lesson_date >= CURRENT_DATE)
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students WHERE is_active = TRUE ORDER BY full_name`;
  
  return await all<Student>(sql);
}

// Get students with group count
export async function getStudentsWithGroupCount(includeInactive: boolean = false): Promise<Array<Student & { groups_count: number }>> {
  const sql = includeInactive
    ? `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count,
        CASE WHEN COUNT(DISTINCT sg.id) > 0
             OR EXISTS (SELECT 1 FROM attendance a2 JOIN lessons l2 ON a2.lesson_id = l2.id WHERE a2.student_id = s.id AND l2.group_id IS NULL AND l2.status = 'scheduled' AND l2.lesson_date >= CURRENT_DATE)
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = TRUE
       GROUP BY s.id
       ORDER BY s.full_name`
    : `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count,
        CASE WHEN COUNT(DISTINCT sg.id) > 0
             OR EXISTS (SELECT 1 FROM attendance a2 JOIN lessons l2 ON a2.lesson_id = l2.id WHERE a2.student_id = s.id AND l2.group_id IS NULL AND l2.status = 'scheduled' AND l2.lesson_date >= CURRENT_DATE)
             THEN 'studying' ELSE 'not_studying' END as study_status
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
           OR EXISTS (SELECT 1 FROM attendance a2 JOIN lessons l2 ON a2.lesson_id = l2.id WHERE a2.student_id = students.id AND l2.group_id IS NULL AND l2.status = 'scheduled' AND l2.lesson_date >= CURRENT_DATE)
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
  discount?: number | null,
  parentRelation?: string,
  parent2Name?: string,
  parent2Phone?: string,
  parent2Relation?: string,
  interestedCourses?: string,
  source?: string
): Promise<{ id: number; public_id: string }> {
  const publicId = await generateUniquePublicId('student', isPublicIdUnique);
  const result = await run(
    `INSERT INTO students (public_id, full_name, phone, email, parent_name, parent_phone, notes, birth_date, photo, school, discount, parent_relation, parent2_name, parent2_phone, parent2_relation, interested_courses, source) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
    [publicId, fullName, phone || null, email || null, parentName || null, parentPhone || null, notes || null, birthDate || null, photo || null, school || null, discount != null ? discount : null, parentRelation || null, parent2Name || null, parent2Phone || null, parent2Relation || null, interestedCourses || null, source || null]
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
  discount?: number | null,
  parentRelation?: string,
  parent2Name?: string,
  parent2Phone?: string,
  parent2Relation?: string,
  interestedCourses?: string,
  source?: string
): Promise<void> {
  await run(
    `UPDATE students SET full_name = $1, phone = $2, email = $3, parent_name = $4, parent_phone = $5, notes = $6, birth_date = $7, photo = $8, school = $9, discount = $10, parent_relation = $11, parent2_name = $12, parent2_phone = $13, parent2_relation = $14, interested_courses = $15, source = $16, updated_at = NOW() WHERE id = $17`,
    [fullName, phone || null, email || null, parentName || null, parentPhone || null, notes || null, birthDate || null, photo || null, school || null, discount != null ? discount : null, parentRelation || null, parent2Name || null, parent2Phone || null, parent2Relation || null, interestedCourses || null, source || null, id]
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
  
  // Atomic cascade delete using CTE (single query = single transaction)
  try {
    await run(
      `WITH del_sg AS (DELETE FROM student_groups WHERE student_id = $1),
           del_att AS (DELETE FROM attendance WHERE student_id = $1),
           del_pay AS (DELETE FROM payments WHERE student_id = $1)
       DELETE FROM students WHERE id = $1`,
      [studentId]
    );

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
  
  // Atomic cascade delete using CTE (single query = single transaction)
  try {
    await run(
      `WITH del_sg AS (DELETE FROM student_groups WHERE student_id = $1),
           del_att AS (DELETE FROM attendance WHERE student_id = $1),
           del_pay AS (DELETE FROM payments WHERE student_id = $1)
       DELETE FROM students WHERE id = $1`,
      [studentId]
    );

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
        CASE WHEN COUNT(DISTINCT sg.id) > 0
             OR EXISTS (SELECT 1 FROM attendance a2 JOIN lessons l2 ON a2.lesson_id = l2.id WHERE a2.student_id = s.id AND l2.group_id IS NULL AND l2.status = 'scheduled' AND l2.lesson_date >= CURRENT_DATE)
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = TRUE
       WHERE s.full_name ILIKE $1 OR s.phone ILIKE $2 OR s.parent_name ILIKE $3 OR s.parent_phone ILIKE $4
       GROUP BY s.id
       ORDER BY s.full_name ${limitClause}`
    : `SELECT s.*, COUNT(DISTINCT sg.id) as groups_count,
        CASE WHEN COUNT(DISTINCT sg.id) > 0
             OR EXISTS (SELECT 1 FROM attendance a2 JOIN lessons l2 ON a2.lesson_id = l2.id WHERE a2.student_id = s.id AND l2.group_id IS NULL AND l2.status = 'scheduled' AND l2.lesson_date >= CURRENT_DATE)
             THEN 'studying' ELSE 'not_studying' END as study_status
       FROM students s
       LEFT JOIN student_groups sg ON s.id = sg.student_id AND sg.is_active = TRUE
       WHERE s.is_active = TRUE AND (s.full_name ILIKE $1 OR s.phone ILIKE $2 OR s.parent_name ILIKE $3 OR s.parent_phone ILIKE $4)
       GROUP BY s.id
       ORDER BY s.full_name ${limitClause}`;
  
  return await all<Student & { groups_count: number }>(sql, [searchTerm, searchTerm, searchTerm, searchTerm]);
}

// Quick search for autocomplete - returns only the fields needed for lightweight selectors
export async function quickSearchStudents(query: string, limit: number = 10): Promise<StudentAutocompleteOption[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const prefixTerm = `${trimmedQuery}%`;
  const containsTerm = `%${trimmedQuery}%`;
  const normalizedPhone = trimmedQuery.replace(/[^\d+]/g, '');
  const phonePrefixTerm = normalizedPhone ? `${normalizedPhone}%` : '';
  const phoneContainsTerm = normalizedPhone ? `%${normalizedPhone}%` : '';

  return await all<StudentAutocompleteOption>(
    `SELECT
        id,
        full_name,
        public_id
     FROM students
     WHERE is_active = TRUE
       AND (
         full_name ILIKE $1
         OR full_name ILIKE $2
         OR ($3 <> '' AND phone ILIKE $3)
         OR ($4 <> '' AND phone ILIKE $4)
       )
     ORDER BY
       CASE
         WHEN full_name ILIKE $1 THEN 0
         WHEN $3 <> '' AND phone ILIKE $3 THEN 1
         WHEN full_name ILIKE $2 THEN 2
         ELSE 3
       END,
       full_name
     LIMIT $5`,
    [prefixTerm, containsTerm, phonePrefixTerm, phoneContainsTerm, limit]
  );
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
  // Get lesson_price from system_settings
  const setting = await get<{ value: string }>(
    `SELECT value FROM system_settings WHERE key = 'lesson_price'`
  );
  const lessonPrice = parseInt(setting?.value || '300', 10);
  const monthKey = month.substring(0, 7);

  // Get all active student-group combinations with lesson counts and paid amounts for the month
  const rows = await all<{
    id: number;
    full_name: string;
    phone: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    study_status: StudyStatus;
    discount: number | null;
    group_id: number;
    group_title: string;
    lessons_count: number;
    paid_amount: number;
  }>(
    `WITH active_links AS (
       SELECT sg.student_id, sg.group_id
       FROM student_groups sg
       JOIN students s ON s.id = sg.student_id
       JOIN groups g ON g.id = sg.group_id
       WHERE sg.is_active = TRUE
         AND s.is_active = TRUE
         AND g.is_active = TRUE
     ),
     lesson_counts AS (
       SELECT l.group_id, COUNT(*)::INTEGER as lessons_count
       FROM lessons l
       WHERE l.group_id IS NOT NULL
         AND l.status != 'canceled'
         AND COALESCE(l.is_makeup, FALSE) = FALSE
         AND COALESCE(l.is_trial, FALSE) = FALSE
         AND TO_CHAR(l.lesson_date, 'YYYY-MM') = $2
       GROUP BY l.group_id
     ),
     payment_sums AS (
       SELECT p.student_id, p.group_id, COALESCE(SUM(p.amount), 0)::INTEGER as paid_amount
       FROM payments p
       WHERE p.month = $1
       GROUP BY p.student_id, p.group_id
     )
     SELECT
       s.id, s.full_name, s.phone, s.parent_name, s.parent_phone, s.notes, s.is_active, s.created_at, s.updated_at,
       CASE WHEN EXISTS (
              SELECT 1
              FROM student_groups sg2
              WHERE sg2.student_id = s.id AND sg2.is_active = TRUE
            )
            OR EXISTS (
              SELECT 1
              FROM attendance a2
              JOIN lessons l2 ON a2.lesson_id = l2.id
              WHERE a2.student_id = s.id
                AND l2.group_id IS NULL
                AND l2.status = 'scheduled'
                AND l2.lesson_date >= CURRENT_DATE
            )
            THEN 'studying' ELSE 'not_studying'
       END as study_status,
       COALESCE(s.discount::INTEGER, 0) as discount,
       g.id as group_id,
       g.title as group_title,
       COALESCE(lc.lessons_count, 0) as lessons_count,
       COALESCE(ps.paid_amount, 0) as paid_amount
     FROM active_links al
     JOIN students s ON s.id = al.student_id
     JOIN groups g ON g.id = al.group_id
     LEFT JOIN lesson_counts lc ON lc.group_id = g.id
     LEFT JOIN payment_sums ps ON ps.student_id = s.id AND ps.group_id = g.id
     ORDER BY s.full_name, g.title`,
    [month, monthKey]
  );

  return rows
    .map(row => {
      const discountPercent = row.discount || 0;
      const effectivePrice = Math.round(lessonPrice * (1 - discountPercent / 100));
      const expectedAmount = row.lessons_count * effectivePrice;
      const debt = Math.max(0, expectedAmount - row.paid_amount);
      return {
        ...row,
        lesson_price: lessonPrice,
        discount_percent: discountPercent,
        expected_amount: expectedAmount,
        month,
        debt,
      } as StudentWithDebt;
    })
    .filter(r => r.debt > 0)
    .sort((a, b) => b.debt - a.debt);
}

// Get total debt for current month
export async function getTotalDebtForMonth(month: string): Promise<{ total_debt: number; students_count: number }> {
  const debtors = await getStudentsWithDebt(month);
  const uniqueStudents = new Set(debtors.map(d => d.id));
  const totalDebt = debtors.reduce((sum, d) => sum + d.debt, 0);
  return { total_debt: totalDebt, students_count: uniqueStudents.size };
}

// Get students with their groups for cards display
export interface StudentGroupInfo {
  id: number;
  public_id: string;
  title: string;
  course_title: string;
}

export interface StudentsWithGroupsQuery {
  includeInactive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  courseId?: number;
  groupId?: number;
  ages?: number[];
  sortBy?: 'name' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export interface StudentsWithGroupsResult {
  students: Array<StudentListStudent>;
  total: number;
}

export type StudentListStudent = Pick<
  Student,
  | 'id'
  | 'public_id'
  | 'full_name'
  | 'phone'
  | 'email'
  | 'parent_name'
  | 'notes'
  | 'birth_date'
  | 'photo'
  | 'school'
  | 'discount'
  | 'parent_relation'
  | 'study_status'
> & {
  groups: StudentGroupInfo[];
};

type StudentListItemRow = Omit<StudentListStudent, 'groups'> & {
  groups: StudentGroupInfo[] | string | null;
};

function buildStudentsWhereClause(options: StudentsWithGroupsQuery): { whereClause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (!options.includeInactive) {
    conditions.push(`s.is_active = TRUE`);
  }

  if (options.search) {
    const searchTerm = `%${options.search}%`;
    conditions.push(`(s.full_name ILIKE $${paramIndex} OR s.phone ILIKE $${paramIndex + 1} OR s.parent_name ILIKE $${paramIndex + 2} OR s.parent_phone ILIKE $${paramIndex + 3})`);
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    paramIndex += 4;
  }

  if (options.courseId) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM student_groups sg_filter
        JOIN groups g_filter ON g_filter.id = sg_filter.group_id
        WHERE sg_filter.student_id = s.id
          AND sg_filter.is_active = TRUE
          AND g_filter.is_active = TRUE
          AND g_filter.course_id = $${paramIndex}
      )
    `);
    params.push(options.courseId);
    paramIndex += 1;
  }

  if (options.groupId) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM student_groups sg_filter
        WHERE sg_filter.student_id = s.id
          AND sg_filter.is_active = TRUE
          AND sg_filter.group_id = $${paramIndex}
      )
    `);
    params.push(options.groupId);
    paramIndex += 1;
  }

  if (options.ages && options.ages.length > 0) {
    const agePlaceholders = options.ages.map(() => `$${paramIndex++}`);
    conditions.push(`EXTRACT(YEAR FROM age(CURRENT_DATE, s.birth_date))::INTEGER IN (${agePlaceholders.join(', ')})`);
    params.push(...options.ages);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

export async function listStudentsWithGroups(options: StudentsWithGroupsQuery = {}): Promise<StudentsWithGroupsResult> {
  const { whereClause, params } = buildStudentsWhereClause(options);
  const sortBy = options.sortBy === 'created_at' ? 'created_at' : 'full_name';
  const sortOrder = options.sortOrder === 'desc' ? 'DESC' : 'ASC';
  const limit = typeof options.limit === 'number' ? Math.max(1, options.limit) : null;
  const offset = typeof options.offset === 'number' ? Math.max(0, options.offset) : 0;

  const totalResult = await get<{ count: number }>(
    `SELECT COUNT(*)::INTEGER as count
     FROM students s
     ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  const limitClause = limit !== null ? `LIMIT $${params.length + 1} OFFSET $${params.length + 2}` : '';
  const dataParams = limit !== null ? [...params, limit, offset] : params;

  const rows = await all<StudentListItemRow>(
    `WITH paged_students AS (
       SELECT
         s.id,
         s.public_id,
         s.full_name,
         s.phone,
         s.email,
         s.parent_name,
         s.notes,
         s.birth_date,
         s.photo,
         s.school,
         s.discount,
         s.parent_relation,
         CASE WHEN EXISTS (
                SELECT 1
                FROM student_groups sg2
                WHERE sg2.student_id = s.id AND sg2.is_active = TRUE
              )
              OR EXISTS (
                SELECT 1
                FROM attendance a2
                JOIN lessons l2 ON a2.lesson_id = l2.id
                WHERE a2.student_id = s.id
                  AND l2.group_id IS NULL
                  AND l2.status = 'scheduled'
                  AND l2.lesson_date >= CURRENT_DATE
              )
              THEN 'studying' ELSE 'not_studying'
         END as study_status
       FROM students s
       ${whereClause}
       ORDER BY s.${sortBy} ${sortOrder}, s.id ASC
       ${limitClause}
     )
     SELECT
       ps.*,
       COALESCE(
         json_agg(
           json_build_object(
             'id', g.id,
             'public_id', g.public_id,
             'title', g.title,
             'course_title', c.title
           )
           ORDER BY g.title
         ) FILTER (WHERE g.id IS NOT NULL),
         '[]'::json
       ) as groups
     FROM paged_students ps
     LEFT JOIN student_groups sg ON sg.student_id = ps.id AND sg.is_active = TRUE
     LEFT JOIN groups g ON g.id = sg.group_id AND g.is_active = TRUE
     LEFT JOIN courses c ON c.id = g.course_id
     GROUP BY
       ps.id, ps.public_id, ps.full_name, ps.phone, ps.email, ps.parent_name,
       ps.notes, ps.birth_date, ps.photo, ps.school, ps.discount, ps.parent_relation,
       ps.study_status
     ORDER BY ps.${sortBy} ${sortOrder}, ps.id ASC`,
    dataParams
  );

  return {
    students: rows.map((row) => ({
      ...row,
      groups: Array.isArray(row.groups) ? row.groups : JSON.parse(String(row.groups || '[]')),
    })),
    total,
  };
}

export async function getStudentsWithGroups(includeInactive: boolean = false): Promise<StudentListStudent[]> {
  const result = await listStudentsWithGroups({ includeInactive });
  return result.students;
}

// Search students with their groups
export async function searchStudentsWithGroups(query: string, includeInactive: boolean = false): Promise<StudentListStudent[]> {
  const result = await listStudentsWithGroups({ includeInactive, search: query });
  return result.students;
}

export async function getStudentAgeOptions(includeInactive: boolean = false): Promise<number[]> {
  const sql = includeInactive
    ? `SELECT DISTINCT EXTRACT(YEAR FROM age(CURRENT_DATE, birth_date))::INTEGER as age
       FROM students
       WHERE birth_date IS NOT NULL
       ORDER BY age ASC`
    : `SELECT DISTINCT EXTRACT(YEAR FROM age(CURRENT_DATE, birth_date))::INTEGER as age
       FROM students
       WHERE is_active = TRUE AND birth_date IS NOT NULL
       ORDER BY age ASC`;

  const rows = await all<{ age: number }>(sql);
  return rows.map((row) => row.age).filter((age) => age >= 0);
}

export async function getStudentSchoolOptions(includeInactive: boolean = false): Promise<string[]> {
  const rows = await all<{ school: string }>(
    `SELECT DISTINCT TRIM(school) as school
     FROM students
     WHERE school IS NOT NULL
       AND TRIM(school) != ''
       ${includeInactive ? '' : 'AND is_active = TRUE'}
     ORDER BY TRIM(school)`
  );

  return rows.map((row) => row.school);
}
