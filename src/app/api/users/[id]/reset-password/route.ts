import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, notFound, unauthorized } from '@/lib/api-utils';
import { get, run } from '@/db';
import { hashPassword } from '@/lib/auth';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES = {
  invalidUserId: 'Невірний ID користувача',
  ownerOnly: 'Лише owner-адміністратор може скидати паролі',
  ownerTargetForbidden: 'Не можна скидати пароль owner-акаунту',
  passwordTooShort: 'Тимчасовий пароль має містити щонайменше 8 символів',
  resetFailed: 'Не вдалося скинути пароль',
};

function generateTemporaryPassword(): string {
  return randomBytes(6).toString('base64url');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) {
    return unauthorized();
  }

  const fullCurrentUser = await get<{ id: number; is_owner: boolean }>(
    `SELECT id, is_owner FROM users WHERE id = $1`,
    [currentUser.id]
  );

  if (!fullCurrentUser?.is_owner) {
    return NextResponse.json({ error: ERROR_MESSAGES.ownerOnly }, { status: 403 });
  }

  const targetId = Number.parseInt(params.id, 10);
  if (Number.isNaN(targetId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidUserId }, { status: 400 });
  }

  const targetUser = await get<{ id: number; is_owner: boolean; name: string; email: string }>(
    `SELECT id, is_owner, name, email FROM users WHERE id = $1`,
    [targetId]
  );

  if (!targetUser) {
    return notFound('Користувача не знайдено');
  }

  if (targetUser.is_owner) {
    return NextResponse.json({ error: ERROR_MESSAGES.ownerTargetForbidden }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const customPassword =
    typeof body?.temporaryPassword === 'string' ? body.temporaryPassword.trim() : '';
  const temporaryPassword = customPassword || generateTemporaryPassword();

  if (temporaryPassword.length < 8) {
    return NextResponse.json({ error: ERROR_MESSAGES.passwordTooShort }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(temporaryPassword);

    await run(
      `UPDATE users
       SET password_hash = $1, must_change_password = TRUE, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, targetId]
    );

    await run(`DELETE FROM sessions WHERE user_id = $1`, [targetId]);
    await safeAddAuditEvent({
      entityType: 'user',
      entityId: targetUser.id,
      entityTitle: targetUser.name,
      eventType: 'user_password_reset',
      eventBadge: toAuditBadge('user_password_reset'),
      description: `Скинуто пароль користувача ${targetUser.name}`,
      userId: currentUser.id,
      userName: currentUser.name,
      metadata: {
        email: targetUser.email,
      },
    });

    return NextResponse.json({
      message: 'Тимчасовий пароль створено',
      temporaryPassword,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    });
  } catch (error) {
    console.error('Owner reset password error:', error);
    return NextResponse.json({ error: ERROR_MESSAGES.resetFailed }, { status: 500 });
  }
}
