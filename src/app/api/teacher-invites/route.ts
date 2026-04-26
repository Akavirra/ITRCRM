import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import { createTeacherInviteToken, getAllTeacherInviteTokens } from '@/lib/teacher-invites';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const tokens = await getAllTeacherInviteTokens();
    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Error fetching teacher invite tokens:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const body = await request.json().catch(() => ({}));
    const expiresInMinutes = body.expires_in_minutes || 15;

    const token = await createTeacherInviteToken(user.id, expiresInMinutes);

    await safeAddAuditEvent({
      entityType: 'teacher_invite',
      entityId: token.id,
      entityTitle: `Запрошення викладача #${token.id}`,
      eventType: 'teacher_invite_created',
      eventBadge: toAuditBadge('teacher_invite_created'),
      description: `Створено QR-запрошення для реєстрації викладача на ${expiresInMinutes} хв`,
      userId: user.id,
      userName: user.name,
      metadata: {
        tokenId: token.id,
        expiresAt: token.expires_at,
        expiresInMinutes,
      },
    });

    return NextResponse.json(token, { status: 201 });
  } catch (error) {
    console.error('Error creating teacher invite token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
