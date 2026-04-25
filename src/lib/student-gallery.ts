/**
 * Phase C.1: галерея заняття для порталу учня (read-only).
 *
 * Дані живуть у `lesson_photo_files` — це та сама таблиця, куди викладачі
 * пишуть фото через Telegram-бот, а адмін через CRM. Файли на Google Drive
 * публічні (`makeFilePublic`), тому учень отримує прямі URL без проксі.
 *
 * АРХІТЕКТУРНО:
 *   - Цей модуль НЕ імпортує `@/lib/lesson-photos` (бо той пише через `@/db`).
 *   - Використовує тільки `@/db/neon-student` (роль crm_student) — SELECT
 *     обмежений переліченими в setup-student-role-grants.js колонками.
 *   - Перевірка доступу учня до заняття — через існуючий `getLessonForStudent`.
 */

import 'server-only';
import { studentAll } from '@/db/neon-student';
import {
  getDriveViewUrl,
  getDriveDownloadUrl,
  getDriveThumbnailUrl,
} from '@/lib/google-drive';
import { getLessonForStudent } from '@/lib/student-works';

export interface StudentGalleryItem {
  id: number;
  driveFileId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedByName: string | null;
  uploadedVia: 'admin' | 'telegram';
  createdAt: string;
  /** Прямі URL на Drive — файли публічні, проксі не потрібен. */
  url: string;
  downloadUrl: string;
  thumbnailUrl: string;
  isImage: boolean;
  isVideo: boolean;
}

interface RawRow {
  id: number;
  drive_file_id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by_name: string | null;
  uploaded_via: 'admin' | 'telegram';
  created_at: string;
}

function mapRow(row: RawRow): StudentGalleryItem {
  const mime = row.mime_type ?? null;
  return {
    id: Number(row.id),
    driveFileId: row.drive_file_id,
    fileName: row.file_name,
    mimeType: mime,
    sizeBytes: row.file_size !== null && row.file_size !== undefined ? Number(row.file_size) : null,
    uploadedByName: row.uploaded_by_name ?? null,
    uploadedVia: row.uploaded_via,
    createdAt: String(row.created_at),
    url: getDriveViewUrl(row.drive_file_id),
    downloadUrl: getDriveDownloadUrl(row.drive_file_id),
    thumbnailUrl: getDriveThumbnailUrl(row.drive_file_id),
    isImage: typeof mime === 'string' && mime.toLowerCase().startsWith('image/'),
    isVideo: typeof mime === 'string' && mime.toLowerCase().startsWith('video/'),
  };
}

/**
 * Перевіряє доступ учня до заняття + повертає список галереї.
 * Повертає null, якщо немає доступу (учень не у групі та не в attendance).
 */
export async function listStudentGallery(
  studentId: number,
  lessonId: number,
): Promise<StudentGalleryItem[] | null> {
  const lesson = await getLessonForStudent(studentId, lessonId);
  if (!lesson) return null;

  const rows = await studentAll<RawRow>(
    `SELECT
       id,
       drive_file_id,
       file_name,
       mime_type,
       file_size,
       uploaded_by_name,
       uploaded_via,
       created_at
     FROM lesson_photo_files
     WHERE lesson_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 200`,
    [lessonId],
  );

  return rows.map(mapRow);
}

/**
 * Повертає мапу { lesson_id: count } для переданого набору занять,
 * фільтруючи тільки ті, до яких учень має доступ.
 *
 * Використовується на сторінці групи: щоб показати "📷 Галерея (N)" лише
 * під уроками, де реально є фото — без N+1 fetch'ів з клієнта.
 */
export async function getStudentGalleryCounts(
  studentId: number,
  lessonIds: number[],
): Promise<Record<number, number>> {
  if (lessonIds.length === 0) return {};

  // Захист: тільки додатні цілі. Кладемо у $2 як int[].
  const safeIds = lessonIds.filter((id) => Number.isInteger(id) && id > 0);
  if (safeIds.length === 0) return {};

  // Разом перевіряємо доступ через student_groups + attendance — той самий
  // підхід, що в getLessonForStudent (без N+1).
  const rows = await studentAll<{ lesson_id: number; cnt: number }>(
    `SELECT lpf.lesson_id, COUNT(*)::int AS cnt
     FROM lesson_photo_files lpf
     JOIN lessons l ON l.id = lpf.lesson_id
     WHERE lpf.lesson_id = ANY($2::int[])
       AND (
         EXISTS (
           SELECT 1 FROM student_groups sg
           WHERE sg.student_id = $1 AND sg.group_id = l.group_id AND sg.is_active = TRUE
         )
         OR EXISTS (
           SELECT 1 FROM attendance a
           WHERE a.student_id = $1 AND a.lesson_id = lpf.lesson_id
         )
       )
     GROUP BY lpf.lesson_id`,
    [studentId, safeIds],
  );

  const out: Record<number, number> = {};
  for (const r of rows) {
    out[Number(r.lesson_id)] = Number(r.cnt);
  }
  return out;
}
