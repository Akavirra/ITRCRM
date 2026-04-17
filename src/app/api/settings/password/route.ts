import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { run, get } from '@/db';
import { verifyPassword, hashPassword } from '@/lib/auth';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES = {
  notAuthenticated: 'Необхідна авторизація',
  invalidCurrentPassword: 'Поточний пароль невірний',
  passwordsDoNotMatch: 'Нові паролі не співпадають',
  passwordTooShort: 'Пароль повинен містити щонайменше 6 символів',
  updateFailed: 'Не вдалося змінити пароль',
};

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: "Усі поля обов'язкові" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: ERROR_MESSAGES.passwordTooShort }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: ERROR_MESSAGES.passwordsDoNotMatch }, { status: 400 });
    }

    const userRecord = await get<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [user.id]
    );

    if (!userRecord) {
      return NextResponse.json({ error: ERROR_MESSAGES.updateFailed }, { status: 500 });
    }

    const isValid = await verifyPassword(currentPassword, userRecord.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalidCurrentPassword }, { status: 400 });
    }

    const newPasswordHash = await hashPassword(newPassword);
    await run(
      `UPDATE users
       SET password_hash = $1, must_change_password = FALSE, updated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, user.id]
    );

    await safeAddAuditEvent({
      entityType: 'user',
      entityId: user.id,
      entityTitle: user.name,
      eventType: 'user_password_changed',
      eventBadge: toAuditBadge('user_password_changed'),
      description: 'Користувач змінив власний пароль',
      userId: user.id,
      userName: user.name,
    });

    return NextResponse.json({ message: 'Пароль успішно змінено' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: ERROR_MESSAGES.updateFailed }, { status: 500 });
  }
}
