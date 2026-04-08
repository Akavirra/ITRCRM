import jwt from 'jsonwebtoken';

type UploadVia = 'admin' | 'telegram';

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
