import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, notFound } from '@/lib/api-utils';
import { get } from '@/db';
import { deleteLessonPhoto } from '@/lib/lesson-photos';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const file = await get<{ id: number }>(
    'SELECT id FROM lesson_photo_files WHERE id = $1',
    [params.id]
  );

  if (!file) {
    return notFound('File not found');
  }

  await deleteLessonPhoto(file.id, undefined, {
    id: user.id,
    name: user.name,
    via: 'admin',
  });

  return NextResponse.json({ ok: true });
}
