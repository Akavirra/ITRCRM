/**
 * POST /api/student/upload-qr
 *
 * Phase C.2: учень на десктопі натискає "📱 Завантажити з телефону" → бекенд
 * перевіряє доступ до заняття + відкритість upload-вікна, підписує
 * short-lived QR-токен (TTL 10 хв) і повертає:
 *   { token, mobileUrl, qrDataUrl, expiresAt }
 *
 * Десктоп показує QR (data URL), учень сканує телефоном і відкриває mobileUrl,
 * який рендерить мобільну форму завантаження. Сесія cookie на телефон НЕ йде —
 * аутентифікація йде через JWT-токен в URL.
 *
 * Body:
 *   { lessonId: number }
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getStudentFromRequest } from '@/lib/student-auth';
import { resolveUploadContext } from '@/lib/student-works';
import { createStudentQrToken } from '@/lib/student-qr-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getMobileBaseUrl(request: NextRequest): string {
  // Пріоритет: явна змінна (для multi-domain prod) → origin поточного запиту.
  const explicit = process.env.NEXT_PUBLIC_STUDENT_PORTAL_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  // Будуємо з заголовків — учень на students.itrobotics.com.ua,
  // middleware робить rewrite на /s/*. URL-у користувача /m/<token> бачить як
  // https://students.itrobotics.com.ua/m/<token>.
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ctx = await resolveUploadContext(student.id, body?.lessonId);

  if (!ctx.ok) {
    switch (ctx.reason) {
      case 'lesson-required':
        return NextResponse.json(
          { error: 'Потрібен lessonId' },
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
            error: 'Заняття ще не почалося. Завантаження стане доступним з моменту початку.',
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
      default:
        return NextResponse.json({ error: 'Невалідний контекст' }, { status: 400 });
    }
  }

  // ctx.ok=true гарантує lessonId присутній, але TS не звужує union — перевіряємо явно.
  if (ctx.lessonId === null) {
    return NextResponse.json({ error: 'Невалідний контекст' }, { status: 400 });
  }

  let signed: { token: string; expiresAt: string };
  try {
    signed = createStudentQrToken({ studentId: student.id, lessonId: ctx.lessonId });
  } catch {
    return NextResponse.json(
      { error: 'Не вдалося створити QR-токен. Зверніться до адміністратора.' },
      { status: 503 },
    );
  }

  const baseUrl = getMobileBaseUrl(request);
  const mobileUrl = `${baseUrl}/m/${signed.token}`;

  let qrDataUrl: string;
  try {
    qrDataUrl = await QRCode.toDataURL(mobileUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Не вдалося згенерувати QR-код' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    token: signed.token,
    expiresAt: signed.expiresAt,
    mobileUrl,
    qrDataUrl,
    uploadWindow: ctx.uploadWindow,
  });
}
