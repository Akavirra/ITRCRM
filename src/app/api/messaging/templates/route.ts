import { NextRequest, NextResponse } from 'next/server';
import { badRequest, forbidden, getAuthUser, isAdmin, unauthorized } from '@/lib/api-utils';
import { createMessageTemplate, getMessageTemplates } from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') === 'telegram' || searchParams.get('channel') === 'viber'
    ? searchParams.get('channel') as 'telegram' | 'viber'
    : 'email';

  return NextResponse.json({ templates: await getMessageTemplates(channel) });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || body.name.trim().length < 2) {
    return badRequest('Назва шаблону має містити щонайменше 2 символи');
  }

  if (typeof body.body !== 'string' || body.body.trim().length < 2) {
    return badRequest('Текст повідомлення обовʼязковий');
  }

  const template = await createMessageTemplate({
    name: body.name,
    channel: body.channel === 'telegram' || body.channel === 'viber' ? body.channel : 'email',
    subject: typeof body.subject === 'string' ? body.subject : null,
    body: body.body,
    variables: Array.isArray(body.variables) ? body.variables.map(String) : undefined,
    userId: user.id,
  });

  return NextResponse.json({ template }, { status: 201 });
}
