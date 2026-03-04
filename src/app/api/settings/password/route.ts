import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { run, get } from '@/db';
import { verifyPassword, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  notAuthenticated: 'Необхідна авторизація',
  invalidCurrentPassword: 'Поточний пароль невірний',
  passwordsDoNotMatch: 'Нові паролі не співпадають',
  passwordTooShort: 'Пароль повинен містити щонайменше 6 символів',
  updateFailed: 'Не вдалося змінити пароль',
};

// PUT /api/settings/password - Change user password
export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  try {
    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;
    
    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Усі поля обов\'язкові' },
        { status: 400 }
      );
    }
    
    // Check password length
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.passwordTooShort },
        { status: 400 }
      );
    }
    
    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.passwordsDoNotMatch },
        { status: 400 }
      );
    }
    
    // Get current user password hash
    const userRecord = await get<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [user.id]
    );
    
    if (!userRecord) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.updateFailed },
        { status: 500 }
      );
    }
    
    // Verify current password
    const isValid = await verifyPassword(currentPassword, userRecord.password_hash);
    
    if (!isValid) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidCurrentPassword },
        { status: 400 }
      );
    }
    
    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);
    
    await run(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newPasswordHash, user.id]
    );
    
    return NextResponse.json({
      message: 'Пароль успішно змінено',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.updateFailed },
      { status: 500 }
    );
  }
}
