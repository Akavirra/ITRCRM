/**
 * Phase D.1: Lesson Shortcuts (admin/teacher CRUD).
 *
 * Ярлики на занятті — це посилання чи команди запуску локальних програм,
 * які викладач/адмін додає для учнів. На сторінці заняття в порталі учня
 * вони рендеряться як грід кнопок.
 *
 * Цей модуль використовує admin DB-клієнт `@/db` — викликають його:
 *   - адмінські API (/api/lessons/[id]/shortcuts/*)
 *   - teacher-app API (/api/teacher-app/lesson/[id]/shortcuts/*)
 *
 * Учнівський read-онлі шлях окремий — див. src/lib/student-shortcuts.ts.
 */

import { all, get, run } from '@/db';
import {
  validateShortcutInput,
  ShortcutValidationError,
  type ShortcutKind,
  type ShortcutInput,
} from './lesson-shortcuts-shared';

// Re-export для зворотної сумісності існуючих імпортів (api admin/teacher-app)
export { validateShortcutInput, ShortcutValidationError };
export type { ShortcutKind, ShortcutInput };

export interface LessonShortcutRow {
  id: number;
  lesson_id: number;
  kind: ShortcutKind;
  label: string;
  target: string;
  icon: string | null;
  sort_order: number;
  created_by_user: number | null;
  created_by_name: string | null;
  created_by_telegram_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShortcutCreator {
  /** users.id адміна, або null якщо це викладач через telegram-бот. */
  userId: number | null;
  /** Ім'я для UI ("Хто додав: Олена"). */
  name: string | null;
  /** Telegram-id викладача (null для адміна). */
  telegramId: string | null;
}

// --- CRUD -------------------------------------------------------------------

export async function listLessonShortcuts(lessonId: number): Promise<LessonShortcutRow[]> {
  if (!Number.isInteger(lessonId) || lessonId <= 0) return [];
  return all<LessonShortcutRow>(
    `SELECT id, lesson_id, kind, label, target, icon, sort_order,
            created_by_user, created_by_name, created_by_telegram_id,
            created_at, updated_at
     FROM lesson_shortcuts
     WHERE lesson_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [lessonId],
  );
}

export async function getLessonShortcut(id: number): Promise<LessonShortcutRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const row = await get<LessonShortcutRow>(
    `SELECT id, lesson_id, kind, label, target, icon, sort_order,
            created_by_user, created_by_name, created_by_telegram_id,
            created_at, updated_at
     FROM lesson_shortcuts WHERE id = $1`,
    [id],
  );
  return row ?? null;
}

export async function createLessonShortcut(
  lessonId: number,
  input: ShortcutInput,
  by: ShortcutCreator,
): Promise<LessonShortcutRow> {
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    throw new ShortcutValidationError('lessonId', 'Невалідний lessonId');
  }

  // Якщо sortOrder не вказано — кладемо в кінець
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const maxRow = await get<{ max_order: number | null }>(
      `SELECT MAX(sort_order)::int AS max_order FROM lesson_shortcuts WHERE lesson_id = $1`,
      [lessonId],
    );
    sortOrder = (maxRow?.max_order ?? -1) + 1;
  }

  const rows = await run(
    `INSERT INTO lesson_shortcuts
       (lesson_id, kind, label, target, icon, sort_order,
        created_by_user, created_by_name, created_by_telegram_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, lesson_id, kind, label, target, icon, sort_order,
               created_by_user, created_by_name, created_by_telegram_id,
               created_at, updated_at`,
    [
      lessonId,
      input.kind,
      input.label,
      input.target,
      input.icon ?? null,
      sortOrder,
      by.userId,
      by.name,
      by.telegramId,
    ],
  );
  return rows[0] as LessonShortcutRow;
}

export async function updateLessonShortcut(
  id: number,
  input: ShortcutInput,
): Promise<LessonShortcutRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null;

  const rows = await run(
    `UPDATE lesson_shortcuts
       SET kind = $2,
           label = $3,
           target = $4,
           icon = $5,
           sort_order = COALESCE($6, sort_order),
           updated_at = NOW()
     WHERE id = $1
     RETURNING id, lesson_id, kind, label, target, icon, sort_order,
               created_by_user, created_by_name, created_by_telegram_id,
               created_at, updated_at`,
    [
      id,
      input.kind,
      input.label,
      input.target,
      input.icon ?? null,
      input.sortOrder ?? null,
    ],
  );
  return (rows[0] as LessonShortcutRow | undefined) ?? null;
}

export async function deleteLessonShortcut(id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  const rows = await run(`DELETE FROM lesson_shortcuts WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}

/**
 * Перевірка, що викладач веде цю групу (для teacher-app endpoint).
 * Адмін цю перевірку не робить — у нього доступ до всіх занять.
 *
 * Повертає true якщо teacher_user_id — викладач групи цього заняття
 * (через group_teacher_assignments) або lesson_teacher_replacements.
 */
export async function teacherHasAccessToLesson(
  teacherUserId: number,
  lessonId: number,
): Promise<boolean> {
  if (!Number.isInteger(teacherUserId) || teacherUserId <= 0) return false;
  if (!Number.isInteger(lessonId) || lessonId <= 0) return false;

  const row = await get<{ ok: number }>(
    `SELECT 1 AS ok
     FROM lessons l
     WHERE l.id = $1
       AND (
         EXISTS (
           SELECT 1 FROM group_teacher_assignments gta
           WHERE gta.group_id = l.group_id AND gta.teacher_id = $2
         )
         OR EXISTS (
           SELECT 1 FROM lesson_teacher_replacements ltr
           WHERE ltr.lesson_id = l.id AND ltr.replacement_teacher_id = $2
         )
       )
     LIMIT 1`,
    [lessonId, teacherUserId],
  );
  return !!row;
}
