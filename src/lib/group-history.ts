import { run, get, all } from '@/db';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';
import { formatShortDateKyiv } from '@/lib/date-utils';

// Types for group history
export type GroupHistoryActionType =
  | 'created'
  | 'edited'
  | 'teacher_changed'
  | 'student_added'
  | 'student_removed'
  | 'student_graduated'
  | 'lesson_conducted'
  | 'status_changed'
  | 'deleted'
  | 'schedule_changed'
  | 'trial_student_added'
  | 'trial_student_removed';

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
export async function addGroupHistoryEntry(
  groupId: number,
  actionType: GroupHistoryActionType,
  actionDescription: string,
  userId: number,
  userName: string,
  oldValue?: string | null,
  newValue?: string | null
): Promise<number> {
  const result = await run(
    `INSERT INTO group_history (group_id, action_type, action_description, old_value, new_value, user_id, user_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
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

  try {
    const group = await get<{ title: string; public_id: string | null; course_id: number | null }>(
      `SELECT title, public_id, course_id FROM groups WHERE id = $1`,
      [groupId]
    );

    if (group) {
      await safeAddAuditEvent({
        entityType: 'group',
        entityId: groupId,
        entityPublicId: group.public_id ?? null,
        entityTitle: group.title,
        eventType: actionType,
        eventBadge: toAuditBadge(actionType),
        description: actionDescription,
        userId,
        userName,
        groupId,
        courseId: group.course_id ?? null,
        metadata: {
          source: 'group_history',
          oldValue: oldValue ?? null,
          newValue: newValue ?? null,
        },
      });
    }
  } catch (error) {
    console.error('[group-history] Failed to mirror audit event:', error);
  }

  return Number(result[0]?.id);
}

// Get group history entries
export async function getGroupHistory(groupId: number, limit?: number): Promise<GroupHistoryEntry[]> {
  const sql = limit
    ? `SELECT * FROM group_history WHERE group_id = $1 ORDER BY created_at DESC LIMIT $2`
    : `SELECT * FROM group_history WHERE group_id = $1 ORDER BY created_at DESC`;
  
  const params = limit ? [groupId, limit] : [groupId];
  
  return await all<GroupHistoryEntry>(sql, params);
}

// Get recent group history entries (for preview)
export async function getRecentGroupHistory(groupId: number, count: number = 4): Promise<GroupHistoryEntry[]> {
  return await all<GroupHistoryEntry>(
    `SELECT * FROM group_history WHERE group_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [groupId, count]
  );
}

// Delete group history entries (when group is deleted)
export async function deleteGroupHistory(groupId: number): Promise<void> {
  await run(`DELETE FROM group_history WHERE group_id = $1`, [groupId]);
}

// Helper function to format action description for student added
export function formatStudentAddedDescription(studentName: string): string {
  return `Додано учня: ${studentName}`;
}

// Helper function to format action description for student removed
export function formatStudentRemovedDescription(studentName: string): string {
  return `Видалено учня: ${studentName}`;
}

// Helper function to format action description for trial student added to a lesson
export function formatTrialStudentAddedDescription(studentName: string, lessonDate: string): string {
  return `Додано пробного учня ${studentName} на заняття ${formatShortDateKyiv(lessonDate)}`;
}

// Helper function to format action description for trial student removed from a lesson
export function formatTrialStudentRemovedDescription(studentName: string, lessonDate: string): string {
  return `Видалено пробного учня ${studentName} з заняття ${formatShortDateKyiv(lessonDate)}`;
}

// Helper function to format action description for student graduated
export function formatStudentGraduatedDescription(studentName: string, graduationDate: string): string {
  return `Випущено у��ня: ${studentName} (${graduationDate})`;
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
  const formattedDate = formatShortDateKyiv(lessonDate);
  if (topic) {
    return `Проведено заняття: ${formattedDate} (${topic})`;
  }
  return `Проведено заняття: ${formattedDate}`;
}

// Helper function to format action description for schedule changed
export function formatScheduleChangedDescription(
  oldDay: string,
  oldTime: string,
  newDay: string,
  newTime: string,
  oldDuration: number,
  newDuration: number,
): string {
  let desc = `Перенесено розклад: ${oldDay} ${oldTime} → ${newDay} ${newTime}`;
  if (oldDuration !== newDuration) {
    desc += ` (тривалість: ${oldDuration} → ${newDuration} хв)`;
  }
  return desc;
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
