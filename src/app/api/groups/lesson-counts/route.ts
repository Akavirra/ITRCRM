import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getBatchGroupLessonCounts } from '@/lib/payments-page';

export const dynamic = 'force-dynamic';

// GET /api/groups/lesson-counts?groupIds=1,2&months=2026-03,2026-04
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const groupIds = (searchParams.get('groupIds') || '')
    .split(',')
    .map((value) => parseInt(value, 10))
    .filter((value) => !Number.isNaN(value));
  const months = (searchParams.get('months') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return NextResponse.json({
    counts: await getBatchGroupLessonCounts(groupIds, months),
  });
}
