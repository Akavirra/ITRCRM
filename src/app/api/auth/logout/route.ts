import { NextRequest, NextResponse } from 'next/server';
import { logout, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  internalError: 'Внутрішня помилка сервера',
};

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;
    
    if (sessionId) {
      logout(sessionId);
    }
    
    const response = NextResponse.json({ success: true });
    response.cookies.delete('session_id');
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.internalError },
      { status: 500 }
    );
  }
}
