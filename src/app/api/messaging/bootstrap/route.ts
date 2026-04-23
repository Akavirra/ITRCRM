import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthUser, isAdmin, unauthorized } from '@/lib/api-utils';
import { getMessagingBootstrap } from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  return NextResponse.json(await getMessagingBootstrap());
}
