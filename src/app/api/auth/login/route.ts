import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/lib/auth';
import { initializeDatabase } from '@/db';

// Initialize database on first request
let dbInitialized = false;

// Ukrainian error messages
const ERROR_MESSAGES = {
  emailPasswordRequired: "Email та пароль обов'язкові",
  invalidCredentials: 'Неправильний email або пароль',
  adminOnlyAccess: 'Доступ до системи дозволено тільки для адміністраторів',
  internalError: 'Внутрішня помилка сервера',
};

export async function POST(request: NextRequest) {
  try {
    // Initialize database if not done
    if (!dbInitialized) {
      initializeDatabase();
      dbInitialized = true;
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.emailPasswordRequired },
        { status: 400 }
      );
    }

    const result = await login(email, password);

    if (!result) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidCredentials },
        { status: 401 }
      );
    }

    // Create response with session cookie
    const response = NextResponse.json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });

    // Set session cookie
    response.cookies.set('session_id', result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.internalError },
      { status: 500 }
    );
  }
}
