/**
 * POST /api/teacher/auth/login
 *
 * Body: { email: string, password: string }
 * Success 200: { teacher: { id, full_name, email } }
 *   + cookie teacher_session (HttpOnly, Secure, SameSite=Lax)
 *
 * Errors:
 *   400 — invalid input (email не валідний / пусті поля)
 *   401 — invalid credentials / wrong_role / inactive
 *   429 — rate limit / lockout
 *
 * АРХІТЕКТУРНО:
 *   Login робиться через комбінацію admin-клієнта (читає password_hash з users)
 *   і teacher-клієнта (створює запис в teacher_sessions). Це свідома компромісна
 *   точка: GRANT crm_teacher → users.password_hash дав би доступ і до адмінських
 *   парольних хешів. Тому password_hash читаємо через admin-роль (одноразова дія
 *   з малим scope), а далі вся робота — через crm_teacher.
 */

import { NextRequest, NextResponse } from 'next/server';
import { get as adminGet } from '@/db';
import {
  loginTeacherWithAdminClient,
  TeacherAuthError,
  TEACHER_COOKIE_NAME,
  getClientIp,
} from '@/lib/teacher-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // bcrypt → Node.js

const SESSION_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Невірний запит' }, { status: 400 });
    }

    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) {
      return NextResponse.json({ error: 'Вкажіть email і пароль' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || '';

    const result = await loginTeacherWithAdminClient(
      adminGet,
      email,
      password,
      ip,
      userAgent,
    );

    const response = NextResponse.json({
      teacher: {
        id: result.userId,
        full_name: result.fullName,
        email: result.email,
      },
    });

    // Cookie scope: TEACHER_COOKIE_DOMAIN env для multi-subdomain prod (".itrobotics.com.ua"),
    // інакше — на точний host (для dev/preview).
    const cookieDomain = process.env.TEACHER_COOKIE_DOMAIN;
    response.cookies.set(TEACHER_COOKIE_NAME, result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE_SEC,
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
    return response;
  } catch (error) {
    if (error instanceof TeacherAuthError) {
      const status =
        error.code === 'rate_limit' || error.code === 'locked'
          ? 429
          : error.code === 'invalid_input'
          ? 400
          : 401;
      return NextResponse.json({ error: error.message, reason: error.code }, { status });
    }
    console.error('[teacher-auth/login] unexpected error:', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
