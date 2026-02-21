import { run, get, all } from '@/db';

// Types for group history
export type GroupHistoryActionType = 
  | 'created'
  | 'edited'
  | 'teacher_changed'
  | 'student_added'
  | 'student_removed'
  | 'lesson_conducted'
  | 'status_changed'
  | 'deleted';

export interface GroupHistoryEntry {
  id: number;
  group_id: number;
  action_type: GroupHistoryActionType;
  action_description: string;
  old_value: string | null;
  new_value: string | null;
  user_id: number;
  user_name: string;
  created_at: string;
}

// Add entry to group history
export function addGroupHistoryEntry(
  groupId: number,
  actionType: GroupHistoryActionType,
  actionDescription: string,
  userId: number,
  userName: string,
  oldValue?: string | null,
  newValue?: string | null
): number {
  const result = run(
    `INSERT INTO group_history (group_id, action_type, action_description, old_value, new_value, user_id, user_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      groupId,
      actionType,
      actionDescription,
      oldValue || null,
      newValue || null,
      userId,
      userName,
    ]
  );
  
  return Number(result.lastInsertRowid);
}

// Get group history entries
export function getGroupHistory(groupId: number, limit?: number): GroupHistoryEntry[] {
  const sql = limit
    ? `SELECT * FROM group_history WHERE group_id = ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM group_history WHERE group_id = ? ORDER BY created_at DESC`;
  
  const params = limit ? [groupId, limit] : [groupId];
  
  return all<GroupHistoryEntry>(sql, params);
}

// Get recent group history entries (for preview)
export function getRecentGroupHistory(groupId: number, count: number = 4): GroupHistoryEntry[] {
  return all<GroupHistoryEntry>(
    `SELECT * FROM group_history WHERE group_id = ? ORDER BY created_at DESC LIMIT ?`,
    [groupId, count]
  );
}

// Delete group history entries (when group is deleted)
export function deleteGroupHistory(groupId: number): void {
  run(`DELETE FROM group_history WHERE group_id = ?`, [groupId]);
}

// Helper function to format action description for student added
export function formatStudentAddedDescription(studentName: string): string {
  return `Додано учня: ${studentName}`;
}

// Helper function to format action description for student removed
export function formatStudentRemovedDescription(studentName: string): string {
  return `Видалено учня: ${studentName}`;
}

// Helper function to format action description for teacher changed
export function formatTeacherChangedDescription(oldTeacherName: string, newTeacherName: string): string {
  return `Змінено викладача: ${oldTeacherName} → ${newTeacherName}`;
}

// Helper function to format action description for status changed
export function formatStatusChangedDescription(oldStatus: string, newStatus: string): string {
  const statusLabels: Record<string, string> = {
    active: 'Активна',
    graduate: 'Випуск',
    inactive: 'Неактивна',
  };
  return `Змінено статус: ${statusLabels[oldStatus] || oldStatus} → ${statusLabels[newStatus] || newStatus}`;
}

// Helper function to format action description for lesson conducted
export function formatLessonConductedDescription(lessonDate: string, topic?: string | null): string {
  if (topic) {
    return `Проведено заняття: ${lessonDate} (${topic})`;
  }
  return `Проведено заняття: ${lessonDate}`;
}

// Helper function to format action description for field edited
export function formatFieldEditedDescription(fieldName: string, oldValue: string | null, newValue: string | null): string {
  const fieldLabels: Record<string, string> = {
    course_id: 'Курс',
    title: 'Назва',
    weekly_day: 'День тижня',
    start_time: 'Час початку',
    duration_minutes: 'Тривалість',
    start_date: 'Дата початку',
    end_date: 'Дата закінчення',
    capacity: 'Місць',
    monthly_price: 'Ціна за місяць',
    status: 'Статус',
    note: 'Нотатка',
    photos_folder_url: 'Посилання на фото',
    timezone: 'Часовий пояс',
  };
  
  const label = fieldLabels[fieldName] || fieldName;
  const oldVal = oldValue ?? '(порожньо)';
  const newVal = newValue ?? '(порожньо)';
  
  return `Змінено ${label}: ${oldVal} → ${newVal}`;
}
