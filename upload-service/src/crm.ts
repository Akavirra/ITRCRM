import { config } from './config.js';
import type { FinalizeUploadResult, LessonMediaContext, UploadTokenPayload } from './types.js';

async function crmFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${config.crmInternalApiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': config.crmInternalApiSecret,
      ...(init?.headers || {}),
    },
  });
}

export async function fetchLessonMediaContext(lessonId: number): Promise<LessonMediaContext> {
  const response = await crmFetch(`/api/internal/lessons/${lessonId}/media-context`, {
    method: 'GET',
    headers: {
      'X-Internal-Secret': config.crmInternalApiSecret,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lesson media context: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<LessonMediaContext>;
}

export async function finalizeLessonMediaUpload(
  lessonId: number,
  tokenPayload: UploadTokenPayload,
  file: {
    driveFileId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }
): Promise<FinalizeUploadResult> {
  const response = await crmFetch(`/api/internal/lessons/${lessonId}/media-finalize`, {
    method: 'POST',
    body: JSON.stringify({
      driveFileId: file.driveFileId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      uploadedBy: tokenPayload.userId,
      uploadedByName: tokenPayload.userName,
      uploadedVia: tokenPayload.via,
      uploadedByTelegramId: tokenPayload.telegramId ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to finalize lesson media upload: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<FinalizeUploadResult>;
}
