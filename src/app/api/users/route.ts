import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { all, run } from '@/db';
import { hashPassword } from '@/lib/auth';

// Ukrainian error messages
const ERROR_MESSAGES = {
  allFieldsRequired: "Усі поля обов'язкові",
  invalidRole: 'Невірна роль',
  emailExists: 'Користувач з таким email вже існує',
  createFailed: 'Не вдалося створити користувача',
};

// GET /api/users - List users (admin only)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';
  
  const users = all(
    includeInactive
      ? `SELECT id, name, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC`
      : `SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE is_active = 1 ORDER BY created_at DESC`
  );
  
  return NextResponse.json({ users });
}

// POST /api/users - Create user (admin only)
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  try {
    const body = await request.json();
    const { name, email, password, role } = body;
    
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.allFieldsRequired },
        { status: 400 }
      );
    }
    
    if (!['admin'].includes(role)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidRole },
        { status: 400 }
      );
    }
    
    const passwordHash = await hashPassword(password);
    
    const result = run(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
      [name.trim(), email.trim().toLowerCase(), passwordHash, role]
    );
    
    return NextResponse.json({
      id: result.lastInsertRowid,
      message: 'Користувача успішно створено',
    });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return NextResponse.json(
        { error: ERROR_MESSAGES.emailExists },
        { status: 400 }
      );
    }
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.createFailed },
      { status: 500 }
    );
  }
}
