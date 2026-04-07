import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, checkGroupAccess } from '@/lib/api-utils';
import { get } from '@/db';
import { deleteLessonPhoto } from '@/lib/lesson-photos';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  const user = await getAuthUser(request);

  if (!user) {
    return unauthorized();
  }

  if (user.role !== 'admin') {
    return forbidden();
  }

  const lessonId = parseInt(params.id, 10);
  const photoId = parseInt(params.photoId, 10);

  if (Number.isNaN(lessonId) || Number.isNaN(photoId)) {
    return NextResponse.json({ error: 'Невірні параметри' }, { status: 400 });
  }

  const lesson = await get<{ group_id: number | null }>(
    `SELECT group_id FROM lessons WHERE id = $1`,
    [lessonId]
  );

  if (!lesson || lesson.group_id === null) {
    return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
  }

  const hasAccess = await checkGroupAccess(user, lesson.group_id);
  if (!hasAccess) {
    return forbidden();
  }

  try {
    const deleted = await deleteLessonPhoto(photoId, lessonId, {
      id: user.id,
      name: user.name,
      via: 'admin',
    });
    if (!deleted) {
      return NextResponse.json({ error: 'Фото не знайдено' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Lesson photo delete error:', error);
    return NextResponse.json({ error: 'Не вдалося видалити фото' }, { status: 500 });
  }
}
