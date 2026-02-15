import { NextRequest, NextResponse } from 'next/server';
import { getSession, getUserById } from '@/lib/auth';

// Ukrainian error messages
const ERROR_MESSAGES = {
  notAuthenticated: 'Необхідна авторизація',
  sessionExpired: 'Сесія закінчилася',
  userNotFound: 'Користувача не знайдено',
  internalError: 'Внутрішня помилка сервера',
};

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.notAuthenticated },
        { status: 401 }
      );
    }
    
    const session = getSession(sessionId);
    
    if (!session) {
      const response = NextResponse.json(
        { error: ERROR_MESSAGES.sessionExpired },
        { status: 401 }
      );
      response.cookies.delete('session_id');
      return response;
    }
    
    const user = getUserById(session.user_id);
    
    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.userNotFound },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.internalError },
      { status: 500 }
    );
  }
}
