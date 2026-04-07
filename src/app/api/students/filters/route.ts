import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getStudentsFilterBootstrap } from '@/lib/students-page';

export const dynamic = 'force-dynamic';

// GET /api/students/filters
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  return NextResponse.json(await getStudentsFilterBootstrap());
}
