import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

// GET — list submissions (admin), optional ?status=pending|approved|rejected
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  let sql = `SELECT * FROM enrollment_submissions`;
  const params: (string | number)[] = [];

  if (status) {
    sql += ` WHERE status = $1`;
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const submissions = await all(sql, params);

  return NextResponse.json({ items: submissions, page, limit });
}
