import { run, get, all, transaction } from '@/db';
import { generateUniquePublicId } from './public-id';

// Group status enum
export type GroupStatus = 'active' | 'graduate' | 'inactive';

// Day short names in Ukrainian (for title generation)
export const DAY_SHORT_NAMES_UA: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Нд',
};

// Full day names in Ukrainian
export const DAY_NAMES_UA: Record<number, string> = {
  1: 'Понеділок',
  2: 'Вівторок',
  3: 'Середа',
  4: 'Четвер',
  5: "П'ятниця",
  6: 'Субота',
  7: 'Неділя',
};

// Status labels in Ukrainian
export const STATUS_LABELS_UA: Record<GroupStatus, string> = {
  active: 'Активна',
  graduate: 'Випуск',
  inactive: 'Неактивна',
};

export type StudyStatus = 'studying' | 'not_studying';

export interface Group {
  id: number;
  public_id: string;
  course_id: number;
  title: string;
  teacher_id: number;
  weekly_day: number;
  start_time: string;
  duration_minutes: number;
  timezone: string;
  start_date: string | null;
  end_date: string | null;
  capacity: number | null;
  monthly_price: number;
  status: GroupStatus;
  note: string | null;
  photos_folder_url: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface GroupWithDetails extends Group {
  course_title: string;
  teacher_name: string;
  students_count: number;
}

// Validation error messages in Ukrainian
export const VALIDATION_ERRORS = {
  courseRequired: "Оберіть курс",
  dayRequired: "Оберіть день тижня",
  timeRequired: "Вкажіть час",
  teacherRequired: "Оберіть викладача",
  invalidUrl: "Некоректний формат посилання",
  invalidTitleFormat: "Назва групи має формат: 'Пн 16:30 Назва курсу'",
  invalidTime: "Некоректний формат часу",
  invalidDay: "Некоректний день тижня",
};

// Validate time format (HH:MM, 24h)
export function validateTime(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(time);
}

// Validate URL
export function validateUrl(url: string): boolean {
  if (!url) return true; // Optional field
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Generate group title from day, time, and course name
export function generateGroupTitle(weeklyDay: number, startTime: string, courseTitle: string): string {
  const dayShort = DAY_SHORT_NAMES_UA[weeklyDay];
  return `${dayShort} ${startTime} ${courseTitle}`;
}

// Validate group title format
export function validateGroupTitle(title: string, courseTitle: string): boolean {
  // Title should be: "Пн 16:30 CourseName"
  const titleRegex = /^(Пн|Вт|Ср|Чт|Пт|Сб|Нд) ([01]?[0-9]|2[0-3]):([0-5][0-9]) (.+)$/;
  const match = title.match(titleRegex);
  
  if (!match) return false;
  
  // The course name part should match
  const coursePart = match[4];
  return coursePart === courseTitle;
}

// Get all groups
export function getGroups(includeInactive: boolean = false): Group[] {
  const sql = includeInactive
    ? `SELECT * FROM groups ORDER BY created_at DESC`
    : `SELECT * FROM groups WHERE is_active = 1 ORDER BY created_at DESC`;
  
  return all<Group>(sql);
}

// Get groups with details
export function getGroupsWithDetails(includeInactive: boolean = false): GroupWithDetails[] {
  const sql = includeInactive
    ? `SELECT g.*, c.title as course_title, u.name as teacher_name,
        (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = 1) as students_count
       FROM groups g
       JOIN courses c ON g.course_id = c.id
       JOIN users u ON g.teacher_id = u.id
       ORDER BY g.created_at DESC`
    : `SELECT g.*, c.title as course_title, u.name as teacher_name,
        (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = 1) as students_count
       FROM groups g
       JOIN courses c ON g.course_id = c.id
       JOIN users u ON g.teacher_id = u.id
       WHERE g.is_active = 1
       ORDER BY g.created_at DESC`;
  
  return all<GroupWithDetails>(sql);
}

// Get groups for a teacher
export function getGroupsForTeacher(teacherId: number, includeInactive: boolean = false): GroupWithDetails[] {
  const sql = includeInactive
    ? `SELECT g.*, c.title as course_title, u.name as teacher_name,
        (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = 1) as students_count
       FROM groups g
       JOIN courses c ON g.course_id = c.id
       JOIN users u ON g.teacher_id = u.id
       WHERE g.teacher_id = ?
       ORDER BY g.created_at DESC`
    : `SELECT g.*, c.title as course_title, u.name as teacher_name,
        (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = 1) as students_count
       FROM groups g
       JOIN courses c ON g.course_id = c.id
       JOIN users u ON g.teacher_id = u.id
       WHERE g.teacher_id = ? AND g.is_active = 1
       ORDER BY g.created_at DESC`;
  
  return all<GroupWithDetails>(sql, [teacherId]);
}

// Get group by ID
export function getGroupById(id: number): Group | null {
  const group = get<Group>(`SELECT * FROM groups WHERE id = ?`, [id]);
  return group || null;
}

// Get group with details by ID
export function getGroupWithDetailsById(id: number): GroupWithDetails | null {
  const group = get<GroupWithDetails>(
    `SELECT g.*, c.title as course_title, u.name as teacher_name,
      (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = 1) as students_count
     FROM groups g
     JOIN courses c ON g.course_id = c.id
     JOIN users u ON g.teacher_id = u.id
     WHERE g.id = ?`,
    [id]
  );
  
  return group || null;
}

// Get groups filtered by course, teacher, status, days of week
export function getGroupsFiltered(filters: {
  courseId?: number;
  teacherId?: number;
  status?: GroupStatus;
  search?: string;
  includeInactive?: boolean;
  days?: number[];
}): GroupWithDetails[] {
  let sql = `SELECT g.*, c.title as course_title, u.name as teacher_name,
    (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = 1) as students_count
    FROM groups g
    JOIN courses c ON g.course_id = c.id
    JOIN users u ON g.teacher_id = u.id
    WHERE 1=1`;
  
  const params: any[] = [];
  
  if (!filters.includeInactive) {
    sql += ` AND g.is_active = 1`;
  }
  
  if (filters.courseId) {
    sql += ` AND g.course_id = ?`;
    params.push(filters.courseId);
  }
  
  if (filters.teacherId) {
    sql += ` AND g.teacher_id = ?`;
    params.push(filters.teacherId);
  }
  
  if (filters.status) {
    sql += ` AND g.status = ?`;
    params.push(filters.status);
  }
  
  if (filters.days && filters.days.length > 0) {
    sql += ` AND g.weekly_day IN (${filters.days.map(() => '?').join(',')})`;
    params.push(...filters.days);
  }
  
  if (filters.search) {
    sql += ` AND (g.title LIKE ? OR c.title LIKE ?)`;
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }
  
  sql += ` ORDER BY g.created_at DESC`;
  
  return all<GroupWithDetails>(sql, params);
}

// Create group input interface
export interface CreateGroupInput {
  course_id: number;
  title: string;
  teacher_id: number;
  weekly_day: number;
  start_time: string;
  duration_minutes?: number;
  start_date?: string;
  end_date?: string;
  capacity?: number;
  monthly_price?: number;
  status?: GroupStatus;
  note?: string;
  photos_folder_url?: string;
  timezone?: string;
}

// Check if public_id is unique for groups
function isPublicIdUnique(publicId: string): boolean {
  const existing = get<{ id: number }>(
    `SELECT id FROM groups WHERE public_id = ?`,
    [publicId]
  );
  return !existing;
}

// Create group
export function createGroup(input: CreateGroupInput): { id: number; public_id: string } {
  const publicId = generateUniquePublicId('group', isPublicIdUnique);
  const result = run(
    `INSERT INTO groups (public_id, course_id, title, teacher_id, weekly_day, start_time, duration_minutes, timezone, start_date, end_date, capacity, monthly_price, status, note, photos_folder_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      publicId,
      input.course_id,
      input.title.trim(),
      input.teacher_id,
      input.weekly_day,
      input.start_time,
      input.duration_minutes || 90,
      input.timezone || 'Europe/Uzhgorod',
      input.start_date || null,
      input.end_date || null,
      input.capacity || null,
      input.monthly_price || 0,
      input.status || 'active',
      input.note || null,
      input.photos_folder_url || null,
    ]
  );
  
  return { id: Number(result.lastInsertRowid), public_id: publicId };
}

// Update group input interface
export interface UpdateGroupInput {
  course_id: number;
  title: string;
  teacher_id: number;
  weekly_day: number;
  start_time: string;
  duration_minutes?: number;
  start_date?: string;
  end_date?: string;
  capacity?: number;
  monthly_price?: number;
  status?: GroupStatus;
  note?: string;
  photos_folder_url?: string;
  timezone?: string;
}

// Update group
export function updateGroup(id: number, input: UpdateGroupInput): void {
  run(
    `UPDATE groups SET 
      course_id = ?, 
      title = ?, 
      teacher_id = ?, 
      weekly_day = ?, 
      start_time = ?, 
      duration_minutes = ?, 
      timezone = ?, 
      start_date = ?, 
      end_date = ?, 
      capacity = ?, 
      monthly_price = ?, 
      status = ?, 
      note = ?, 
      photos_folder_url = ?, 
      updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?`,
    [
      input.course_id,
      input.title.trim(),
      input.teacher_id,
      input.weekly_day,
      input.start_time,
      input.duration_minutes || 90,
      input.timezone || 'Europe/Uzhgorod',
      input.start_date || null,
      input.end_date || null,
      input.capacity || null,
      input.monthly_price || 0,
      input.status || 'active',
      input.note || null,
      input.photos_folder_url || null,
      id,
    ]
  );
}

// Update group status
export function updateGroupStatus(id: number, status: GroupStatus): void {
  run(
    `UPDATE groups SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, id]
  );
}

// Archive group - set status to inactive
export function archiveGroup(id: number): void {
  run(`UPDATE groups SET status = 'inactive', is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

// Restore group - set status to active
export function restoreGroup(id: number): void {
  run(`UPDATE groups SET status = 'active', is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

// Delete group permanently (only if no students, lessons, payments)
export function deleteGroup(id: number): { success: boolean; error?: string } {
  // Check if group has students
  const students = all<{ id: number }>(`SELECT id FROM student_groups WHERE group_id = ?`, [id]);
  if (students.length > 0) {
    return { success: false, error: 'Неможливо видалити групу: є прив\'язані учні' };
  }
  
  // Check if group has lessons
  const lessons = all<{ id: number }>(`SELECT id FROM lessons WHERE group_id = ?`, [id]);
  if (lessons.length > 0) {
    return { success: false, error: 'Неможливо видалити групу: є прив\'язані заняття' };
  }
  
  // Check if group has payments
  const payments = all<{ id: number }>(`SELECT id FROM payments WHERE group_id = ?`, [id]);
  if (payments.length > 0) {
    return { success: false, error: 'Неможливо видалити групу: є прив\'язані платежі' };
  }
  
  // Delete the group
  run(`DELETE FROM groups WHERE id = ?`, [id]);
  return { success: true };
}

// Get students in group
export function getStudentsInGroup(groupId: number): Array<{
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  join_date: string;
  student_group_id: number;
  photo: string | null;
}> {
  return all<{
    id: number;
    public_id: string;
    full_name: string;
    phone: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    join_date: string;
    student_group_id: number;
    photo: string | null;
  }>(
    `SELECT s.id, s.public_id, s.full_name, s.phone, s.parent_name, s.parent_phone, sg.join_date, sg.id as student_group_id, s.photo
     FROM students s
     JOIN student_groups sg ON s.id = sg.student_id
     WHERE sg.group_id = ? AND sg.is_active = 1
     ORDER BY s.full_name`,
    [groupId]
  );
}

// Add student to group
export function addStudentToGroup(studentId: number, groupId: number, joinDate?: string): number {
  const result = run(
    `INSERT INTO student_groups (student_id, group_id, join_date) VALUES (?, ?, ?)`,
    [studentId, groupId, joinDate || new Date().toISOString().split('T')[0]]
  );
  
  return Number(result.lastInsertRowid);
}

// Remove student from group
export function removeStudentFromGroup(studentGroupId: number): void {
  run(
    `UPDATE student_groups SET is_active = 0, leave_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [studentGroupId]
  );
}

// Remove student from group by student and group IDs
export function removeStudentFromGroupByIDs(studentId: number, groupId: number): void {
  run(
    `UPDATE student_groups SET is_active = 0, leave_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE student_id = ? AND group_id = ? AND is_active = 1`,
    [studentId, groupId]
  );
}

// Check if student is in group
export function isStudentInGroup(studentId: number, groupId: number): boolean {
  const result = get<{ count: number }>(
    `SELECT COUNT(*) as count FROM student_groups WHERE student_id = ? AND group_id = ? AND is_active = 1`,
    [studentId, groupId]
  );
  return (result?.count || 0) > 0;
}

// Check if student was ever in group (including inactive)
export function wasStudentInGroup(studentId: number, groupId: number): boolean {
  const result = get<{ count: number }>(
    `SELECT COUNT(*) as count FROM student_groups WHERE student_id = ? AND group_id = ?`,
    [studentId, groupId]
  );
  return (result?.count || 0) > 0;
}

// Reactivate student in group (when they were removed before)
export function reactivateStudentInGroup(studentId: number, groupId: number, joinDate?: string): number {
  run(
    `UPDATE student_groups SET is_active = 1, join_date = ?, leave_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE student_id = ? AND group_id = ? AND is_active = 0`,
    [joinDate || new Date().toISOString().split('T')[0], studentId, groupId]
  );
  
  const result = get<{ id: number }>(
    `SELECT id FROM student_groups WHERE student_id = ? AND group_id = ? AND is_active = 1`,
    [studentId, groupId]
  );
  return result?.id || 0;
}

// Search groups
export function searchGroups(query: string, includeInactive: boolean = false): GroupWithDetails[] {
  return getGroupsFiltered({ search: query, includeInactive });
}
