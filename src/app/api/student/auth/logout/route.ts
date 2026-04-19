/**
 * POST /api/student/auth/logout
 *
 * Видаляє student_session з БД та очищує cookie. Ідемпотентний — повертає 200
 * навіть якщо cookie нема.
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteStudentSession, STUDENT_COOKIE_NAME } from '@/lib/student-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(STUDENT_COOKIE_NAME)?.value;
    if (sessionId) {
      try {
        await deleteStudentSession(sessionId);
      } catch (error) {
        // Не зриваємо logout якщо БД тимчасово недоступна — важливо очистити cookie
        console.error('[student-auth/logout] deleteStudentSession failed:', error);
      }
    }
    const response = NextResponse.json({ success: true });
    // Очищуємо cookie. Domain має збігатися з тим, на якому його встановили.
    const cookieDomain = process.env.STUDENT_COOKIE_DOMAIN;
    response.cookies.set(STUDENT_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
    return response;
  } catch (error) {
    console.error('[student-auth/logout] unexpected error:', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
