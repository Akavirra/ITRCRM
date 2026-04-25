/**
 * POST /api/student/works/direct — start upload flow.
 *
 * Повертає JWT-токен + URL upload-service, куди браузер шле multipart POST
 * з файлом і токеном. Upload-service завантажує файл у Google Drive
 * і викликає /api/internal/student-works/finalize для створення запису в БД.
 *
 * Phase B: lessonId є ОБОВ'ЯЗКОВИМ. Додано перевірку upload-вікна:
 *   - вікно відкрите лише у [lesson.start; lesson.end + 1 год] (ТЗ п.4)
 *   - у разі закритого вікна — 403 з деталями часу
 *
 * Body:
 *   {
 *     title?: string,
 *     description?: string,
 *     lessonId: number,   // обов'язково
 *   }
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentFromRequest } from '@/lib/student-auth';
import { resolveUploadContext } from '@/lib/student-works';
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

  const ctx = await resolveUploadContext(student.id, body?.lessonId);

  if (!ctx.ok) {
    switch (ctx.reason) {
      case 'lesson-required':
        return NextResponse.json(
          { error: 'Роботу можна завантажити лише в рамках заняття. Відкрий сторінку активного заняття.' },
          { status: 400 },
        );
      case 'no-access':
        return NextResponse.json(
          { error: 'Немає доступу до цього заняття' },
          { status: 403 },
        );
      case 'window-not-open':
        return NextResponse.json(
          {
            error: 'Заняття ще не почалося. Завантажити роботу можна буде з моменту початку.',
            opensAt: ctx.uploadWindow?.opensAt,
            closesAt: ctx.uploadWindow?.closesAt,
          },
          { status: 403 },
        );
      case 'window-closed':
        return NextResponse.json(
          {
            error: 'Вікно завантаження закрито (минула година після заняття). Роботи тепер доступні лише для перегляду.',
            opensAt: ctx.uploadWindow?.opensAt,
            closesAt: ctx.uploadWindow?.closesAt,
          },
          { status: 403 },
        );
      default:
        return NextResponse.json({ error: 'Невалідний контекст завантаження' }, { status: 400 });
    }
  }

  let uploadUrl: string;
  try {
    uploadUrl = `${getUploadServiceUrl()}/upload/student-work`;
  } catch {
    return NextResponse.json(
      { error: 'Сервіс завантаження не налаштовано. Зверніться до адміністратора.' },
      { status: 503 },
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
      courseId: ctx.courseId,
      lessonId: ctx.lessonId,
    });
  } catch {
    return NextResponse.json(
      { error: 'Не вдалося створити токен завантаження. Зверніться до адміністратора.' },
      { status: 503 },
    );
  }

  return NextResponse.json({
    uploadUrl,
    token,
    context: { courseId: ctx.courseId, lessonId: ctx.lessonId },
    uploadWindow: ctx.uploadWindow,
  });
}
