/**
 * Спільна (admin + teacher) валідація вводу для lesson_shortcuts.
 *
 * Це pure-функція без БД-залежностей — щоб teacher-портал міг імпортувати
 * без підтягування admin-клієнта `@/db`.
 *
 * Логіка ідентична до тієї, що була в src/lib/lesson-shortcuts.ts —
 * винесена сюди як єдина точка правди.
 */

export type ShortcutKind = 'url' | 'app';

export interface ShortcutInput {
  kind: ShortcutKind;
  label: string;
  target: string;
  icon?: string | null;
  sortOrder?: number;
}

const MAX_LABEL_LENGTH = 80;
const MAX_TARGET_LENGTH = 1000;
const MAX_ICON_LENGTH = 32;

const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Дозволені "схеми" для app-ярликів.
 *   - "scratch", "python", "blender" — символічна назва
 *   - "ide:python" — програма + квазі-аргумент
 *
 * Свідомо НЕ приймаємо повні file:// URI чи cmd-рядки — це поверхня атак.
 * Агент сам резолвить символічну назву через свій allowed-apps конфіг.
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

  const kind = raw.kind;
  if (kind !== 'url' && kind !== 'app') {
    throw new ShortcutValidationError('kind', 'kind має бути "url" або "app"');
  }

  const labelRaw = typeof raw.label === 'string' ? raw.label.trim() : '';
  if (!labelRaw) {
    throw new ShortcutValidationError('label', 'Назва обовʼязкова');
  }
  if (labelRaw.length > MAX_LABEL_LENGTH) {
    throw new ShortcutValidationError('label', `Назва не довша ${MAX_LABEL_LENGTH} символів`);
  }

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
    if (!APP_SCHEME_RE.test(targetRaw)) {
      throw new ShortcutValidationError(
        'target',
        'Невалідний ідентифікатор програми. Приклад: scratch або ide:python',
      );
    }
  }

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
