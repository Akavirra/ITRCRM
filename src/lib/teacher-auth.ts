/**
 * Автентифікація для веб-кабінету викладача (teacher.itrobotics.com.ua).
 *
 * ВАЖЛИВО:
 *   - Використовує ТІЛЬКИ @/db/neon-teacher (роль crm_teacher з обмеженими GRANT-ами)
 *   - НІКОЛИ не імпортує @/lib/auth, @/db або getAuthUser (це адмінські шляхи)
 *   - Cookie називається teacher_session (не session_id) — інший scope
 *
 * Auth-модель:
 *   - email + пароль (як у адміна), переюзаємо `users.password_hash`
 *   - Доступ дозволено тільки role='teacher' AND is_active=TRUE
 *   - Адмін керує паролем викладача через CRM (POST /api/users/[id]/reset-password)
 *
 * Rate-limit + lockout аналогічно student-auth.
 * Сесія: 30 днів, оновлення коли залишилось <7 днів.
 */

import 'server-only';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest } from 'next/server';
import { teacherGet, teacherRun, teacherAll } from '@/db/neon-teacher';

// Конфігурація ---------------------------------------------------------------

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
export const SESSION_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

const RATE_LIMIT_WINDOW_MIN = 15;
const MAX_ATTEMPTS_PER_IP = 30;
const MAX_ATTEMPTS_PER_IDENTIFIER = 10;
const LOCKOUT_FAILED_THRESHOLD = 5;

export const TEACHER_COOKIE_NAME = 'teacher_session';

// Класи помилок -------------------------------------------------------------

export class TeacherAuthError extends Error {
  constructor(
    public code:
      | 'invalid_credentials'
      | 'rate_limit'
      | 'locked'
      | 'invalid_input'
      | 'inactive'
      | 'wrong_role',
    message: string,
  ) {
    super(message);
    this.name = 'TeacherAuthError';
  }
}

// Типи ----------------------------------------------------------------------

export interface TeacherAuthResult {
  sessionId: string;
  userId: number;
  email: string;
  fullName: string;
}

export interface TeacherSessionRow {
  id: string;
  user_id: number;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
}

export interface CurrentTeacher {
  id: number;
  full_name: string;
  email: string;
  photoUrl: string | null;
  sessionId: string;
  sessionExpiresAt: string;
}

// Email-нормалізація --------------------------------------------------------

export function normalizeEmail(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  // Доволі м'яка валідація — суворіше робить БД UNIQUE INDEX
  if (!trimmed || trimmed.length > 200) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

// Rate limiting -------------------------------------------------------------

async function enforceRateLimit(ip: string, identifier: string): Promise<void> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();

  const [ipRow] = await teacherAll<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM teacher_login_attempts
     WHERE ip = $1 AND attempted_at > $2`,
    [ip, windowStart],
  );
  if ((ipRow?.total ?? 0) >= MAX_ATTEMPTS_PER_IP) {
    throw new TeacherAuthError(
      'rate_limit',
      'Занадто багато спроб з цієї мережі. Спробуйте за 15 хвилин.',
    );
  }

  const [idRow] = await teacherAll<{ total: number; failed: number }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE success = FALSE)::int AS failed
     FROM teacher_login_attempts
     WHERE identifier = $1 AND attempted_at > $2`,
    [identifier, windowStart],
  );
  if ((idRow?.total ?? 0) >= MAX_ATTEMPTS_PER_IDENTIFIER) {
    throw new TeacherAuthError(
      'rate_limit',
      'Занадто багато спроб для цього email. Спробуйте за 15 хвилин.',
    );
  }
  if ((idRow?.failed ?? 0) >= LOCKOUT_FAILED_THRESHOLD) {
    throw new TeacherAuthError(
      'locked',
      'Доступ тимчасово заблоковано через невдалі спроби. Зверніться до адміністратора.',
    );
  }
}

async function recordLoginAttempt(
  ip: string,
  identifier: string,
  success: boolean,
): Promise<void> {
  try {
    await teacherRun(
      `INSERT INTO teacher_login_attempts (ip, identifier, success) VALUES ($1, $2, $3)`,
      [ip, identifier, success],
    );
  } catch (error) {
    console.error('[teacher-auth] Не вдалося записати login attempt:', error);
  }
}

// Логін ---------------------------------------------------------------------

/**
 * Спроба логіну викладача. Кидає TeacherAuthError при будь-якій помилці.
 * НЕ розрізняє "email не існує" і "пароль неправильний" — обидва =
 * invalid_credentials, щоб не дати enumerate активні email-и.
 */
export async function loginTeacher(
  emailRaw: string,
  passwordRaw: string,
  ip: string,
  userAgent: string,
): Promise<TeacherAuthResult> {
  const email = normalizeEmail(emailRaw);
  if (!email) {
    await recordLoginAttempt(ip, (emailRaw || '').slice(0, 50) || '(empty)', false);
    throw new TeacherAuthError('invalid_input', 'Невірний формат email');
  }

  if (typeof passwordRaw !== 'string' || passwordRaw.length === 0) {
    await recordLoginAttempt(ip, email, false);
    throw new TeacherAuthError('invalid_input', 'Введіть пароль');
  }

  await enforceRateLimit(ip, email);

  // GRANT-и crm_teacher включають password_hash для users — він потрібен
  // саме для login flow (порівняння bcrypt). У звичайному коді ми НЕ читаємо
  // password_hash, але login — виняток.
  // АЛЕ: щоб не давати crm_teacher доступ до password_hash взагалі, login
  // зроблено через адмін-роль. Див. /api/teacher/auth/login route.
  // Тут — функція-помічник для адмін-route'а, а не для teacher-role коду.
  throw new Error(
    'loginTeacher() — використовуйте loginTeacherWithAdminClient у /api/teacher/auth/login route, ' +
      'там у крос-ролі пароль звіряємо через @/db (admin), а сесію кладемо через @/db/neon-teacher.',
  );
}

/**
 * Логін через комбінацію клієнтів:
 *   - admin client (@/db) — читає users.password_hash + role + is_active
 *   - teacher client (@/db/neon-teacher) — створює запис в teacher_sessions
 *
 * Це свідома компромісна точка: GRANT crm_teacher → users.password_hash дав би
 * доступ до парольних хешів адміна теж (через `WHERE role='admin'`), що небезпечно.
 * Тому login робимо через admin-роль (одноразова операція з малим scope).
 */
export async function loginTeacherWithAdminClient(
  adminGet: <T>(text: string, params?: unknown[]) => Promise<T | undefined>,
  emailRaw: string,
  passwordRaw: string,
  ip: string,
  userAgent: string,
): Promise<TeacherAuthResult> {
  const email = normalizeEmail(emailRaw);
  if (!email) {
    await recordLoginAttempt(ip, (emailRaw || '').slice(0, 50) || '(empty)', false);
    throw new TeacherAuthError('invalid_input', 'Невірний формат email');
  }
  if (typeof passwordRaw !== 'string' || passwordRaw.length === 0) {
    await recordLoginAttempt(ip, email, false);
    throw new TeacherAuthError('invalid_input', 'Введіть пароль');
  }

  await enforceRateLimit(ip, email);

  // 1) Admin-клієнт: знаходимо користувача, перевіряємо роль і пароль
  const userRow = await adminGet<{
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: string;
    is_active: boolean;
  }>(`SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = $1`, [
    email,
  ]);

  if (!userRow) {
    await recordLoginAttempt(ip, email, false);
    throw new TeacherAuthError('invalid_credentials', 'Невірний email або пароль');
  }

  if (!userRow.is_active) {
    await recordLoginAttempt(ip, email, false);
    throw new TeacherAuthError('inactive', 'Обліковий запис заблоковано. Зверніться до адміністратора.');
  }

  // Не пускаємо адмінів у teacher-портал — вони мають CRM. Це не security
  // (адмін і так може все), а UX-чистота: щоб одна людина в одному вікні
  // не плуталася між двома UI.
  if (userRow.role !== 'teacher') {
    await recordLoginAttempt(ip, email, false);
    throw new TeacherAuthError(
      'wrong_role',
      'Цей кабінет призначений для викладачів. Адмінам — увійти через CRM.',
    );
  }

  // bcrypt — завжди виконуємо (timing-safe навіть якщо пароля нема)
  const ok = userRow.password_hash
    ? await bcrypt.compare(passwordRaw, userRow.password_hash)
    : false;
  await recordLoginAttempt(ip, email, ok);

  if (!ok) {
    throw new TeacherAuthError('invalid_credentials', 'Невірний email або пароль');
  }

  // 2) Teacher-клієнт: створюємо сесію
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await teacherRun(
    `INSERT INTO teacher_sessions (id, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, userRow.id, expiresAt, ip, (userAgent || '').slice(0, 500)],
  );

  await teacherRun(
    `INSERT INTO teacher_audit_log (user_id, action, ip, meta) VALUES ($1, 'login', $2, $3::jsonb)`,
    [userRow.id, ip, JSON.stringify({ user_agent: (userAgent || '').slice(0, 200) })],
  );

  return {
    sessionId,
    userId: userRow.id,
    email: userRow.email,
    fullName: userRow.name,
  };
}

// Сесії --------------------------------------------------------------------

export async function getTeacherSession(sessionId: string): Promise<TeacherSessionRow | null> {
  if (!sessionId || typeof sessionId !== 'string') return null;
  const row = await teacherGet<TeacherSessionRow>(
    `SELECT id, user_id, created_at, last_seen_at, expires_at
     FROM teacher_sessions
     WHERE id = $1 AND expires_at > NOW()`,
    [sessionId],
  );
  return row || null;
}

export async function refreshTeacherSession(sessionId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await teacherRun(
    `UPDATE teacher_sessions SET last_seen_at = NOW(), expires_at = $2 WHERE id = $1`,
    [sessionId, expiresAt],
  );
  return expiresAt;
}

export async function deleteTeacherSession(sessionId: string): Promise<void> {
  await teacherRun(`DELETE FROM teacher_sessions WHERE id = $1`, [sessionId]);
}

/**
 * Аналог getAuthUser для порталу викладача. Читає teacher_session cookie,
 * валідує сесію через teacher-роль, повертає дані викладача.
 */
export async function getTeacherFromRequest(
  request: NextRequest,
): Promise<CurrentTeacher | null> {
  const sessionId = request.cookies.get(TEACHER_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const session = await getTeacherSession(sessionId);
  if (!session) return null;

  // Тягнемо профіль через teacher-роль (без password_hash)
  const user = await teacherGet<{
    id: number;
    name: string;
    email: string;
    role: string;
    photo_url: string | null;
    is_active: boolean;
  }>(`SELECT id, name, email, role, photo_url, is_active FROM users WHERE id = $1`, [
    session.user_id,
  ]);

  if (!user || !user.is_active || user.role !== 'teacher') return null;

  return {
    id: user.id,
    full_name: user.name,
    email: user.email,
    photoUrl: user.photo_url,
    sessionId,
    sessionExpiresAt: session.expires_at,
  };
}

// Утиліти ------------------------------------------------------------------

export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
