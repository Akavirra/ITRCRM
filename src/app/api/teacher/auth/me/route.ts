/**
 * GET /api/teacher/auth/me
 *
 * Повертає поточного викладача з cookie teacher_session. 401 якщо нема/прострочено.
 * Авто-рефреш сесії, коли до expiry залишилось <SESSION_REFRESH_THRESHOLD.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTeacherFromRequest,
  refreshTeacherSession,
  SESSION_REFRESH_THRESHOLD_MS,
  TEACHER_COOKIE_NAME,
} from '@/lib/teacher-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export async function GET(request: NextRequest) {
  try {
    const teacher = await getTeacherFromRequest(request);
    if (!teacher) {
      return NextResponse.json({ error: 'Необхідна авторизація' }, { status: 401 });
    }

    const expiresAtMs = new Date(teacher.sessionExpiresAt).getTime();
    const shouldRefresh = expiresAtMs - Date.now() <= SESSION_REFRESH_THRESHOLD_MS;
    let sessionExpiresAt = teacher.sessionExpiresAt;
    if (shouldRefresh) {
      try {
        sessionExpiresAt = await refreshTeacherSession(teacher.sessionId);
      } catch (error) {
        console.error('[teacher-auth/me] refresh failed:', error);
      }
    }

    const response = NextResponse.json({
      teacher: {
        id: teacher.id,
        full_name: teacher.full_name,
        email: teacher.email,
        photoUrl: teacher.photoUrl,
      },
      session_expires_at: sessionExpiresAt,
    });

    if (shouldRefresh) {
      const cookieDomain = process.env.TEACHER_COOKIE_DOMAIN;
      response.cookies.set(TEACHER_COOKIE_NAME, teacher.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_COOKIE_MAX_AGE_SEC,
        path: '/',
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      });
    }
    return response;
  } catch (error) {
    console.error('[teacher-auth/me] unexpected error:', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
