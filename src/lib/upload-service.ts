import jwt from 'jsonwebtoken';

type UploadVia = 'admin' | 'telegram' | 'student';

const UPLOAD_TOKEN_TTL_SECONDS = 10 * 60;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getUploadServiceUrl(): string {
  return getRequiredEnv('UPLOAD_SERVICE_URL').replace(/\/$/, '');
}

export function getInternalApiSecret(): string {
  return getRequiredEnv('CRM_INTERNAL_API_SECRET');
}

export function assertInternalApiSecret(request: Request): boolean {
  const secret = request.headers.get('x-internal-secret');
  if (!secret) return false;

  return secret === getInternalApiSecret();
}

export function createUploadServiceToken(input: {
  lessonId: number;
  userId: number | null;
  userName: string | null;
  via: UploadVia;
  telegramId?: string | null;
}): string {
  const secret = getRequiredEnv('UPLOAD_SERVICE_JWT_SECRET');

  return jwt.sign(
    {
      lessonId: input.lessonId,
      userId: input.userId,
      userName: input.userName,
      via: input.via,
      telegramId: input.telegramId ?? null,
    },
    secret,
    { expiresIn: UPLOAD_TOKEN_TTL_SECONDS }
  );
}

/**
 * Окремий токен для завантаження робіт учня через /upload/student-work.
 * На відміну від createUploadServiceToken (який для занять), тут:
 *   • via='student'
 *   • присутні studentId/studentCode/studentFullName (verifyUploadToken перевіряє)
 *   • workTitle/workDescription/courseId/lessonId — опціональний контекст
 *     (проксюється в /api/internal/student-works/finalize при збереженні).
 */
export function createStudentWorkUploadToken(input: {
  studentId: number;
  studentCode: string;
  studentFullName: string;
  workTitle?: string | null;
  workDescription?: string | null;
  courseId?: number | null;
  lessonId?: number | null;
}): string {
  const secret = getRequiredEnv('UPLOAD_SERVICE_JWT_SECRET');

  return jwt.sign(
    {
      lessonId: input.lessonId ?? 0,
      userId: null,
      userName: input.studentFullName,
      via: 'student',
      studentId: input.studentId,
      studentCode: input.studentCode,
      studentFullName: input.studentFullName,
      workTitle: input.workTitle ?? null,
      workDescription: input.workDescription ?? null,
      courseId: input.courseId ?? null,
    },
    secret,
    { expiresIn: UPLOAD_TOKEN_TTL_SECONDS }
  );
}
