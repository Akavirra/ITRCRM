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

export type ShortcutKind = 'url' | 'app';

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

export interface ShortcutInput {
  kind: ShortcutKind;
  label: string;
  target: string;
  icon?: string | null;
  sortOrder?: number;
}

export interface ShortcutCreator {
  /** users.id адміна, або null якщо це викладач через telegram-бот. */
  userId: number | null;
  /** Ім'я для UI ("Хто додав: Олена"). */
  name: string | null;
  /** Telegram-id викладача (null для адміна). */
  telegramId: string | null;
}

// --- Валідація --------------------------------------------------------------

const MAX_LABEL_LENGTH = 80;
const MAX_TARGET_LENGTH = 1000;
const MAX_ICON_LENGTH = 32;

/** Дозволені схеми для url-ярликів. */
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Дозволені "схеми" для app-ярликів.
 *   - "scratch", "python", "blender" — символічна назва, агент мапить на локальний шлях
 *   - "ide:python" — IDE з аргументами (формат залишаємо вільним для агента)
 *   - "file:..." — файл з робочого простору учня (поки не реалізовано на агенті)
 *
 * Свідомо НЕ приймаємо повні file:// URI чи cmd-рядки — це поверхня атак.
 * Агент сам резолвить символічну назву через свій конфіг allowed-apps.
 */
const APP_SCHEME_RE = /^[a-z][a-z0-9_-]{0,40}(:[A-Za-z0-9._:/\-]{1,300})?$/;

export class ShortcutValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ShortcutValidationError';
  }
}

export function validateShortcutInput(input: unknown): ShortcutInput {
  if (!input || typeof input !== 'object') {
    throw new ShortcutValidationError('body', 'Очікується JSON-обʼєкт');
  }
  const raw = input as Record<string, unknown>;

  // kind
  const kind = raw.kind;
  if (kind !== 'url' && kind !== 'app') {
    throw new ShortcutValidationError('kind', 'kind має бути "url" або "app"');
  }

  // label
  const labelRaw = typeof raw.label === 'string' ? raw.label.trim() : '';
  if (!labelRaw) {
    throw new ShortcutValidationError('label', 'Назва обовʼязкова');
  }
  if (labelRaw.length > MAX_LABEL_LENGTH) {
    throw new ShortcutValidationError('label', `Назва не довша ${MAX_LABEL_LENGTH} символів`);
  }

  // target
  const targetRaw = typeof raw.target === 'string' ? raw.target.trim() : '';
  if (!targetRaw) {
    throw new ShortcutValidationError('target', 'Адреса обовʼязкова');
  }
  if (targetRaw.length > MAX_TARGET_LENGTH) {
    throw new ShortcutValidationError('target', `Адреса не довша ${MAX_TARGET_LENGTH} символів`);
  }

  if (kind === 'url') {
    let parsed: URL;
    try {
      parsed = new URL(targetRaw);
    } catch {
      throw new ShortcutValidationError(
        'target',
        'Неправильне посилання. Приклад: https://scratch.mit.edu',
      );
    }
    if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
      throw new ShortcutValidationError(
        'target',
        'Дозволені тільки http:// та https:// посилання',
      );
    }
  } else {
    // app
    if (!APP_SCHEME_RE.test(targetRaw)) {
      throw new ShortcutValidationError(
        'target',
        'Невалідний ідентифікатор програми. Приклад: scratch або ide:python',
      );
    }
  }

  // icon (опційний emoji чи коротка назва)
  let icon: string | null = null;
  if (raw.icon !== undefined && raw.icon !== null && raw.icon !== '') {
    if (typeof raw.icon !== 'string') {
      throw new ShortcutValidationError('icon', 'Іконка має бути рядком');
    }
    const iconRaw = raw.icon.trim();
    if (iconRaw.length > MAX_ICON_LENGTH) {
      throw new ShortcutValidationError('icon', 'Іконка задовга');
    }
    icon = iconRaw || null;
  }

  // sortOrder (опційний)
  let sortOrder: number | undefined;
  if (raw.sortOrder !== undefined && raw.sortOrder !== null) {
    const n = Number(raw.sortOrder);
    if (!Number.isFinite(n)) {
      throw new ShortcutValidationError('sortOrder', 'sortOrder має бути числом');
    }
    sortOrder = Math.trunc(n);
  }

  return { kind, label: labelRaw, target: targetRaw, icon, sortOrder };
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
