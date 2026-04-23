import jwt from 'jsonwebtoken';

const BACKUP_TOKEN_TTL_SECONDS = 15 * 60;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getBackupServiceUrl(): string {
  return getRequiredEnv('UPLOAD_SERVICE_URL').replace(/\/$/, '');
}

export function createBackupServiceToken(input: {
  userId: number | null;
  userName: string | null;
  role: string | null;
}): string {
  const secret = getRequiredEnv('BACKUP_SERVICE_JWT_SECRET');

  return jwt.sign(
    {
      userId: input.userId,
      userName: input.userName,
      role: input.role,
    },
    secret,
    { expiresIn: BACKUP_TOKEN_TTL_SECONDS }
  );
}
