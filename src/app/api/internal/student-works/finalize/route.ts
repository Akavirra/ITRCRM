import { NextRequest, NextResponse } from 'next/server';
import { assertInternalApiSecret } from '@/lib/upload-service';
import { run, get } from '@/db';

export const dynamic = 'force-dynamic';

/**
 * Колбек від upload-service після успішного uploadStreamToDrive для робіт учня.
 * Створює запис у student_works зі storage_kind='gdrive' і storage_url=<driveFileId>.
 *
 * Викликається лише upload-service із заголовком X-Internal-Secret — НЕ публічно.
 * Це причина чому тут використовується адмінський @/db (а не neon-student): учень
 * тут не автентифікований cookie; upload-service довіряємо за секретом.
 */
export async function POST(request: NextRequest) {
  if (!assertInternalApiSecret(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  const studentId = typeof body?.studentId === 'number' ? body.studentId : 0;
  const courseId = typeof body?.courseId === 'number' ? body.courseId : null;
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : null;
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description : null;
  const driveFileId = typeof body?.driveFileId === 'string' ? body.driveFileId : '';
  const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : 'application/octet-stream';
  const fileSize = typeof body?.fileSize === 'number' ? body.fileSize : 0;

  if (!studentId || !driveFileId || !fileName) {
    return NextResponse.json(
      { error: 'Missing required fields: studentId, driveFileId, fileName' },
      { status: 400 }
    );
  }

  // Страхуюча перевірка існування учня (student може бути стертий між start і finalize)
  const student = await get<{ id: number }>('SELECT id FROM students WHERE id = $1', [studentId]);
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  const effectiveTitle = title || fileName;

  const row = await get<{ id: number }>(
    `INSERT INTO student_works
       (student_id, course_id, lesson_id, title, description,
        storage_url, storage_kind, mime_type, size_bytes, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'gdrive', $7, $8, 'submitted')
     RETURNING id`,
    [
      studentId,
      courseId,
      lessonId,
      effectiveTitle,
      description,
      driveFileId,
      mimeType,
      fileSize || null,
    ]
  );

  // Аудит — як для логіну. Робимо через admin роль, щоб не залежати від GRANT-ів
  // на audit-таблицю від імені студента (тут учень не автентифікований).
  await run(
    `INSERT INTO student_audit_log (student_id, action, meta)
     VALUES ($1, 'work_upload', $2::jsonb)`,
    [
      studentId,
      JSON.stringify({
        work_id: row?.id ?? null,
        drive_file_id: driveFileId,
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: fileSize || null,
        course_id: courseId,
        lesson_id: lessonId,
      }),
    ]
  );

  return NextResponse.json({ workId: row?.id ?? null });
}
