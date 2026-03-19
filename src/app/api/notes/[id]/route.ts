import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, notFound } from '@/lib/api-utils';
import { get, run } from '@/db';

export const dynamic = 'force-dynamic';

interface NoteRow {
  id: number;
  user_id: number;
}

// PATCH /api/notes/[id] — update note
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) return unauthorized();

  const note = await get<NoteRow>(`SELECT id, user_id FROM notes WHERE id = $1`, [params.id]);
  if (!note) return notFound('Нотатку не знайдено');
  if (note.user_id !== currentUser.id) return forbidden();

  const body = await request.json();
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.title !== undefined)     { fields.push(`title = $${idx++}`);     values.push(body.title); }
  if (body.content !== undefined)   { fields.push(`content = $${idx++}`);   values.push(body.content); }
  if (body.tasks !== undefined)     { fields.push(`tasks = $${idx++}`);     values.push(JSON.stringify(body.tasks)); }
  if (body.color !== undefined)     { fields.push(`color = $${idx++}`);     values.push(body.color); }
  if (body.is_pinned !== undefined) { fields.push(`is_pinned = $${idx++}`); values.push(body.is_pinned); }
  if (body.tags !== undefined)      { fields.push(`tags = $${idx++}`);      values.push(body.tags); }
  if (body.deadline !== undefined)  { fields.push(`deadline = $${idx++}`);  values.push(body.deadline || null); }

  if (fields.length === 0) return NextResponse.json({ ok: true });

  fields.push(`updated_at = NOW()`);
  values.push(params.id);

  await run(
    `UPDATE notes SET ${fields.join(', ')} WHERE id = $${idx}`,
    values
  );

  return NextResponse.json({ ok: true });
}

// DELETE /api/notes/[id] — delete note
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) return unauthorized();

  const note = await get<NoteRow>(`SELECT id, user_id FROM notes WHERE id = $1`, [params.id]);
  if (!note) return notFound('Нотатку не знайдено');
  if (note.user_id !== currentUser.id) return forbidden();

  await run(`DELETE FROM notes WHERE id = $1`, [params.id]);
  return NextResponse.json({ ok: true });
}
