import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, badRequest } from '@/lib/api-utils';
import { getTeacherInviteTokenById, approveTeacherInvite } from '@/lib/teacher-invites';
import { get, run } from '@/db';
import { hashPassword } from '@/lib/auth';
import { generatePublicId } from '@/lib/public-id';
import { clearServerCache } from '@/lib/server-cache';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const { id } = await params;
    const tokenId = parseInt(id, 10);
    if (isNaN(tokenId)) return badRequest('Невірний ID токена');

    const token = await getTeacherInviteTokenById(tokenId);
    if (!token) return NextResponse.json({ error: 'Запрошення не знайдено' }, { status: 404 });
    if (token.status !== 'submitted') {
      return NextResponse.json(
        { error: 'Запрошення ще не заповнене або вже оброблене' },
        { status: 400 }
      );
    }

    // Check email conflict
    const emailConflict = await get<{ role: string }>(
      'SELECT role FROM users WHERE email = $1',
      [token.teacher_email]
    );
    if (emailConflict) {
      return badRequest(
        emailConflict.role === 'admin'
          ? 'Цей email вже використовується адміністратором'
          : 'Викладач з таким email вже існує'
      );
    }

    // Generate password and public id
    const password = Math.random().toString(36).slice(-8);
    const hashedPassword = await hashPassword(password);

    let publicId = generatePublicId('teacher');
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      const existing = await get<{ id: number }>('SELECT id FROM users WHERE public_id = $1', [publicId]);
      if (!existing) break;
      publicId = generatePublicId('teacher');
      retries++;
    }

    // Insert teacher
    const result = await run(
      `INSERT INTO users (public_id, name, email, password_hash, role, phone, telegram_id, notes, is_active)
       VALUES ($1, $2, $3, $4, 'teacher', $5, $6, $7, TRUE)
       RETURNING id`,
      [
        publicId,
        token.teacher_name,
        token.teacher_email,
        hashedPassword,
        token.teacher_phone,
        token.telegram_id,
        token.notes,
      ]
    );

    const teacherId = result[0]?.id;

    // Approve token
    await approveTeacherInvite(tokenId, user.id);

    clearServerCache('teachers:');

    await safeAddAuditEvent({
      entityType: 'teacher',
      entityId: teacherId,
      entityPublicId: publicId,
      entityTitle: token.teacher_name!,
      eventType: 'teacher_created',
      eventBadge: toAuditBadge('teacher_created'),
      description: `Створено викладача ${token.teacher_name} через QR-запрошення`,
      userId: user.id,
      userName: user.name,
      metadata: {
        email: token.teacher_email,
        telegramId: token.telegram_id,
        inviteTokenId: tokenId,
      },
    });

    return NextResponse.json({
      id: teacherId,
      public_id: publicId,
      name: token.teacher_name,
      email: token.teacher_email,
      auto_password: password,
    });
  } catch (error: any) {
    console.error('Error approving teacher invite:', error);
    if (
      error.code === '23505' ||
      error.code === 'SQLITE_CONSTRAINT' ||
      error.message?.includes('unique constraint') ||
      error.message?.includes('UNIQUE constraint')
    ) {
      return badRequest('Викладач з таким email вже існує');
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
