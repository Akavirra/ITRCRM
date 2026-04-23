import { NextRequest, NextResponse } from 'next/server';
import { badRequest, forbidden, getAuthUser, isAdmin, notFound, unauthorized } from '@/lib/api-utils';
import { getCampaignDetails } from '@/lib/messaging';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return badRequest('Некоректний ідентифікатор розсилки');
  }

  const campaign = await getCampaignDetails(id);
  if (!campaign) {
    return notFound('Розсилку не знайдено');
  }

  return NextResponse.json({ campaign });
}
