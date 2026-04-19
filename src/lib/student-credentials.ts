/**
 * Адмінська частина управління обліковими даними учнів.
 *
 * Працює через @/db (адмін-роль neondb_owner). Використовується ТІЛЬКИ з адмінських
 * роутів /api/admin/... — бо тільки адмін може створювати/відкликати коди і PIN-и.
 *
 * Конвенція таблиць:
 *   - student_codes        — публічні ID учнів (R0042); одна активна за раз на учня
 *   - student_credentials  — bcrypt-хеш PIN-у; одна активна за раз на учня
 *
 * ВАЖЛИВО: це не імпортувати з student-портальних роутів (/api/student/...) —
 * там треба @/lib/student-auth який ходить через роль crm_student.
 */

import 'server-only';
import bcrypt from 'bcryptjs';
import { get, run } from '@/db';
import {
  studentIdToCode,
  generateRandomPin,
} from '@/lib/student-auth';

// Реекспортуємо для зручності адмін-роутів
export { studentIdToCode, generateRandomPin };

export interface PinCardIssued {
  code: string;
  pin: string; // ⚠️ Plaintext — повертається ТІЛЬКИ при генерації, потім тільки хеш
  studentId: number;
  fullName: string;
}

export interface PinCardStatus {
  hasActiveCode: boolean;
  hasActivePin: boolean;
  code: string | null;
  codeCreatedAt: string | null;
  pinLast2: string | null;
  pinCreatedAt: string | null;
}

/**
 * Генерує (або перегенеровує) PIN-картку для учня.
 *
 * Попередні активні код і PIN позначаються is_active=FALSE + revoked_at=NOW().
 * Створюється новий код (студенто-детермінований R0042) і випадковий 6-значний PIN.
 *
 * ⚠️ PIN повертається у відкритому вигляді ТІЛЬКИ ЦЕЙ РАЗ — адмін має одразу
 * віддрукувати/показати учневі. У БД зберігається тільки bcrypt-хеш.
 */
export async function issuePinCard(
  studentId: number,
  adminUserId: number
): Promise<PinCardIssued> {
  const student = await get<{ id: number; full_name: string; is_active: boolean }>(
    `SELECT id, full_name, is_active FROM students WHERE id = $1`,
    [studentId]
  );
  if (!student) {
    throw new Error('Учня не знайдено');
  }
  if (!student.is_active) {
    throw new Error('Учень неактивний — картку видавати заборонено');
  }

  const code = studentIdToCode(studentId);
  const pin = generateRandomPin();
  const pinHash = await bcrypt.hash(pin, 10);
  const pinLast2 = pin.slice(-2);

  // Відкликаємо попередні активні код і PIN
  await run(
    `UPDATE student_codes
     SET is_active = FALSE, revoked_at = NOW()
     WHERE student_id = $1 AND is_active = TRUE`,
    [studentId]
  );
  await run(
    `UPDATE student_credentials
     SET is_active = FALSE, revoked_at = NOW()
     WHERE student_id = $1 AND is_active = TRUE`,
    [studentId]
  );

  // Створюємо новий код
  await run(
    `INSERT INTO student_codes (student_id, code, is_active, created_by)
     VALUES ($1, $2, TRUE, $3)`,
    [studentId, code, adminUserId]
  );
  // Новий PIN
  await run(
    `INSERT INTO student_credentials (student_id, pin_hash, pin_last2, is_active, created_by)
     VALUES ($1, $2, $3, TRUE, $4)`,
    [studentId, pinHash, pinLast2, adminUserId]
  );

  return {
    code,
    pin,
    studentId: student.id,
    fullName: student.full_name,
  };
}

/**
 * Відкликає активну картку (код + PIN). Учень більше не може залогінитись,
 * доки адмін не згенерує нову.
 */
export async function revokePinCard(studentId: number): Promise<void> {
  await run(
    `UPDATE student_codes
     SET is_active = FALSE, revoked_at = NOW()
     WHERE student_id = $1 AND is_active = TRUE`,
    [studentId]
  );
  await run(
    `UPDATE student_credentials
     SET is_active = FALSE, revoked_at = NOW()
     WHERE student_id = $1 AND is_active = TRUE`,
    [studentId]
  );
}

/** Статус поточної картки — для UI адміна (показати "PIN встановлено" + last2 hint). */
export async function getPinCardStatus(studentId: number): Promise<PinCardStatus> {
  const codeRow = await get<{ code: string; created_at: string }>(
    `SELECT code, created_at FROM student_codes WHERE student_id = $1 AND is_active = TRUE`,
    [studentId]
  );
  const credRow = await get<{ pin_last2: string; created_at: string }>(
    `SELECT pin_last2, created_at FROM student_credentials WHERE student_id = $1 AND is_active = TRUE`,
    [studentId]
  );
  return {
    hasActiveCode: !!codeRow,
    hasActivePin: !!credRow,
    code: codeRow?.code ?? null,
    codeCreatedAt: codeRow?.created_at ?? null,
    pinLast2: credRow?.pin_last2 ?? null,
    pinCreatedAt: credRow?.created_at ?? null,
  };
}
