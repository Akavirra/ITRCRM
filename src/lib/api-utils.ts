import { NextRequest, NextResponse } from 'next/server';
import { getSession, getUserById, userHasGroupAccess, getAccessibleGroups } from '@/lib/auth';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin';
}

// Ukrainian error messages
const ERROR_MESSAGES = {
  unauthorized: 'Необхідна авторизація',
  forbidden: 'Недостатньо прав доступу',
  notFound: 'Не знайдено',
  badRequest: 'Невірний запит',
  internalError: 'Внутрішня помилка сервера',
};

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const sessionId = request.cookies.get('session_id')?.value;
  
  if (!sessionId) {
    return null;
  }
  
  const session = await getSession(sessionId);
  
  if (!session) {
    return null;
  }
  
  const user = await getUserById(session.user_id);
  
  if (!user || !user.is_active) {
    return null;
  }
  
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: ERROR_MESSAGES.unauthorized },
    { status: 401 }
  );
}

export function forbidden(): NextResponse {
  return NextResponse.json(
    { error: ERROR_MESSAGES.forbidden },
    { status: 403 }
  );
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 400 }
  );
}

export function notFound(message: string = ERROR_MESSAGES.notFound): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 404 }
  );
}

export function isAdmin(user: AuthUser): boolean {
  return user.role === 'admin';
}

export async function checkGroupAccess(user: AuthUser, groupId: number): Promise<boolean> {
  return userHasGroupAccess(user.id, groupId, user.role);
}

export async function getAccessibleGroupIds(user: AuthUser): Promise<number[]> {
  return getAccessibleGroups(user.id, user.role);
}
