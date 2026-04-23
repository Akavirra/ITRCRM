import { NextRequest, NextResponse } from 'next/server';
import { archiveMessageTemplate, updateMessageTemplate } from '@/lib/messaging';
import { badRequest, forbidden, getAuthUser, isAdmin, notFound, unauthorized } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const id = parseId(params.id);
  if (!id) return badRequest('Некоректний ID шаблону');

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || body.name.trim().length < 2) {
    return badRequest('Назва шаблону має містити щонайменше 2 символи');
  }

  if (typeof body.body !== 'string' || body.body.trim().length < 2) {
    return badRequest('Текст повідомлення обовʼязковий');
  }

  const template = await updateMessageTemplate(id, {
    name: body.name,
    subject: typeof body.subject === 'string' ? body.subject : null,
    body: body.body,
    variables: Array.isArray(body.variables) ? body.variables.map(String) : undefined,
    userId: user.id,
  });

  if (!template) return notFound('Шаблон не знайдено');

  return NextResponse.json({ template });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const id = parseId(params.id);
  if (!id) return badRequest('Некоректний ID шаблону');

  const archived = await archiveMessageTemplate(id, user.id);
  if (!archived) return notFound('Шаблон не знайдено');

  return NextResponse.json({ ok: true });
}
