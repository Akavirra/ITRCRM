import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import { validateTeacherInviteToken, getTeacherInviteTokenById, rejectTeacherInvite, deleteTeacherInviteToken } from '@/lib/teacher-invites';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await validateTeacherInviteToken(token);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, reason: result.reason },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true, tokenData: result.tokenData });
  } catch (error) {
    console.error('Error validating teacher invite token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const { token: tokenParam } = await params;
    const tokenId = parseInt(tokenParam, 10);
    if (isNaN(tokenId)) {
      return NextResponse.json({ error: 'Невірний ID' }, { status: 400 });
    }

    const token = await getTeacherInviteTokenById(tokenId);
    if (!token) {
      return NextResponse.json({ error: 'Запрошення не знайдено' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { reject } = body;

    if (token.status === 'submitted' && reject) {
      await rejectTeacherInvite(tokenId, user.id);

      await safeAddAuditEvent({
        entityType: 'teacher_invite',
        entityId: tokenId,
        entityTitle: `Запрошення #${tokenId}`,
        eventType: 'teacher_invite_rejected',
        eventBadge: toAuditBadge('teacher_invite_rejected'),
        description: `Відхилено запрошення викладача ${token.teacher_name || '(без імені)'}`,
        userId: user.id,
        userName: user.name,
        metadata: {
          tokenId,
          teacherEmail: token.teacher_email,
        },
      });

      return NextResponse.json({ rejected: true });
    }

    await deleteTeacherInviteToken(tokenId);

    await safeAddAuditEvent({
      entityType: 'teacher_invite',
      entityId: tokenId,
      entityTitle: `Запрошення #${tokenId}`,
      eventType: 'teacher_invite_deleted',
      eventBadge: toAuditBadge('teacher_invite_deleted'),
      description: `Видалено запрошення викладача ${token.teacher_name || '(без імені)'}`,
      userId: user.id,
      userName: user.name,
      metadata: { tokenId },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Error deleting teacher invite token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
