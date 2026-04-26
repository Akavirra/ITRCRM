/**
 * POST /api/teacher/auth/logout
 *
 * Видаляє teacher_session з БД та очищує cookie. Ідемпотентний — повертає 200
 * навіть якщо cookie нема.
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteTeacherSession, TEACHER_COOKIE_NAME } from '@/lib/teacher-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(TEACHER_COOKIE_NAME)?.value;
    if (sessionId) {
      try {
        await deleteTeacherSession(sessionId);
      } catch (error) {
        console.error('[teacher-auth/logout] deleteTeacherSession failed:', error);
      }
    }
    const response = NextResponse.json({ success: true });
    const cookieDomain = process.env.TEACHER_COOKIE_DOMAIN;
    response.cookies.set(TEACHER_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
    return response;
  } catch (error) {
    console.error('[teacher-auth/logout] unexpected error:', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
