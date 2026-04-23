import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthUser, isAdmin, unauthorized } from '@/lib/api-utils';
import { getAudiencePreview } from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const body = await request.json().catch(() => ({}));
  const preview = await getAudiencePreview(body?.filter || {});

  return NextResponse.json(preview);
}
