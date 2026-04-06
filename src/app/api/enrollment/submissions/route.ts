import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getSubmissions } from '@/lib/enrollment';

export const dynamic = 'force-dynamic';

// GET — list submissions (admin), optional ?status=pending|approved|rejected
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;

  const submissions = await getSubmissions(status);
  return NextResponse.json(submissions);
}
