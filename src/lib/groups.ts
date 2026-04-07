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
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupWithDetails extends Group {
  course_title: string;
  teacher_name: string;
  students_count: number;
}

export interface GroupFilterOption {
  id: number;
  title: string;
  course_id: number;
  course_title: string;
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
export async function getGroups(includeInactive: boolean = false): Promise<Group[]> {
  const sql = includeInactive
    ? `SELECT * FROM groups ORDER BY created_at DESC`
    : `SELECT * FROM groups WHERE is_active = TRUE ORDER BY created_at DESC`;
  
  return await all<Group>(sql);
}

export async function getGroupFilterOptions(includeInactive: boolean = false): Promise<GroupFilterOption[]> {
  return await all<GroupFilterOption>(
    `SELECT
        g.id,
        g.title,
        g.course_id,
        c.title as course_title
     FROM groups g
     JOIN courses c ON g.course_id = c.id
     ${includeInactive ? '' : 'WHERE g.is_active = TRUE'}
     ORDER BY g.title`
  );
}

// Get groups with details
export async function getGroupsWithDetails(includeInactive: boolean = false): Promise<GroupWithDetails[]> {
  const sql = includeInactive
    ? `SELECT g.*, c.title as course_title, u.name as teacher_name,
        (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = TRUE) as students_count
       FROM groups g
       JOIN courses c ON g.course_id = c.id
       JOIN users u ON g.teacher_id = u.id
       ORDER BY g.created_at DESC`
    : `SELECT g.*, c.title as course_title, u.name as teacher_name,
        (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = TRUE) as students_count
       FROM groups g
       JOIN courses c ON g.course_id = c.id
       JOIN users u ON g.teacher_id = u.id
       WHERE g.is_active = TRUE
       ORDER BY g.created_at DESC`;
  
  return await all<GroupWithDetails>(sql);
}

// Get groups for a teacher
export async function getGroupsForTeacher(teacherId: number, includeInactive: boolean = false): Promise<GroupWithDetails[]> {
  const sql = includeInactive
    ? `SELECT g.*, c.title as course_title, u.name as teacher_name,
        (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = TRUE) as students_count
       FROM groups g
       JOIN courses c ON g.course_id = c.id
       JOIN users u ON g.teacher_id = u.id
       WHERE g.teacher_id = $1
       ORDER BY g.created_at DESC`
    : `SELECT g.*, c.title as course_title, u.name as teacher_name,
        (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = TRUE) as students_count
       FROM groups g
       JOIN courses c ON g.course_id = c.id
       JOIN users u ON g.teacher_id = u.id
       WHERE g.teacher_id = $1 AND g.is_active = TRUE
       ORDER BY g.created_at DESC`;
  
  return await all<GroupWithDetails>(sql, [teacherId]);
}

// Get group by ID
export async function getGroupById(id: number): Promise<Group | null> {
  const group = await get<Group>(`SELECT * FROM groups WHERE id = $1`, [id]);
  return group || null;
}

// Get group with details by ID
export async function getGroupWithDetailsById(id: number): Promise<GroupWithDetails | null> {
  const group = await get<GroupWithDetails>(
    `SELECT g.*, c.title as course_title, u.name as teacher_name,
      (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = TRUE) as students_count
     FROM groups g
     JOIN courses c ON g.course_id = c.id
     JOIN users u ON g.teacher_id = u.id
     WHERE g.id = $1`,
    [id]
  );
  
  return group || null;
}

// Get groups filtered by course, teacher, status, days of week
export async function getGroupsFiltered(filters: {
  courseId?: number;
  teacherId?: number;
  status?: GroupStatus;
  search?: string;
  includeInactive?: boolean;
  days?: number[];
}): Promise<GroupWithDetails[]> {
  let sql = `SELECT g.*, c.title as course_title, u.name as teacher_name,
    (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = TRUE) as students_count
    FROM groups g
    JOIN courses c ON g.course_id = c.id
    JOIN users u ON g.teacher_id = u.id
    WHERE 1=1`;
  
  const params: any[] = [];
  let paramIndex = 1;
  
  if (!filters.includeInactive) {
    sql += ` AND g.is_active = TRUE`;
  }
  
  if (filters.courseId) {
    sql += ` AND g.course_id = $${paramIndex++}`;
    params.push(filters.courseId);
  }
  
  if (filters.teacherId) {
    sql += ` AND g.teacher_id = $${paramIndex++}`;
    params.push(filters.teacherId);
  }
  
  if (filters.status) {
    sql += ` AND g.status = $${paramIndex++}`;
    params.push(filters.status);
  }
  
  if (filters.days && filters.days.length > 0) {
    sql += ` AND g.weekly_day IN (${filters.days.map(() => `$${paramIndex++}`).join(',')})`;
    params.push(...filters.days);
  }
  
  if (filters.search) {
    sql += ` AND (g.title ILIKE $${paramIndex} OR c.title ILIKE $${paramIndex})`;
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm);
    paramIndex++;
  }
  
  sql += ` ORDER BY g.created_at DESC`;
  
  return await all<GroupWithDetails>(sql, params);
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
async function isPublicIdUnique(publicId: string): Promise<boolean> {
  const existing = await get<{ id: number }>(
    `SELECT id FROM groups WHERE public_id = $1`,
    [publicId]
  );
  return !existing;
}

// Create group
export async function createGroup(input: CreateGroupInput): Promise<{ id: number; public_id: string }> {
  const publicId = await generateUniquePublicId('group', isPublicIdUnique);
  const result = await run(
    `INSERT INTO groups (public_id, course_id, title, teacher_id, weekly_day, start_time, duration_minutes, timezone, start_date, end_date, capacity, monthly_price, status, note, photos_folder_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
    [
      publicId,
      input.course_id,
      input.title.trim(),
      input.teacher_id,
      input.weekly_day,
      input.start_time,
      input.duration_minutes || 90,
      input.timezone || 'Europe/Kyiv',
      input.start_date || null,
      input.end_date || null,
      input.capacity || null,
      input.monthly_price || 0,
      input.status || 'active',
      input.note || null,
      input.photos_folder_url || null,
    ]
  );
  
  return { id: Number(result[0]?.id), public_id: publicId };
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
export async function updateGroup(id: number, input: UpdateGroupInput): Promise<void> {
  await run(
    `UPDATE groups SET 
      course_id = $1, 
      title = $2, 
      teacher_id = $3, 
      weekly_day = $4, 
      start_time = $5, 
      duration_minutes = $6, 
      timezone = $7, 
      start_date = $8, 
      end_date = $9, 
      capacity = $10, 
      monthly_price = $11, 
      status = $12, 
      note = $13, 
      photos_folder_url = $14, 
      updated_at = NOW() 
    WHERE id = $15`,
    [
      input.course_id,
      input.title.trim(),
      input.teacher_id,
      input.weekly_day,
      input.start_time,
      input.duration_minutes || 90,
      input.timezone || 'Europe/Kyiv',
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
export async function updateGroupStatus(id: number, status: GroupStatus): Promise<void> {
  await run(
    `UPDATE groups SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id]
  );
}

// Archive group - set status to inactive
export async function archiveGroup(id: number): Promise<void> {
  await run(`UPDATE groups SET status = 'inactive', is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
}

// Restore group - set status to active
export async function restoreGroup(id: number): Promise<void> {
  await run(`UPDATE groups SET status = 'active', is_active = TRUE, updated_at = NOW() WHERE id = $1`, [id]);
}

// Delete group permanently (only if no students, lessons, payments)
export async function deleteGroup(id: number): Promise<{ success: boolean; error?: string }> {
  // Check if group has students
  const students = await all<{ id: number }>(`SELECT id FROM student_groups WHERE group_id = $1`, [id]);
  if (students.length > 0) {
    return { success: false, error: 'Неможливо видалити групу: є прив\'язані учні' };
  }
  
  // Check if group has lessons
  const lessons = await all<{ id: number }>(`SELECT id FROM lessons WHERE group_id = $1`, [id]);
  if (lessons.length > 0) {
    return { success: false, error: 'Неможливо видалити групу: є прив\'язані заняття' };
  }
  
  // Check if group has payments
  const payments = await all<{ id: number }>(`SELECT id FROM payments WHERE group_id = $1`, [id]);
  if (payments.length > 0) {
    return { success: false, error: 'Неможливо видалити групу: є прив\'язані платежі' };
  }
  
  // Delete the group
  await run(`DELETE FROM groups WHERE id = $1`, [id]);
  return { success: true };
}

// Check if group can be deleted and get details about what prevents deletion
export interface GroupDeletionCheck {
  canDelete: boolean;
  students: { id: number; full_name: string }[];
  lessons: { id: number; date: string }[];
  payments: { id: number; amount: number; date: string }[];
}

export async function checkGroupDeletion(id: number): Promise<GroupDeletionCheck> {
  // Get students in group
  const students = await all<{ id: number; full_name: string }>(
    `SELECT s.id, s.full_name FROM students s 
     JOIN student_groups sg ON s.id = sg.student_id 
     WHERE sg.group_id = $1 AND sg.is_active = TRUE`,
    [id]
  );
  
  // Get lessons in group
  const lessons = await all<{ id: number; date: string }>(
    `SELECT id, date FROM lessons WHERE group_id = $1`,
    [id]
  );
  
  // Get payments in group
  const payments = await all<{ id: number; amount: number; date: string }>(
    `SELECT id, amount, date FROM payments WHERE group_id = $1`,
    [id]
  );
  
  return {
    canDelete: students.length === 0 && lessons.length === 0 && payments.length === 0,
    students,
    lessons,
    payments,
  };
}

// Get students in group
export async function getStudentsInGroup(groupId: number, includeInactive = false): Promise<Array<{
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  join_date: string;
  leave_date: string | null;
  student_group_id: number;
  photo: string | null;
  sg_status: string;
}>> {
  return await all<{
    id: number;
    public_id: string;
    full_name: string;
    phone: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    join_date: string;
    leave_date: string | null;
    student_group_id: number;
    photo: string | null;
    sg_status: string;
  }>(
    `SELECT s.id, s.public_id, s.full_name, s.phone, s.parent_name, s.parent_phone, sg.join_date, sg.leave_date, sg.id as student_group_id, s.photo, sg.status as sg_status
     FROM students s
     JOIN student_groups sg ON s.id = sg.student_id
     WHERE sg.group_id = $1${includeInactive ? '' : ' AND sg.is_active = TRUE'}
     ORDER BY sg.status ASC, s.full_name`,
    [groupId]
  );
}

export async function getStudentsInGroupBasic(
  groupId: number,
  includeInactive = false
): Promise<Array<{
  id: number;
  public_id: string;
  full_name: string;
}>> {
  return await all<{
    id: number;
    public_id: string;
    full_name: string;
  }>(
    `SELECT s.id, s.public_id, s.full_name
     FROM students s
     JOIN student_groups sg ON s.id = sg.student_id
     WHERE sg.group_id = $1${includeInactive ? '' : ' AND sg.is_active = TRUE'}
     ORDER BY s.full_name`,
    [groupId]
  );
}

// Get students in group including graduated (for display on group page)
export async function getStudentsInGroupWithGraduated(groupId: number): Promise<Array<{
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  join_date: string;
  leave_date: string | null;
  student_group_id: number;
  photo: string | null;
  sg_status: string;
}>> {
  return await all<{
    id: number;
    public_id: string;
    full_name: string;
    phone: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    join_date: string;
    leave_date: string | null;
    student_group_id: number;
    photo: string | null;
    sg_status: string;
  }>(
    `SELECT s.id, s.public_id, s.full_name, s.phone, s.parent_name, s.parent_phone, sg.join_date, sg.leave_date, sg.id as student_group_id, s.photo, sg.status as sg_status
     FROM students s
     JOIN student_groups sg ON s.id = sg.student_id
     WHERE sg.group_id = $1 AND sg.status IN ('active', 'graduated')
     ORDER BY sg.status ASC, s.full_name`,
    [groupId]
  );
}

// Add student to group
export async function addStudentToGroup(studentId: number, groupId: number, joinDate?: string): Promise<number> {
  const result = await run(
    `INSERT INTO student_groups (student_id, group_id, join_date) VALUES ($1, $2, $3) RETURNING id`,
    [studentId, groupId, joinDate || new Date().toISOString().split('T')[0]]
  );
  
  return Number(result[0]?.id);
}

// Remove student from group
export async function removeStudentFromGroup(studentGroupId: number): Promise<void> {
  await run(
    `UPDATE student_groups SET is_active = FALSE, leave_date = CURRENT_DATE, status = 'removed', updated_at = NOW() WHERE id = $1`,
    [studentGroupId]
  );
}

// Remove student from group by student and group IDs
export async function removeStudentFromGroupByIDs(studentId: number, groupId: number): Promise<void> {
  await run(
    `UPDATE student_groups SET is_active = FALSE, leave_date = CURRENT_DATE, status = 'removed', updated_at = NOW() WHERE student_id = $1 AND group_id = $2 AND is_active = TRUE`,
    [studentId, groupId]
  );
}

// Graduate student from group (individual graduation)
export async function graduateStudentFromGroup(studentGroupId: number, graduationDate: string): Promise<void> {
  await run(
    `UPDATE student_groups SET is_active = FALSE, leave_date = $1, status = 'graduated', updated_at = NOW() WHERE id = $2`,
    [graduationDate, studentGroupId]
  );
}

// Graduate student from group by student and group IDs
export async function graduateStudentFromGroupByIDs(studentId: number, groupId: number, graduationDate: string): Promise<void> {
  await run(
    `UPDATE student_groups SET is_active = FALSE, leave_date = $1, status = 'graduated', updated_at = NOW() WHERE student_id = $2 AND group_id = $3 AND is_active = TRUE`,
    [graduationDate, studentId, groupId]
  );
}

// Check if student is in group
export async function isStudentInGroup(studentId: number, groupId: number): Promise<boolean> {
  const result = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM student_groups WHERE student_id = $1 AND group_id = $2 AND is_active = TRUE`,
    [studentId, groupId]
  );
  return (result?.count || 0) > 0;
}

// Check if student was ever in group (including inactive)
export async function wasStudentInGroup(studentId: number, groupId: number): Promise<boolean> {
  const result = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM student_groups WHERE student_id = $1 AND group_id = $2`,
    [studentId, groupId]
  );
  return (result?.count || 0) > 0;
}

// Reactivate student in group (when they were removed before)
export async function reactivateStudentInGroup(studentId: number, groupId: number, joinDate?: string): Promise<number> {
  await run(
    `UPDATE student_groups SET is_active = TRUE, join_date = $1, leave_date = NULL, status = 'active', updated_at = NOW() WHERE student_id = $2 AND group_id = $3 AND is_active = FALSE`,
    [joinDate || new Date().toISOString().split('T')[0], studentId, groupId]
  );
  
  const result = await get<{ id: number }>(
    `SELECT id FROM student_groups WHERE student_id = $1 AND group_id = $2 AND is_active = TRUE`,
    [studentId, groupId]
  );
  return result?.id || 0;
}

// Search groups
export async function searchGroups(query: string, includeInactive: boolean = false): Promise<GroupWithDetails[]> {
  return await getGroupsFiltered({ search: query, includeInactive });
}

// ── Teacher assignment history ────────────────────────────────────────────────

export interface TeacherAssignment {
  id: number;
  group_id: number;
  teacher_id: number;
  teacher_name: string;
  started_at: string;
  ended_at: string | null;
  changed_by: number | null;
  changed_by_name: string | null;
  reason: string | null;
  created_at: string;
}

/**
 * Permanently change the group's teacher.
 * Closes the current assignment record and opens a new one,
 * then updates groups.teacher_id.
 * Future lessons with teacher_id IS NULL will automatically inherit the new teacher.
 */
export async function changeGroupTeacher(
  groupId: number,
  newTeacherId: number,
  changedBy: number,
  reason?: string | null
): Promise<void> {
  // Core change — must succeed
  await run(
    `UPDATE groups SET teacher_id = $1, updated_at = NOW() WHERE id = $2`,
    [newTeacherId, groupId]
  );

  // Assignment history — non-fatal (table may not exist yet if migration wasn't run)
  try {
    await run(
      `UPDATE group_teacher_assignments SET ended_at = NOW() WHERE group_id = $1 AND ended_at IS NULL`,
      [groupId]
    );
    await run(
      `INSERT INTO group_teacher_assignments (group_id, teacher_id, changed_by, reason)
       VALUES ($1, $2, $3, $4)`,
      [groupId, newTeacherId, changedBy, reason || null]
    );
  } catch (e) {
    console.warn('group_teacher_assignments write skipped (table may not exist):', (e as Error).message);
  }
}

/** Returns the full teacher assignment history for a group (newest first). */
export async function getGroupTeacherAssignments(groupId: number): Promise<TeacherAssignment[]> {
  return await all<TeacherAssignment>(
    `SELECT gta.*,
            u.name  AS teacher_name,
            cb.name AS changed_by_name
     FROM group_teacher_assignments gta
     JOIN users u   ON gta.teacher_id  = u.id
     LEFT JOIN users cb ON gta.changed_by = cb.id
     WHERE gta.group_id = $1
     ORDER BY gta.started_at DESC`,
    [groupId]
  );
}

/**
 * Reschedule a group to a new day/time.
 * Updates: groups.weekly_day, groups.start_time, groups.duration_minutes, groups.title
 * Also updates all future 'scheduled' lessons that were NOT individually rescheduled
 * (original_date IS NULL) to the new day/time.
 * dayDiff = (newJsDay - oldJsDay + 7) % 7 — always forward
 */
export async function rescheduleGroup(
  groupId: number,
  newWeeklyDay: number,  // 1-7 (Mon-Sun)
  newStartTime: string,  // "HH:MM"
  newDurationMinutes: number,
  courseTitle: string,
  changedBy: number,
  reason?: string | null,
): Promise<{ lessonsUpdated: number }> {
  const group = await get<{ weekly_day: number; start_time: string; duration_minutes: number }>(
    `SELECT weekly_day, start_time, duration_minutes FROM groups WHERE id = $1`,
    [groupId]
  );
  if (!group) throw new Error('Group not found');

  const oldJsDay = group.weekly_day === 7 ? 0 : group.weekly_day;
  const newJsDay = newWeeklyDay === 7 ? 0 : newWeeklyDay;
  const dayDiff = (newJsDay - oldJsDay + 7) % 7;

  const newTitle = generateGroupTitle(newWeeklyDay, newStartTime, courseTitle);

  // Update the group
  await run(
    `UPDATE groups SET weekly_day = $1, start_time = $2, duration_minutes = $3, title = $4, updated_at = NOW() WHERE id = $5`,
    [newWeeklyDay, newStartTime, newDurationMinutes, newTitle, groupId]
  );

  // Update future scheduled lessons (not individually rescheduled ones)
  const updated = await run(
    `UPDATE lessons SET
       lesson_date = (lesson_date + ($1 * INTERVAL '1 day'))::date,
       start_datetime = (
         (lesson_date + ($1 * INTERVAL '1 day'))::date::timestamp + $2::time
       ) AT TIME ZONE 'Europe/Kyiv',
       end_datetime = (
         (lesson_date + ($1 * INTERVAL '1 day'))::date::timestamp + $2::time
       ) AT TIME ZONE 'Europe/Kyiv' + ($3 * INTERVAL '1 minute'),
       updated_at = NOW()
     WHERE group_id = $4
       AND status = 'scheduled'
       AND lesson_date >= CURRENT_DATE
       AND original_date IS NULL
     RETURNING id`,
    [dayDiff, newStartTime, newDurationMinutes, groupId]
  );

  return { lessonsUpdated: updated.length };
}
