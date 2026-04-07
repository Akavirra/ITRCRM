import { NextRequest, NextResponse } from 'next/server';
import { get, run } from '@/db';
import { createSession, hashPassword, verifyPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES = {
  allFieldsRequired: 'Усі поля обовʼязкові',
  invalidCurrentPassword: 'Тимчасовий пароль невірний',
  passwordsDoNotMatch: 'Нові паролі не співпадають',
  passwordTooShort: 'Пароль повинен містити щонайменше 6 символів',
  resetNotAvailable: 'Для цього акаунта примусова зміна пароля не потрібна',
  resetFailed: 'Не вдалося оновити пароль',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, currentPassword, newPassword, confirmPassword } = body;

    if (!email || !currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: ERROR_MESSAGES.allFieldsRequired }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: ERROR_MESSAGES.passwordTooShort }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: ERROR_MESSAGES.passwordsDoNotMatch }, { status: 400 });
    }

    const user = await get<{ id: number; password_hash: string; must_change_password: boolean; name: string; role: string; photo_url: string | null }>(
      `SELECT id, password_hash, must_change_password, name, role, photo_url
       FROM users
       WHERE email = $1 AND is_active = TRUE`,
      [String(email).trim().toLowerCase()]
    );

    if (!user?.must_change_password) {
      return NextResponse.json({ error: ERROR_MESSAGES.resetNotAvailable }, { status: 400 });
    }

    const isValid = await verifyPassword(currentPassword, user.password_hash);
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

    await run(`DELETE FROM sessions WHERE user_id = $1`, [user.id]);

    const sessionId = await createSession(user.id);
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        photo_url: user.photo_url,
      },
    });

    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Temporary password reset error:', error);
    return NextResponse.json({ error: ERROR_MESSAGES.resetFailed }, { status: 500 });
  }
}
