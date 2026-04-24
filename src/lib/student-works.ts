/**
 * Domain module для робіт учнів (student_works).
 *
 * Архітектура:
 *   - Записи в БД зберігаються з storage_kind='gdrive', storage_url=<driveFileId>.
 *   - Файли приватні: на Google Drive НЕ викликається makeFilePublic.
 *     Учні ніколи не бачать URL-ів Drive — доступ проксюється через CRM
 *     (/api/student/works/[id]/content) після перевірки ownership.
 *
 * Цей модуль використовує @/db/neon-student (роль crm_student) для операцій,
 * які ініціює учень зі свого піддомену. Finalize-callback з upload-service
 * приходить на /api/internal/... і використовує admin @/db окремо.
 */

import 'server-only';
import { studentAll, studentGet, studentRun } from '@/db/neon-student';

export interface StudentWorkRow {
  id: number;
  student_id: number;
  course_id: number | null;
  lesson_id: number | null;
  title: string;
  description: string | null;
  storage_url: string;       // для gdrive — це driveFileId
  storage_kind: 'nextcloud' | 'cloudinary' | 'external' | 'gdrive';
  mime_type: string | null;
  size_bytes: number | null;
  status: 'draft' | 'submitted';
  deleted_at: string | null;
  deleted_by_student: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentWorkView {
  id: number;
  title: string;
  description: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  courseId: number | null;
  courseTitle: string | null;
  lessonId: number | null;
  lessonDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Повертає всі активні (не видалені) роботи учня, найновіші зверху.
 * Використовує крос-джойн з course-таблицею — нам дозволено SELECT (title, id).
 */
export async function listStudentWorks(studentId: number): Promise<StudentWorkView[]> {
  const rows = await studentAll<any>(
    `SELECT
       w.id,
       w.title,
       w.description,
       w.mime_type,
       w.size_bytes,
       w.course_id,
       c.title AS course_title,
       w.lesson_id,
       l.lesson_date,
       w.created_at,
       w.updated_at
     FROM student_works w
     LEFT JOIN courses c ON c.id = w.course_id
     LEFT JOIN lessons l ON l.id = w.lesson_id
     WHERE w.student_id = $1
       AND w.deleted_at IS NULL
     ORDER BY w.created_at DESC, w.id DESC
     LIMIT 500`,
    [studentId]
  );

  return rows.map((r: any) => ({
    id: Number(r.id),
    title: String(r.title),
    description: r.description ?? null,
    mimeType: r.mime_type ?? null,
    sizeBytes: r.size_bytes !== null && r.size_bytes !== undefined ? Number(r.size_bytes) : null,
    courseId: r.course_id ?? null,
    courseTitle: r.course_title ?? null,
    lessonId: r.lesson_id ?? null,
    lessonDate: r.lesson_date ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

/**
 * Повертає роботу учня за id з перевіркою ownership (WHERE student_id = $2).
 * Якщо не знайдено або належить іншому учню — повертає null.
 */
export async function getStudentWorkForStudent(
  workId: number,
  studentId: number
): Promise<StudentWorkRow | null> {
  if (!Number.isInteger(workId) || workId <= 0) return null;
  const row = await studentGet<StudentWorkRow>(
    `SELECT id, student_id, course_id, lesson_id, title, description,
            storage_url, storage_kind, mime_type, size_bytes, status,
            deleted_at, deleted_by_student, created_at, updated_at
     FROM student_works
     WHERE id = $1 AND student_id = $2 AND deleted_at IS NULL`,
    [workId, studentId]
  );
  return row ?? null;
}

/**
 * Soft-delete: позначає роботу як видалену самим учнем.
 * Drive-файл при цьому НЕ видаляється — адмін може відновити доступ при потребі.
 * Повертає true якщо було видалено (знайдено + належить учню), інакше false.
 */
export async function softDeleteStudentWork(
  workId: number,
  studentId: number
): Promise<boolean> {
  const rows = await studentRun(
    `UPDATE student_works
       SET deleted_at = NOW(),
           deleted_by_student = TRUE,
           updated_at = NOW()
     WHERE id = $1 AND student_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [workId, studentId]
  );
  return rows.length > 0;
}

/**
 * Валідація course_id / lesson_id, які учень надсилає при старті upload-а.
 * Учень може прикріпити роботу лише до курсу/заняття, де він сам бере участь.
 * (GRANT-и дозволяють SELECT на student_groups та lessons, тож перевірка працює
 * з боку student-ролі.)
 *
 * Повертає нормалізовані значення (null якщо учень не має доступу — тихо, без throw).
 */
export async function resolveWorkContext(
  studentId: number,
  courseIdRaw: unknown,
  lessonIdRaw: unknown
): Promise<{ courseId: number | null; lessonId: number | null }> {
  const courseId = Number.isInteger(courseIdRaw) && (courseIdRaw as number) > 0 ? (courseIdRaw as number) : null;
  const lessonId = Number.isInteger(lessonIdRaw) && (lessonIdRaw as number) > 0 ? (lessonIdRaw as number) : null;

  let resolvedCourseId: number | null = null;
  let resolvedLessonId: number | null = null;

  if (lessonId) {
    // Учень має бути в групі уроку
    const row = await studentGet<{ course_id: number | null }>(
      `SELECT l.course_id
       FROM lessons l
       JOIN student_groups sg ON sg.group_id = l.group_id
       WHERE l.id = $1 AND sg.student_id = $2 AND sg.is_active = TRUE
       LIMIT 1`,
      [lessonId, studentId]
    );
    if (row) {
      resolvedLessonId = lessonId;
      resolvedCourseId = row.course_id ?? courseId ?? null;
    }
  } else if (courseId) {
    // Учень має бути в хоча б одній групі цього курсу
    const row = await studentGet<{ id: number }>(
      `SELECT g.id
       FROM groups g
       JOIN student_groups sg ON sg.group_id = g.id
       WHERE g.course_id = $1 AND sg.student_id = $2 AND sg.is_active = TRUE
       LIMIT 1`,
      [courseId, studentId]
    );
    if (row) {
      resolvedCourseId = courseId;
    }
  }

  return { courseId: resolvedCourseId, lessonId: resolvedLessonId };
}
