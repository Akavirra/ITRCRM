import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { createEnrollmentToken, getAllTokens } from '@/lib/enrollment';

export const dynamic = 'force-dynamic';

// GET — list all tokens (admin)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const tokens = await getAllTokens();
  return NextResponse.json(tokens);
}

// POST — create new enrollment token (admin)
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const expiresInMinutes = body.expires_in_minutes || 60;

  const token = await createEnrollmentToken(user.id, expiresInMinutes);

  return NextResponse.json(token, { status: 201 });
}
