import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest } from '@/lib/api-utils';
import { setParticipantDays } from '@/lib/camp-participants';

export const dynamic = 'force-dynamic';

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string; pid: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const pid = parseInt(params.pid, 10);
  if (isNaN(pid)) return badRequest('Невірний ID');

  try {
    const body = await request.json();
    if (!Array.isArray(body.days)) return badRequest('Очікується масив days');
    const valid: string[] = body.days.filter((d: unknown) => isValidDate(d));

    const saved = await setParticipantDays(pid, valid);
    return NextResponse.json({ days: saved, count: saved.length });
  } catch (error) {
    console.error('Set participant days error:', error);
    return NextResponse.json({ error: 'Не вдалося зберегти дні' }, { status: 500 });
  }
}
