import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, notFound } from '@/lib/api-utils';
import { closeEnrollmentToken, getEnrollmentTokenById } from '@/lib/enrollment';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const tokenId = parseInt(params.id, 10);
  if (!Number.isFinite(tokenId)) {
    return badRequest('Невірний ідентифікатор токена');
  }

  const token = await getEnrollmentTokenById(tokenId);
  if (!token) return notFound('Токен не знайдено');

  if (token.used_at) {
    return badRequest('Токен уже закритий');
  }

  if (new Date(token.expires_at) < new Date()) {
    return badRequest('Токен уже протермінований');
  }

  await closeEnrollmentToken(tokenId);
  return NextResponse.json({ success: true });
}
