import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { all, run } from '@/db';
import { hashPassword } from '@/lib/auth';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES = {
  allFieldsRequired: "Усі поля обов'язкові",
  invalidRole: 'Невірна роль',
  invalidEmail: 'Невірний формат email',
  emailExists: 'Користувач з таким email вже існує',
  createFailed: 'Не вдалося створити користувача',
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

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

  const users = await all(
    includeInactive
      ? `SELECT id, name, email, role, is_active, is_owner, created_at, updated_at FROM users WHERE role = 'admin' ORDER BY is_owner DESC, created_at ASC`
      : `SELECT id, name, email, role, is_active, is_owner, created_at, updated_at FROM users WHERE role = 'admin' AND is_active = TRUE ORDER BY is_owner DESC, created_at ASC`
  );

  return NextResponse.json({ users });
}

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
    const { name, email, password, role, telegram_id } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: ERROR_MESSAGES.allFieldsRequired }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalidEmail }, { status: 400 });
    }

    if (!['admin'].includes(role)) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalidRole }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    const result = await run(
      `INSERT INTO users (name, email, password_hash, role, telegram_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [trimmedName, trimmedEmail, passwordHash, role, telegram_id?.trim() || null]
    );

    await safeAddAuditEvent({
      entityType: 'user',
      entityId: result[0]?.id,
      entityTitle: trimmedName,
      eventType: 'user_created',
      eventBadge: toAuditBadge('user_created'),
      description: `Створено користувача ${trimmedName}`,
      userId: user.id,
      userName: user.name,
      metadata: {
        email: trimmedEmail,
        role,
      },
    });

    return NextResponse.json({
      id: result[0]?.id,
      message: 'Користувача успішно створено',
    });
  } catch (error: any) {
    if (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT' || error.message?.includes('unique constraint') || error.message?.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: ERROR_MESSAGES.emailExists }, { status: 400 });
    }
    console.error('Create user error:', error);
    return NextResponse.json({ error: ERROR_MESSAGES.createFailed }, { status: 500 });
  }
}
