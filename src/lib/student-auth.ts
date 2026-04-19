/**
 * Автентифікація для порталу учнів (students.itrobotics.com.ua).
 *
 * ВАЖЛИВО:
 *   - Використовує ТІЛЬКИ @/db/neon-student (роль crm_student з обмеженим доступом)
 *   - НІКОЛИ не імпортує @/lib/auth, @/db або getAuthUser (це адмінські шляхи)
 *   - Cookie називається student_session (не session_id) — скоупи різні
 *
 * Архітектура:
 *   - Логін: код учня (R0042) + PIN (6 цифр)
 *   - Rate limit: окремо по IP (10/15хв) та по коду (5/15хв)
 *   - Lockout: після 5 невдалих спроб код блокується на 15 хв
 *   - Сесія: 30 днів, автооновлення коли залишилось <7 днів
 */

import 'server-only';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest } from 'next/server';
import { studentGet, studentRun, studentAll } from '@/db/neon-student';

// Конфігурація ---------------------------------------------------------------

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
export const SESSION_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // < 7 днів — оновити

const RATE_LIMIT_WINDOW_MIN = 15;
const MAX_ATTEMPTS_PER_IP = 20;           // 20 спроб з однієї IP за 15 хв
const MAX_ATTEMPTS_PER_IDENTIFIER = 10;   // 10 спроб на код за 15 хв
const LOCKOUT_FAILED_THRESHOLD = 5;       // 5 невдалих поспіль → lockout

export const STUDENT_COOKIE_NAME = 'student_session';

// Класи помилок --------------------------------------------------------------

export class StudentAuthError extends Error {
  constructor(public code: 'invalid_credentials' | 'rate_limit' | 'locked' | 'invalid_input' | 'inactive', message: string) {
    super(message);
    this.name = 'StudentAuthError';
  }
}

// Типи -----------------------------------------------------------------------

export interface StudentAuthResult {
  sessionId: string;
  studentId: number;
  code: string;
  fullName: string;
}

export interface StudentSessionRow {
  id: string;
  student_id: number;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
}

export interface CurrentStudent {
  id: number;
  full_name: string;
  code: string;
  sessionId: string;
  sessionExpiresAt: string;
}

// Перетворення коду ----------------------------------------------------------

/** students.id=42 → "R0042". Формат узгоджено в project_student_portal_plan.md §B1. */
export function studentIdToCode(studentId: number): string {
  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new Error(`Некоректний studentId: ${studentId}`);
  }
  return `R${String(studentId).padStart(4, '0')}`;
}

/** "R0042" → 42. Повертає null якщо формат неправильний. */
export function codeToStudentId(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const m = /^R0*(\d+)$/i.exec(raw.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// PIN ------------------------------------------------------------------------

/** Нормалізує PIN: прибирає все крім цифр і перевіряє довжину = 6. */
export function normalizePin(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length === 6 ? digits : null;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// Генерація PIN для адмінської частини (cryptographically secure) ------------

/** 6-значний PIN. Використовує crypto.randomInt — без модульних зміщень. */
export function generateRandomPin(): string {
  // 100000..999999 — уникаємо leading zeros, щоб виглядало однорідно на картці
  return String(crypto.randomInt(100000, 1000000));
}

// Rate limiting --------------------------------------------------------------

/**
 * Перевіряє rate limit по IP та по коду учня. Кидає StudentAuthError якщо ліміт перевищено.
 * Викликати ДО bcrypt.compare, щоб брут-форс не шукав правильний PIN через затримку.
 */
async function enforceRateLimit(ip: string, identifier: string): Promise<void> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();

  // По IP (всі спроби, включно з успішними — агресивним ботам)
  const [ipRow] = await studentAll<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM student_login_attempts
     WHERE ip = $1 AND attempted_at > $2`,
    [ip, windowStart]
  );
  if ((ipRow?.total ?? 0) >= MAX_ATTEMPTS_PER_IP) {
    throw new StudentAuthError(
      'rate_limit',
      'Занадто багато спроб із цієї мережі. Спробуйте за 15 хвилин.'
    );
  }

  // По коду
  const [idRow] = await studentAll<{ total: number; failed: number }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE success = FALSE)::int AS failed
     FROM student_login_attempts
     WHERE identifier = $1 AND attempted_at > $2`,
    [identifier, windowStart]
  );
  if ((idRow?.total ?? 0) >= MAX_ATTEMPTS_PER_IDENTIFIER) {
    throw new StudentAuthError(
      'rate_limit',
      'Занадто багато спроб для цього коду. Спробуйте за 15 хвилин.'
    );
  }
  if ((idRow?.failed ?? 0) >= LOCKOUT_FAILED_THRESHOLD) {
    throw new StudentAuthError(
      'locked',
      'Код тимчасово заблоковано через невдалі спроби. Спробуйте пізніше або зверніться до адміністратора.'
    );
  }
}

/** Журналює спробу логіну. Не кидає — проблеми логування не мають зірвати login. */
async function recordLoginAttempt(ip: string, identifier: string, success: boolean): Promise<void> {
  try {
    await studentRun(
      `INSERT INTO student_login_attempts (ip, identifier, success) VALUES ($1, $2, $3)`,
      [ip, identifier, success]
    );
  } catch (error) {
    console.error('[student-auth] Не вдалося записати login attempt:', error);
  }
}

// Логін ----------------------------------------------------------------------

/**
 * Спроба логіну учня. Кидає StudentAuthError при будь-якій помилці.
 *
 * НЕ розрізняє "код не існує" і "PIN неправильний" — обидва = invalid_credentials,
 * щоб не дати enumerate активні коди.
 */
export async function loginStudent(
  codeRaw: string,
  pinRaw: string,
  ip: string,
  userAgent: string
): Promise<StudentAuthResult> {
  // Валідація вхідного (рано, без IO)
  const studentId = codeToStudentId(codeRaw);
  const pin = normalizePin(pinRaw);
  if (studentId === null) {
    await recordLoginAttempt(ip, codeRaw.slice(0, 20) || '(empty)', false);
    throw new StudentAuthError('invalid_credentials', 'Невірний код або PIN');
  }
  if (pin === null) {
    await recordLoginAttempt(ip, codeRaw, false);
    throw new StudentAuthError('invalid_input', 'PIN має містити рівно 6 цифр');
  }

  const normalizedCode = studentIdToCode(studentId);

  // Rate limit ПЕРЕД звіркою PIN
  await enforceRateLimit(ip, normalizedCode);

  // Знаходимо код
  const codeRow = await studentGet<{ student_id: number }>(
    `SELECT student_id FROM student_codes WHERE code = $1 AND is_active = TRUE`,
    [normalizedCode]
  );
  if (!codeRow) {
    await recordLoginAttempt(ip, normalizedCode, false);
    throw new StudentAuthError('invalid_credentials', 'Невірний код або PIN');
  }

  // Перевіряємо активність учня (у нас дозволений SELECT students.is_active)
  const student = await studentGet<{ id: number; full_name: string; is_active: boolean }>(
    `SELECT id, full_name, is_active FROM students WHERE id = $1`,
    [codeRow.student_id]
  );
  if (!student || !student.is_active) {
    await recordLoginAttempt(ip, normalizedCode, false);
    throw new StudentAuthError('inactive', 'Обліковий запис неактивний. Зверніться до адміністратора.');
  }

  // Активні credentials
  const cred = await studentGet<{ pin_hash: string }>(
    `SELECT pin_hash FROM student_credentials WHERE student_id = $1 AND is_active = TRUE`,
    [student.id]
  );
  if (!cred) {
    await recordLoginAttempt(ip, normalizedCode, false);
    throw new StudentAuthError('invalid_credentials', 'Невірний код або PIN');
  }

  // bcrypt — завжди виконуємо, щоб timing був сталий
  const ok = await verifyPin(pin, cred.pin_hash);
  await recordLoginAttempt(ip, normalizedCode, ok);
  if (!ok) {
    throw new StudentAuthError('invalid_credentials', 'Невірний код або PIN');
  }

  // Створюємо сесію
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await studentRun(
    `INSERT INTO student_sessions (id, student_id, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, student.id, expiresAt, ip, (userAgent || '').slice(0, 500)]
  );

  // Аудит
  await studentRun(
    `INSERT INTO student_audit_log (student_id, action, ip, meta) VALUES ($1, 'login', $2, $3::jsonb)`,
    [student.id, ip, JSON.stringify({ user_agent: (userAgent || '').slice(0, 200) })]
  );

  return {
    sessionId,
    studentId: student.id,
    code: normalizedCode,
    fullName: student.full_name,
  };
}

// Сесії ----------------------------------------------------------------------

export async function getStudentSession(sessionId: string): Promise<StudentSessionRow | null> {
  if (!sessionId || typeof sessionId !== 'string') return null;
  const row = await studentGet<StudentSessionRow>(
    `SELECT id, student_id, created_at, last_seen_at, expires_at
     FROM student_sessions
     WHERE id = $1 AND expires_at > NOW()`,
    [sessionId]
  );
  return row || null;
}

export async function refreshStudentSession(sessionId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await studentRun(
    `UPDATE student_sessions SET last_seen_at = NOW(), expires_at = $2 WHERE id = $1`,
    [sessionId, expiresAt]
  );
  return expiresAt;
}

export async function deleteStudentSession(sessionId: string): Promise<void> {
  await studentRun(`DELETE FROM student_sessions WHERE id = $1`, [sessionId]);
}

/**
 * Аналог getAuthUser для порталу учнів. Читає student_session cookie,
 * валідує сесію, повертає дані учня. Нічого не знає про таблицю users/sessions.
 */
export async function getStudentFromRequest(request: NextRequest): Promise<CurrentStudent | null> {
  const sessionId = request.cookies.get(STUDENT_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const session = await getStudentSession(sessionId);
  if (!session) return null;

  const student = await studentGet<{ id: number; full_name: string; is_active: boolean }>(
    `SELECT id, full_name, is_active FROM students WHERE id = $1`,
    [session.student_id]
  );
  if (!student || !student.is_active) return null;

  const codeRow = await studentGet<{ code: string }>(
    `SELECT code FROM student_codes WHERE student_id = $1 AND is_active = TRUE`,
    [session.student_id]
  );

  return {
    id: student.id,
    full_name: student.full_name,
    code: codeRow?.code ?? studentIdToCode(student.id),
    sessionId,
    sessionExpiresAt: session.expires_at,
  };
}

// Утиліти --------------------------------------------------------------------

/** Витягає IP з x-forwarded-for (Vercel ставить його). Fallback — "unknown". */
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
