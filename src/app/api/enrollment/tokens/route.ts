import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { createEnrollmentToken, getAllTokens } from '@/lib/enrollment';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const tokens = await getAllTokens();
  return NextResponse.json(tokens);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const expiresInMinutes = body.expires_in_minutes || 60;

  const token = await createEnrollmentToken(user.id, expiresInMinutes);
  await safeAddAuditEvent({
    entityType: 'enrollment',
    entityId: token.id,
    entityTitle: `Токен анкети #${token.id}`,
    eventType: 'enrollment_token_created',
    eventBadge: toAuditBadge('enrollment_token_created'),
    description: `Створено токен анкети на ${expiresInMinutes} хв`,
    userId: user.id,
    userName: user.name,
    metadata: {
      tokenId: token.id,
      expiresAt: token.expires_at,
      expiresInMinutes,
    },
  });

  return NextResponse.json(token, { status: 201 });
}
