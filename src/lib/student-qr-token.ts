/**
 * Phase C.2: токен для QR-Upload (учень сканує QR на десктопі → відкриває
 * мобільну сторінку без потреби логінитись на телефоні).
 *
 * АРХІТЕКТУРНО:
 *   - Це окремий short-lived JWT (TTL 10 хв), НЕ повторне використання
 *     student_session cookie. Сесія залишається на десктопі.
 *   - Токен прив'язаний до `studentId + lessonId` — один QR = одне заняття.
 *   - aud='student-qr-upload' відсікає випадкове використання як session/upload-service токена.
 *   - jti — UUID, на майбутнє можна тримати use-once whitelist (не реалізовано — TTL короткий).
 *   - При споживанні (mobile-side) — повторно перевіряється upload-вікно: між
 *     видачею і використанням може минути час, і вікно могло закритись.
 *
 * Підпис: `JWT_SECRET` (та сама змінна, що й адмінський JWT, але різний `aud` =>
 * не можна сплутати). Не вводимо нову env-змінну — менше chance забути в проді.
 */

import 'server-only';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const QR_TOKEN_TTL_SECONDS = 10 * 60;
const QR_AUDIENCE = 'student-qr-upload';

interface SignInput {
  studentId: number;
  lessonId: number;
}

export interface QrTokenPayload {
  studentId: number;
  lessonId: number;
  jti: string;
  iat: number;
  exp: number;
}

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET не встановлено');
  return s;
}

export function createStudentQrToken(input: SignInput): { token: string; expiresAt: string } {
  if (!Number.isInteger(input.studentId) || input.studentId <= 0) {
    throw new Error('Invalid studentId');
  }
  if (!Number.isInteger(input.lessonId) || input.lessonId <= 0) {
    throw new Error('Invalid lessonId');
  }
  const jti = uuidv4();
  const token = jwt.sign(
    {
      studentId: input.studentId,
      lessonId: input.lessonId,
      jti,
    },
    getSecret(),
    {
      audience: QR_AUDIENCE,
      expiresIn: QR_TOKEN_TTL_SECONDS,
    },
  );
  const expiresAt = new Date(Date.now() + QR_TOKEN_TTL_SECONDS * 1000).toISOString();
  return { token, expiresAt };
}

/**
 * Перевіряє підпис, audience та exp. Повертає payload або null, якщо токен
 * невалідний/прострочений/чужої аудиторії. НЕ робить БД-запитів.
 */
export function verifyStudentQrToken(token: string): QrTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, getSecret(), { audience: QR_AUDIENCE }) as JwtPayload;
    const studentId = Number(decoded?.studentId);
    const lessonId = Number(decoded?.lessonId);
    const jti = typeof decoded?.jti === 'string' ? decoded.jti : null;
    const iat = Number(decoded?.iat);
    const exp = Number(decoded?.exp);
    if (!Number.isInteger(studentId) || studentId <= 0) return null;
    if (!Number.isInteger(lessonId) || lessonId <= 0) return null;
    if (!jti || !Number.isFinite(iat) || !Number.isFinite(exp)) return null;
    return { studentId, lessonId, jti, iat, exp };
  } catch {
    return null;
  }
}

export const QR_TOKEN_TTL_MS = QR_TOKEN_TTL_SECONDS * 1000;
