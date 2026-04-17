import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, checkGroupAccess, forbidden, badRequest, notFound } from '@/lib/api-utils';
import { get } from '@/db';
import { removeTrialStudentFromLesson } from '@/lib/trial-attendance';

export const dynamic = 'force-dynamic';

// DELETE /api/lessons/[id]/trial-students/[studentId]
//   Remove a trial student from a lesson. Only rows with is_trial = TRUE can be removed.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; studentId: string } },
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const lessonId = parseInt(params.id, 10);
  const studentId = parseInt(params.studentId, 10);
  if (isNaN(lessonId) || isNaN(studentId)) return badRequest('Невірні параметри запиту');

  const lesson = await get<{ id: number; group_id: number | null }>(
    `SELECT id, group_id FROM lessons WHERE id = $1`,
    [lessonId],
  );
  if (!lesson) return notFound('Заняття не знайдено');

  if (lesson.group_id !== null) {
    const hasAccess = await checkGroupAccess(user, lesson.group_id);
    if (!hasAccess) return forbidden();
  }

  try {
    const result = await removeTrialStudentFromLesson(lessonId, studentId);

    if (!result.removed) {
      if (result.reason === 'not_found') {
        return NextResponse.json({ error: 'Учня не знайдено у цьому занятті' }, { status: 404 });
      }
      if (result.reason === 'not_trial') {
        return NextResponse.json(
          { error: 'Цього учня не можна видалити — він є постійним учасником групи' },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: 'Не вдалося видалити пробного учня' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Пробного учня видалено' });
  } catch (error) {
    console.error('Remove trial student error:', error);
    return NextResponse.json({ error: 'Не вдалося видалити пробного учня' }, { status: 500 });
  }
}
