import { run, all } from '@/db';
import { formatShortDateKyiv } from '@/lib/date-utils';

// Types for student history
export type StudentHistoryActionType =
  | 'created'
  | 'edited'
  | 'archived'
  | 'restored'
  | 'group_joined'
  | 'group_left'
  | 'lesson_attended'
  | 'lesson_missed'
  | 'lesson_makeup_planned'
  | 'lesson_makeup_done';

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

// Helper function to format attendance description
export function formatAttendanceDescription(
  status: string,
  lessonDate: string,
  groupTitle: string | null,
  topic: string | null,
  isIndividual: boolean
): string {
  const formattedDate = formatShortDateKyiv(lessonDate);
  const groupPart = isIndividual ? ' (індивідуальне)' : groupTitle ? ` — ${groupTitle}` : '';
  const topicPart = topic ? ` (${topic})` : '';

  switch (status) {
    case 'present':
      return `Присутній на занятті: ${formattedDate}${groupPart}${topicPart}`;
    case 'absent':
      return `Пропустив заняття: ${formattedDate}${groupPart}${topicPart}`;
    case 'makeup_planned':
      return `Заплановано відпрацювання: ${formattedDate}${groupPart}`;
    case 'makeup_done':
      return `Відпрацював пропуск: ${formattedDate}${groupPart}`;
    default:
      return `Відвідуваність: ${status} — ${formattedDate}${groupPart}`;
  }
}
