/**
 * GET /api/student/auth/me
 *
 * Повертає поточного учня з cookie student_session. 401 якщо нема/прострочено.
 * Автоматично рефрешить сесію, якщо до expiry залишилось менше SESSION_REFRESH_THRESHOLD.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getStudentFromRequest,
  refreshStudentSession,
  SESSION_REFRESH_THRESHOLD_MS,
  STUDENT_COOKIE_NAME,
} from '@/lib/student-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export async function GET(request: NextRequest) {
  try {
    const student = await getStudentFromRequest(request);
    if (!student) {
      return NextResponse.json({ error: 'Необхідна авторизація' }, { status: 401 });
    }

    const expiresAtMs = new Date(student.sessionExpiresAt).getTime();
    const shouldRefresh = expiresAtMs - Date.now() <= SESSION_REFRESH_THRESHOLD_MS;
    let sessionExpiresAt = student.sessionExpiresAt;
    if (shouldRefresh) {
      try {
        sessionExpiresAt = await refreshStudentSession(student.sessionId, student.isPersistent);
      } catch (error) {
        console.error('[student-auth/me] refresh failed:', error);
      }
    }

    const response = NextResponse.json({
      student: {
        id: student.id,
        full_name: student.full_name,
        code: student.code,
      },
      session_expires_at: sessionExpiresAt,
    });

    if (shouldRefresh) {
      const cookieDomain = process.env.STUDENT_COOKIE_DOMAIN;
      response.cookies.set(STUDENT_COOKIE_NAME, student.sessionId, {
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
    console.error('[student-auth/me] unexpected error:', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
