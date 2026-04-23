import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthUser, isAdmin, unauthorized } from '@/lib/api-utils';
import { getCampaigns } from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 25, 1), 100);

  return NextResponse.json({ campaigns: await getCampaigns(limit) });
}
