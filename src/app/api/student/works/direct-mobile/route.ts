/**
 * POST /api/student/works/direct-mobile
 *
 * Phase C.2: мобільний eq-аналог /api/student/works/direct, але автентифікація
 * через QR-токен (а не cookie). Викликається зі сторінки /m/[token] на телефоні
 * учня — там немає student_session cookie.
 *
 * Контракт:
 *   Headers: Authorization: Bearer <qrToken>   ← основний шлях
 *            АБО
 *   Body:    { qrToken: string, title?, description? }
 *
 *   QR-токен пінить { studentId, lessonId } і має TTL 10 хв (див. student-qr-token).
 *   Lesson із токена є ОБОВ'ЯЗКОВИМ — учень не може перенаправити роботу на
 *   інше заняття через цей маршрут.
 *
 * Відповідь — така ж як у /direct: { uploadUrl, token, context, uploadWindow }.
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { studentGet } from '@/db/neon-student';
import { studentIdToCode } from '@/lib/student-auth';
import { resolveUploadContext } from '@/lib/student-works';
import { verifyStudentQrToken } from '@/lib/student-qr-token';
import { createStudentWorkUploadToken, getUploadServiceUrl } from '@/lib/upload-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractQrToken(request: NextRequest, body: any): string | null {
  // Authorization: Bearer
  const auth = request.headers.get('authorization');
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match) return match[1].trim();
  }
  // Або в body
  if (typeof body?.qrToken === 'string' && body.qrToken.trim()) {
    return body.qrToken.trim();
  }
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const qrToken = extractQrToken(request, body);
  if (!qrToken) {
    return NextResponse.json({ error: 'Відсутній QR-токен' }, { status: 401 });
  }

  const payload = verifyStudentQrToken(qrToken);
  if (!payload) {
    return NextResponse.json(
      { error: 'QR-сесія прострочена або недійсна. Поверніться до десктопу і згенеруйте новий код.' },
      { status: 401 },
    );
  }

  // Підтягуємо студента з БД (чи він не деактивований за ці 10 хв)
  const studentRow = await studentGet<{ id: number; full_name: string; is_active: boolean }>(
    `SELECT id, full_name, is_active FROM students WHERE id = $1`,
    [payload.studentId],
  );
  if (!studentRow || !studentRow.is_active) {
    return NextResponse.json({ error: 'Обліковий запис неактивний' }, { status: 403 });
  }

  // Re-validate доступ + upload-вікно (між видачею і використанням токена
  // вікно могло закритись, або викладач зняв учня з групи)
  const ctx = await resolveUploadContext(studentRow.id, payload.lessonId);
  if (!ctx.ok) {
    switch (ctx.reason) {
      case 'no-access':
        return NextResponse.json(
          { error: 'Немає доступу до цього заняття' },
          { status: 403 },
        );
      case 'window-not-open':
        return NextResponse.json(
          {
            error: 'Заняття ще не почалося.',
            opensAt: ctx.uploadWindow?.opensAt,
            closesAt: ctx.uploadWindow?.closesAt,
          },
          { status: 403 },
        );
      case 'window-closed':
        return NextResponse.json(
          {
            error: 'Вікно завантаження закрито (минула година після заняття).',
            opensAt: ctx.uploadWindow?.opensAt,
            closesAt: ctx.uploadWindow?.closesAt,
          },
          { status: 403 },
        );
      case 'lesson-required':
      default:
        return NextResponse.json({ error: 'Невалідний контекст' }, { status: 400 });
    }
  }

  // Опційні title/description з body — нормалізуємо як у /direct
  const rawTitle = typeof body?.title === 'string' ? body.title.trim() : '';
  const title = rawTitle ? rawTitle.slice(0, 200) : null;
  const rawDescription = typeof body?.description === 'string' ? body.description.trim() : '';
  const description = rawDescription ? rawDescription.slice(0, 2000) : null;

  let uploadUrl: string;
  try {
    uploadUrl = `${getUploadServiceUrl()}/upload/student-work`;
  } catch {
    return NextResponse.json(
      { error: 'Сервіс завантаження не налаштовано.' },
      { status: 503 },
    );
  }

  // Беремо код учня (доступний студент-ролі через student_codes)
  const codeRow = await studentGet<{ code: string }>(
    `SELECT code FROM student_codes WHERE student_id = $1 AND is_active = TRUE`,
    [studentRow.id],
  );
  const studentCode = codeRow?.code ?? studentIdToCode(studentRow.id);

  let uploadServiceToken: string;
  try {
    uploadServiceToken = createStudentWorkUploadToken({
      studentId: studentRow.id,
      studentCode,
      studentFullName: studentRow.full_name,
      workTitle: title,
      workDescription: description,
      courseId: ctx.courseId,
      lessonId: ctx.lessonId,
    });
  } catch {
    return NextResponse.json(
      { error: 'Не вдалося створити токен завантаження.' },
      { status: 503 },
    );
  }

  return NextResponse.json({
    uploadUrl,
    token: uploadServiceToken,
    context: { courseId: ctx.courseId, lessonId: ctx.lessonId },
    uploadWindow: ctx.uploadWindow,
  });
}
