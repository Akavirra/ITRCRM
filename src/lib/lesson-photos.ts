import { get, all, run } from '@/db';
import {
  getDriveFolderUrl,
  getDriveThumbnailUrl,
  getOrCreateFolder,
  makeFilePublic,
  renameDriveFolder,
  sanitizeDriveFolderName,
  uploadFileToDrive,
  deleteFileFromDrive,
  getDriveViewUrl,
} from '@/lib/google-drive';

const LESSON_PHOTOS_ROOT_NAME = process.env.GOOGLE_DRIVE_LESSON_PHOTOS_ROOT_NAME || 'Фото занять';
const LESSON_PHOTOS_FALLBACK_TOPIC = 'Без теми';

type UploadVia = 'admin' | 'telegram';

interface LessonPhotoFolderRow {
  lesson_id: number;
  course_folder_id: string;
  group_folder_id: string;
  lesson_folder_id: string;
  lesson_folder_name: string;
  drive_url: string;
}

interface LessonPhotoFileRow {
  id: number;
  lesson_id: number;
  drive_file_id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: number | null;
  uploaded_by_name: string | null;
  uploaded_via: UploadVia;
  uploaded_by_telegram_id: string | null;
  created_at: string;
}

interface LessonPhotoContext {
  lessonId: number;
  groupId: number;
  courseTitle: string;
  groupTitle: string;
  lessonDate: string;
  topic: string | null;
}

export interface LessonPhotoFolderInfo {
  id: string;
  name: string;
  url: string;
  exists: boolean;
}

export interface LessonPhotoFileInfo {
  id: number;
  driveFileId: string;
  url: string;
  thumbnailUrl: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  uploadedAt: string;
  uploadedBy: string | null;
  uploadedVia: UploadVia;
}

export interface LessonPhotoUploadResult {
  photoFolder: LessonPhotoFolderInfo;
  files: LessonPhotoFileInfo[];
}

function getRootFolderId(): string {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) {
    throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID is not set');
  }

  return rootId;
}

function formatLessonFolderDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

export function buildLessonFolderName(lessonDate: string, topic: string | null): string {
  const safeTopic = sanitizeDriveFolderName(topic?.trim() || LESSON_PHOTOS_FALLBACK_TOPIC, LESSON_PHOTOS_FALLBACK_TOPIC);
  return `${formatLessonFolderDate(lessonDate)} ${safeTopic}`;
}

async function getLessonPhotoContext(lessonId: number): Promise<LessonPhotoContext | null> {
  return (await get<LessonPhotoContext>(
    `SELECT
       l.id as "lessonId",
       l.group_id as "groupId",
       l.lesson_date as "lessonDate",
       l.topic as topic,
       c.title as "courseTitle",
       g.title as "groupTitle"
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     WHERE l.id = $1`,
    [lessonId]
  )) ?? null;
}

async function getStoredLessonPhotoFolder(lessonId: number): Promise<LessonPhotoFolderRow | null> {
  return (await get<LessonPhotoFolderRow>(
    `SELECT lesson_id, course_folder_id, group_folder_id, lesson_folder_id, lesson_folder_name, drive_url
     FROM lesson_photo_folders
     WHERE lesson_id = $1`,
    [lessonId]
  )) ?? null;
}

function mapFolder(row: LessonPhotoFolderRow | null): LessonPhotoFolderInfo | null {
  if (!row) return null;
  return {
    id: row.lesson_folder_id,
    name: row.lesson_folder_name,
    url: row.drive_url,
    exists: true,
  };
}

function mapPhoto(row: LessonPhotoFileRow): LessonPhotoFileInfo {
  return {
    id: row.id,
    driveFileId: row.drive_file_id,
    url: getDriveViewUrl(row.drive_file_id),
    thumbnailUrl: getDriveThumbnailUrl(row.drive_file_id),
    fileName: row.file_name,
    mimeType: row.mime_type,
    size: row.file_size,
    uploadedAt: row.created_at,
    uploadedBy: row.uploaded_by_name,
    uploadedVia: row.uploaded_via,
  };
}

export async function ensureLessonPhotoFolder(lessonId: number): Promise<LessonPhotoFolderInfo | null> {
  const lesson = await getLessonPhotoContext(lessonId);

  if (!lesson?.groupId) {
    return null;
  }

  const existing = await getStoredLessonPhotoFolder(lessonId);
  if (existing) {
    return mapFolder(existing);
  }

  const rootFolder = await getOrCreateFolder(getRootFolderId(), LESSON_PHOTOS_ROOT_NAME);
  const courseFolder = await getOrCreateFolder(rootFolder.id, lesson.courseTitle || 'Без курсу');
  const groupFolder = await getOrCreateFolder(courseFolder.id, lesson.groupTitle || `Група ${lesson.groupId}`);
  const lessonFolderName = buildLessonFolderName(lesson.lessonDate, lesson.topic);
  const lessonFolder = await getOrCreateFolder(groupFolder.id, lessonFolderName);
  const driveUrl = lessonFolder.webViewLink || getDriveFolderUrl(lessonFolder.id);

  await run(
    `INSERT INTO lesson_photo_folders
      (lesson_id, course_folder_id, group_folder_id, lesson_folder_id, lesson_folder_name, drive_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (lesson_id)
     DO UPDATE SET
       course_folder_id = EXCLUDED.course_folder_id,
       group_folder_id = EXCLUDED.group_folder_id,
       lesson_folder_id = EXCLUDED.lesson_folder_id,
       lesson_folder_name = EXCLUDED.lesson_folder_name,
       drive_url = EXCLUDED.drive_url,
       updated_at = NOW()`,
    [lessonId, courseFolder.id, groupFolder.id, lessonFolder.id, lessonFolderName, driveUrl]
  );

  await run(
    `INSERT INTO lesson_change_logs
      (lesson_id, field_name, old_value, new_value, changed_by_name, changed_via)
     VALUES ($1, 'photos', $2, $3, $4, $5)`,
    [lessonId, null, `Створено папку: ${lessonFolderName}`, 'System', 'admin']
  );

  return {
    id: lessonFolder.id,
    name: lessonFolderName,
    url: driveUrl,
    exists: true,
  };
}

export async function syncLessonPhotoFolderName(lessonId: number): Promise<LessonPhotoFolderInfo | null> {
  const lesson = await getLessonPhotoContext(lessonId);

  if (!lesson?.groupId) {
    return null;
  }

  const existing = await getStoredLessonPhotoFolder(lessonId);
  if (!existing) {
    return null;
  }

  const nextName = buildLessonFolderName(lesson.lessonDate, lesson.topic);
  if (existing.lesson_folder_name === nextName) {
    return mapFolder(existing);
  }

  const renamed = await renameDriveFolder(existing.lesson_folder_id, nextName);
  const driveUrl = renamed.webViewLink || getDriveFolderUrl(renamed.id);

  await run(
    `UPDATE lesson_photo_folders
     SET lesson_folder_name = $1, drive_url = $2, updated_at = NOW()
     WHERE lesson_id = $3`,
    [nextName, driveUrl, lessonId]
  );

  await run(
    `INSERT INTO lesson_change_logs
      (lesson_id, field_name, old_value, new_value, changed_by_name, changed_via)
     VALUES ($1, 'photos', $2, $3, $4, $5)`,
    [lessonId, existing.lesson_folder_name, `Перейменовано папку: ${nextName}`, 'System', 'admin']
  );

  return {
    id: renamed.id,
    name: nextName,
    url: driveUrl,
    exists: true,
  };
}

export async function listLessonPhotos(lessonId: number): Promise<LessonPhotoFileInfo[]> {
  const rows = await all<LessonPhotoFileRow>(
    `SELECT
       id,
       lesson_id,
       drive_file_id,
       file_name,
       mime_type,
       file_size,
       uploaded_by,
       uploaded_by_name,
       uploaded_via,
       uploaded_by_telegram_id,
       TO_CHAR(created_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM.YYYY HH24:MI') as created_at
     FROM lesson_photo_files
     WHERE lesson_id = $1
     ORDER BY created_at DESC, id DESC`,
    [lessonId]
  );

  return rows.map(mapPhoto);
}

export async function addLessonPhotoRecord(input: {
  lessonId: number;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: number | null;
  uploadedByName: string | null;
  uploadedVia: UploadVia;
  uploadedByTelegramId?: string | null;
}): Promise<LessonPhotoFileInfo> {
  const folder = await ensureLessonPhotoFolder(input.lessonId);
  if (!folder) {
    throw new Error('Lesson photo uploads are available only for group lessons');
  }

  const driveFile = await uploadFileToDrive(
    input.buffer,
    sanitizeDriveFolderName(input.fileName, 'photo.jpg'),
    input.mimeType,
    folder.id
  );

  await makeFilePublic(driveFile.id);

  const row = await get<LessonPhotoFileRow>(
    `INSERT INTO lesson_photo_files
      (lesson_id, drive_file_id, file_name, mime_type, file_size, uploaded_by, uploaded_by_name, uploaded_via, uploaded_by_telegram_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING
       id,
       lesson_id,
       drive_file_id,
       file_name,
       mime_type,
       file_size,
       uploaded_by,
       uploaded_by_name,
       uploaded_via,
       uploaded_by_telegram_id,
       TO_CHAR(created_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM.YYYY HH24:MI') as created_at`,
    [
      input.lessonId,
      driveFile.id,
      driveFile.name,
      input.mimeType,
      input.fileSize,
      input.uploadedBy,
      input.uploadedByName,
      input.uploadedVia,
      input.uploadedByTelegramId ?? null,
    ]
  );

  await run(
    `INSERT INTO lesson_change_logs
      (lesson_id, field_name, old_value, new_value, changed_by, changed_by_name, changed_by_telegram_id, changed_via)
     VALUES ($1, 'photos', $2, $3, $4, $5, $6, $7)`,
    [
      input.lessonId,
      null,
      `Завантажено фото: ${driveFile.name}`,
      input.uploadedBy,
      input.uploadedByName,
      input.uploadedByTelegramId ?? null,
      input.uploadedVia,
    ]
  );

  return mapPhoto(row!);
}

export async function deleteLessonPhoto(
  photoId: number,
  lessonId?: number,
  actor?: { id: number | null; name: string | null; via?: UploadVia; telegramId?: string | null }
): Promise<boolean> {
  const photo = await get<{ id: number; lesson_id: number; drive_file_id: string; file_name: string }>(
    `SELECT id, lesson_id, drive_file_id, file_name
     FROM lesson_photo_files
     WHERE id = $1
       ${lessonId ? 'AND lesson_id = $2' : ''}`,
    lessonId ? [photoId, lessonId] : [photoId]
  );

  if (!photo) {
    return false;
  }

  await deleteFileFromDrive(photo.drive_file_id);
  await run(`DELETE FROM lesson_photo_files WHERE id = $1`, [photoId]);
  await run(
    `INSERT INTO lesson_change_logs
      (lesson_id, field_name, old_value, new_value, changed_by, changed_by_name, changed_by_telegram_id, changed_via)
     VALUES ($1, 'photos', $2, $3, $4, $5, $6, $7)`,
    [
      photo.lesson_id,
      `Фото: ${photo.file_name}`,
      'Видалено фото',
      actor?.id ?? null,
      actor?.name ?? 'System',
      actor?.telegramId ?? null,
      actor?.via ?? 'admin',
    ]
  );

  return true;
}

export async function getLessonPhotoPayload(lessonId: number): Promise<{
  photoFolder: LessonPhotoFolderInfo | null;
  photos: LessonPhotoFileInfo[];
}> {
  const photoFolder = await ensureLessonPhotoFolder(lessonId);
  const photos = await listLessonPhotos(lessonId);

  return {
    photoFolder,
    photos,
  };
}
