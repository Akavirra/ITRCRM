import dotenv from 'dotenv';

dotenv.config();

function getRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }
  return parsed;
}

export const config = {
  port: getNumber('PORT', 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: getRequired('UPLOAD_SERVICE_JWT_SECRET'),
  crmInternalApiUrl: getRequired('CRM_INTERNAL_API_URL').replace(/\/$/, ''),
  crmInternalApiSecret: getRequired('CRM_INTERNAL_API_SECRET'),
  driveRootFolderId: getRequired('GOOGLE_DRIVE_ROOT_FOLDER_ID'),
  lessonPhotosRootName: process.env.GOOGLE_DRIVE_LESSON_PHOTOS_ROOT_NAME || 'Фото занять',
  googleClientId: getRequired('GOOGLE_OAUTH_CLIENT_ID'),
  googleClientSecret: getRequired('GOOGLE_OAUTH_CLIENT_SECRET'),
  googleRefreshToken: getRequired('GOOGLE_OAUTH_REFRESH_TOKEN'),
  maxUploadBytes: getNumber('MAX_UPLOAD_BYTES', 512 * 1024 * 1024),
  allowedOrigins: (process.env.UPLOAD_SERVICE_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
