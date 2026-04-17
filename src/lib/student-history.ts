import { get, run, all } from '@/db';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';
import { formatShortDateKyiv } from '@/lib/date-utils';

// Types for student history
export type StudentHistoryActionType =
  | 'created'
  | 'edited'
  | 'archived'
  | 'restored'
  | 'group_joined'
  | 'group_left'
  | 'group_graduated'
  | 'lesson_attended'
  | 'lesson_missed'
  | 'lesson_makeup_planned'
  | 'lesson_makeup_done'
  | 'trial_lesson_scheduled'
  | 'trial_lesson_attended'
  | 'trial_lesson_missed'
  | 'trial_lesson_removed';

export interface StudentHistoryEntry {
  id: number;
  student_id: number;
  action_type: StudentHistoryActionType;
  action_description: string;
  old_value: string | null;
  new_value: string | null;
  user_id: number;
  user_name: string;
  created_at: string;
}

// Add entry to student history
export async function addStudentHistoryEntry(
  studentId: number,
  actionType: StudentHistoryActionType,
  actionDescription: string,
  userId: number,
  userName: string,
  oldValue?: string | null,
  newValue?: string | null
): Promise<number> {
  const result = await run(
    `INSERT INTO student_history (student_id, action_type, action_description, old_value, new_value, user_id, user_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      studentId,
      actionType,
      actionDescription,
      oldValue || null,
      newValue || null,
      userId,
      userName,
    ]
  );

  return Number(result[0]?.id);
}

async function mirrorStudentHistoryToAudit(
  studentId: number,
  actionType: StudentHistoryActionType,
  actionDescription: string,
  userId: number,
  userName: string,
  oldValue?: string | null,
  newValue?: string | null
): Promise<void> {
  const student = await get<{ full_name: string; public_id: string | null }>(
    `SELECT full_name, public_id FROM students WHERE id = $1`,
    [studentId]
  );

  if (!student) {
    return;
  }

  await safeAddAuditEvent({
    entityType: 'student',
    entityId: studentId,
    entityPublicId: student.public_id ?? null,
    entityTitle: student.full_name,
    eventType: actionType,
    eventBadge: toAuditBadge(actionType),
    description: actionDescription,
    userId,
    userName,
    studentId,
    metadata: {
      source: 'student_history',
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    },
  });
}

// Non-fatal wrapper — history logging must never break the main operation
export async function safeAddStudentHistoryEntry(
  studentId: number,
  actionType: StudentHistoryActionType,
  actionDescription: string,
  userId: number,
  userName: string,
  oldValue?: string | null,
  newValue?: string | null
): Promise<void> {
  try {
    await addStudentHistoryEntry(studentId, actionType, actionDescription, userId, userName, oldValue, newValue);
  } catch (err) {
    console.error('[student-history] Failed to log entry:', err);
    return;
  }

  await mirrorStudentHistoryToAudit(studentId, actionType, actionDescription, userId, userName, oldValue, newValue);
}

// Get student history entries
export async function getStudentHistory(studentId: number, limit?: number): Promise<StudentHistoryEntry[]> {
  const sql = limit
    ? `SELECT * FROM student_history WHERE student_id = $1 ORDER BY created_at DESC LIMIT $2`
    : `SELECT * FROM student_history WHERE student_id = $1 ORDER BY created_at DESC`;

  const params = limit ? [studentId, limit] : [studentId];

  return await all<StudentHistoryEntry>(sql, params);
}

// Get recent student history entries (for preview)
export async function getRecentStudentHistory(studentId: number, count: number = 4): Promise<StudentHistoryEntry[]> {
  return await all<StudentHistoryEntry>(
    `SELECT * FROM student_history WHERE student_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [studentId, count]
  );
}

// Helper function to format action description for field edited
export function formatFieldEditedDescription(fieldName: string, oldValue: string | null, newValue: string | null): string {
  const fieldLabels: Record<string, string> = {
    full_name: 'ПІБ',
    phone: 'Телефон',
    email: 'Email',
    parent_name: "Ім'я батьків",
    parent_phone: 'Телефон батьків',
    birth_date: 'Дата народження',
    school: 'Школа',
    discount: 'Знижка',
    notes: 'Нотатки',
    source: 'Джерело',
    interested_courses: 'Цікаві курси',
    parent_relation: 'Ким є (1 контакт)',
    parent2_name: 'Другий контакт',
    parent2_relation: 'Ким є (2 контакт)',
  };

  const label = fieldLabels[fieldName] || fieldName;
  const oldVal = oldValue ?? '(порожньо)';
  const newVal = newValue ?? '(порожньо)';

  return `Оновлено ${label}: ${oldVal} → ${newVal}`;
}

// Helper function to format action description for group joined
export function formatGroupJoinedDescription(groupTitle: string): string {
  return `Доданий до групи «${groupTitle}»`;
}

// Helper function to format action description for group left
export function formatGroupLeftDescription(groupTitle: string): string {
  return `Видалений з групи «${groupTitle}»`;
}

// Helper function to format action description for group graduated
export function formatGroupGraduatedDescription(groupTitle: string): string {
  return `Випущений з групи «${groupTitle}»`;
}

// Helper function to format attendance description
export function formatAttendanceDescription(
  status: string,
  lessonDate: string,
  groupTitle: string | null,
  topic: string | null,
  isIndividual: boolean,
  isTrial: boolean = false
): string {
  const formattedDate = formatShortDateKyiv(lessonDate);
  const groupPart = isIndividual ? ' (індивідуальне)' : groupTitle ? ` — ${groupTitle}` : '';
  const topicPart = topic ? ` (${topic})` : '';
  const trialSuffix = isTrial ? ' (пробне)' : '';

  switch (status) {
    case 'present':
      return `Присутній на занятті: ${formattedDate}${groupPart}${topicPart}${trialSuffix}`;
    case 'absent':
      return `Пропустив заняття: ${formattedDate}${groupPart}${topicPart}${trialSuffix}`;
    case 'makeup_planned':
      return `Заплановано відпрацювання: ${formattedDate}${groupPart}`;
    case 'makeup_done':
      return `Відпрацював пропуск: ${formattedDate}${groupPart}`;
    default:
      return `${status}: ${formattedDate}${groupPart}${topicPart}${trialSuffix}`;
  }
}

// Helper function to format action description for trial lesson scheduled
export function formatTrialScheduledDescription(
  lessonDate: string,
  groupTitle: string | null,
  topic: string | null,
): string {
  const formattedDate = formatShortDateKyiv(lessonDate);
  const groupPart = groupTitle ? ` — ${groupTitle}` : '';
  const topicPart = topic ? ` (${topic})` : '';
  return `Заплановано пробне заняття: ${formattedDate}${groupPart}${topicPart}`;
}

// Helper function to format action description for trial lesson removed
export function formatTrialRemovedDescription(
  lessonDate: string,
  groupTitle: string | null,
): string {
  const formattedDate = formatShortDateKyiv(lessonDate);
  const groupPart = groupTitle ? ` — ${groupTitle}` : '';
  return `Скасовано пробне заняття: ${formattedDate}${groupPart}`;
}
