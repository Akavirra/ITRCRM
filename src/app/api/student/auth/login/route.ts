/**
 * POST /api/student/auth/login
 *
 * Body: { code: string, pin: string }
 * Success 200: { student: { id, full_name, code }, session_expires_at }
 *   + cookie student_session (HttpOnly, Secure, SameSite=Lax)
 *
 * Errors:
 *   400 — invalid input (код не у форматі R\d+ або PIN не 6 цифр)
 *   401 — invalid credentials (не кажемо, чи код існує)
 *   429 — rate limit / lockout
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loginStudent,
  StudentAuthError,
  STUDENT_COOKIE_NAME,
  getClientIp,
} from '@/lib/student-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // bcrypt потребує Node.js runtime

const SESSION_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 днів — має збігатися з SESSION_TTL в lib

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Невірний запит' }, { status: 400 });
    }

    const code = typeof body.code === 'string' ? body.code : '';
    const pin = typeof body.pin === 'string' ? body.pin : '';
    if (!code || !pin) {
      return NextResponse.json({ error: 'Вкажіть код і PIN' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || '';

    const result = await loginStudent(code, pin, ip, userAgent);

    const response = NextResponse.json({
      student: {
        id: result.studentId,
        full_name: result.fullName,
        code: result.code,
      },
    });

    // Cookie — scoped на піддомен students.itrobotics.com.ua (через STUDENT_COOKIE_DOMAIN env),
    // інакше без атрибута domain — scoped на точний host поточного запиту.
    const cookieDomain = process.env.STUDENT_COOKIE_DOMAIN;
    response.cookies.set(STUDENT_COOKIE_NAME, result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE_SEC,
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
    return response;
  } catch (error) {
    if (error instanceof StudentAuthError) {
      const status =
        error.code === 'rate_limit' || error.code === 'locked'
          ? 429
          : error.code === 'invalid_input'
          ? 400
          : 401;
      return NextResponse.json({ error: error.message, reason: error.code }, { status });
    }
    console.error('[student-auth/login] unexpected error:', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
