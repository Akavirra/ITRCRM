import { NextRequest, NextResponse } from 'next/server';
import { badRequest, forbidden, getAuthUser, isAdmin, unauthorized } from '@/lib/api-utils';
import { createAndSendCampaign } from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || body.name.trim().length < 2) {
    return badRequest('Назва розсилки обовʼязкова');
  }

  if (typeof body.subject !== 'string' || body.subject.trim().length < 2) {
    return badRequest('Тема email обовʼязкова');
  }

  if (typeof body.body !== 'string' || body.body.trim().length < 2) {
    return badRequest('Текст повідомлення обовʼязковий');
  }

  const campaign = await createAndSendCampaign({
    name: body.name,
    channel: 'email',
    provider: 'resend',
    subject: body.subject,
    body: body.body,
    audienceFilter: body.filter || {},
    templateId: Number.isInteger(Number(body.templateId)) ? Number(body.templateId) : null,
    createdBy: user.id,
  });

  return NextResponse.json({ campaign });
}
