import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { NextRequest, NextResponse } from 'next/server';
import { getNextPublicId } from '@/lib/certificates';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const nextId = await getNextPublicId();
    return NextResponse.json({ nextId });
  } catch (error: any) {
    console.error('Certificates next-id Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
