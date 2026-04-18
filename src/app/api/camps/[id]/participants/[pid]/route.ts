import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest, notFound } from '@/lib/api-utils';
import { getParticipantById, updateParticipant, deleteParticipant } from '@/lib/camp-participants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string; pid: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const pid = parseInt(params.pid, 10);
  if (isNaN(pid)) return badRequest('Невірний ID');

  const participant = await getParticipantById(pid);
  if (!participant) return notFound('Учасника не знайдено');

  return NextResponse.json({ participant });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string; pid: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const pid = parseInt(params.pid, 10);
  if (isNaN(pid)) return badRequest('Невірний ID');

  try {
    const body = await request.json();
    const patch: Parameters<typeof updateParticipant>[1] = {};

    if (body.shift_id !== undefined) {
      if (body.shift_id === null || body.shift_id === '') patch.shift_id = null;
      else {
        const n = parseInt(String(body.shift_id), 10);
        if (isNaN(n)) return badRequest('Невірний ID зміни');
        patch.shift_id = n;
      }
    }
    if (body.first_name !== undefined) patch.first_name = String(body.first_name).trim();
    if (body.last_name !== undefined) patch.last_name = String(body.last_name).trim();
    if (body.parent_name !== undefined) patch.parent_name = body.parent_name ? String(body.parent_name) : null;
    if (body.parent_phone !== undefined) patch.parent_phone = body.parent_phone ? String(body.parent_phone) : null;
    if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null;
    if (body.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'cancelled') return badRequest('Невірний статус');
      patch.status = body.status;
    }
    if (body.student_id !== undefined) {
      if (body.student_id === null || body.student_id === '') patch.student_id = null;
      else {
        const n = parseInt(String(body.student_id), 10);
        if (isNaN(n)) return badRequest('Невірний ID учня');
        patch.student_id = n;
      }
    }

    const participant = await updateParticipant(pid, patch);
    if (!participant) return notFound('Учасника не знайдено');
    return NextResponse.json({ participant });
  } catch (error) {
    console.error('Update participant error:', error);
    return NextResponse.json({ error: 'Не вдалося оновити' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; pid: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const pid = parseInt(params.pid, 10);
  if (isNaN(pid)) return badRequest('Невірний ID');

  try {
    await deleteParticipant(pid);
    return NextResponse.json({ message: 'Учасника видалено' });
  } catch (error) {
    console.error('Delete participant error:', error);
    return NextResponse.json({ error: 'Не вдалося видалити' }, { status: 500 });
  }
}
