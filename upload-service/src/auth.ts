import jwt from 'jsonwebtoken';
import { config } from './config.js';
import type { UploadTokenPayload } from './types.js';

export function verifyUploadToken(token: string): UploadTokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret);

  if (typeof decoded !== 'object' || !decoded) {
    throw new Error('Invalid upload token payload');
  }

  const payload = decoded as Partial<UploadTokenPayload>;

  if (typeof payload.lessonId !== 'number') {
    throw new Error('Upload token is missing lessonId');
  }

  if (payload.via !== 'admin' && payload.via !== 'telegram') {
    throw new Error('Upload token has invalid via value');
  }

  return {
    lessonId: payload.lessonId,
    userId: typeof payload.userId === 'number' ? payload.userId : null,
    userName: typeof payload.userName === 'string' ? payload.userName : null,
    via: payload.via,
    telegramId: typeof payload.telegramId === 'string' ? payload.telegramId : null,
    exp: typeof payload.exp === 'number' ? payload.exp : 0,
  };
}
