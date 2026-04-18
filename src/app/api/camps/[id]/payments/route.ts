import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest } from '@/lib/api-utils';
import { listPaymentsForCamp } from '@/lib/camp-payments';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return badRequest('Невірний ID');

  const payments = await listPaymentsForCamp(id);
  return NextResponse.json({ payments });
}
