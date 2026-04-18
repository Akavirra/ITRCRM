import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest } from '@/lib/api-utils';
import { convertParticipantToStudent } from '@/lib/camp-participants';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string; pid: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const pid = parseInt(params.pid, 10);
  if (isNaN(pid)) return badRequest('Невірний ID');

  try {
    const result = await convertParticipantToStudent(pid, user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Convert to student error:', error);
    return NextResponse.json({ error: 'Не вдалося перетворити на учня' }, { status: 500 });
  }
}
