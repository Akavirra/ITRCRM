/**
 * POST /api/student/works/direct — start upload flow.
 *
 * Повертає JWT-токен + URL upload-service, куди браузер шле multipart POST
 * з файлом і токеном. Upload-service завантажує файл у Google Drive
 * і викликає /api/internal/student-works/finalize для створення запису в БД.
 *
 * Ми навмисно НЕ створюємо запис у student_works на цьому кроці —
 * тільки після успішного upload-у (щоб не було "порожніх" записів).
 *
 * Body:
 *   {
 *     title?: string,
 *     description?: string,
 *     courseId?: number,      // опційно — учень може прикріпити до курсу
 *     lessonId?: number,      // опційно — або до конкретного уроку
 *   }
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentFromRequest } from '@/lib/student-auth';
import { resolveWorkContext } from '@/lib/student-works';
import { createStudentWorkUploadToken, getUploadServiceUrl } from '@/lib/upload-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  const rawTitle = typeof body?.title === 'string' ? body.title.trim() : '';
  const title = rawTitle ? rawTitle.slice(0, 200) : null;

  const rawDescription = typeof body?.description === 'string' ? body.description.trim() : '';
  const description = rawDescription ? rawDescription.slice(0, 2000) : null;

  const { courseId, lessonId } = await resolveWorkContext(
    student.id,
    body?.courseId,
    body?.lessonId
  );

  let uploadUrl: string;
  try {
    uploadUrl = `${getUploadServiceUrl()}/upload/student-work`;
  } catch {
    return NextResponse.json(
      { error: 'Сервіс завантаження не налаштовано. Зверніться до адміністратора.' },
      { status: 503 }
    );
  }

  let token: string;
  try {
    token = createStudentWorkUploadToken({
      studentId: student.id,
      studentCode: student.code,
      studentFullName: student.full_name,
      workTitle: title,
      workDescription: description,
      courseId,
      lessonId,
    });
  } catch {
    return NextResponse.json(
      { error: 'Не вдалося створити токен завантаження. Зверніться до адміністратора.' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    uploadUrl,
    token,
    context: { courseId, lessonId },
  });
}
