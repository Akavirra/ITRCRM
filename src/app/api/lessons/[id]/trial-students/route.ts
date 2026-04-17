import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, checkGroupAccess, forbidden, badRequest, notFound } from '@/lib/api-utils';
import { get } from '@/db';
import {
  addTrialStudentsToLesson,
  listTrialStudentsForLesson,
} from '@/lib/trial-attendance';

export const dynamic = 'force-dynamic';

// GET /api/lessons/[id]/trial-students — list trial students for a lesson
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const lessonId = parseInt(params.id, 10);
  if (isNaN(lessonId)) return badRequest('Невірний ID заняття');

  const lesson = await get<{ id: number; group_id: number | null }>(
    `SELECT id, group_id FROM lessons WHERE id = $1`,
    [lessonId],
  );
  if (!lesson) return notFound('Заняття не знайдено');

  if (lesson.group_id !== null) {
    const hasAccess = await checkGroupAccess(user, lesson.group_id);
    if (!hasAccess) return forbidden();
  }

  const trialStudents = await listTrialStudentsForLesson(lessonId);
  return NextResponse.json({ trialStudents });
}

// POST /api/lessons/[id]/trial-students — attach trial students to a lesson
//   body: { studentIds: number[] } or { studentId: number }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const lessonId = parseInt(params.id, 10);
  if (isNaN(lessonId)) return badRequest('Невірний ID заняття');

  const lesson = await get<{ id: number; group_id: number | null; status: string }>(
    `SELECT id, group_id, status FROM lessons WHERE id = $1`,
    [lessonId],
  );
  if (!lesson) return notFound('Заняття не знайдено');
  if (lesson.status === 'canceled') return badRequest('Неможливо додати пробних учнів до скасованого заняття');

  if (lesson.group_id !== null) {
    const hasAccess = await checkGroupAccess(user, lesson.group_id);
    if (!hasAccess) return forbidden();
  }

  let body: { studentIds?: unknown; studentId?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Невірний формат запиту');
  }

  let studentIds: number[] = [];
  if (Array.isArray(body.studentIds)) {
    studentIds = body.studentIds
      .map(x => Number(x))
      .filter(n => Number.isInteger(n) && n > 0);
  } else if (body.studentId !== undefined) {
    const n = Number(body.studentId);
    if (Number.isInteger(n) && n > 0) studentIds = [n];
  }

  if (studentIds.length === 0) return badRequest('Потрібно вказати принаймні одного учня');

  try {
    const result = await addTrialStudentsToLesson(lessonId, studentIds, user.id);
    return NextResponse.json({
      message: 'Пробних учнів додано',
      added: result.added,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('Add trial students error:', error);
    return NextResponse.json({ error: 'Не вдалося додати пробних учнів' }, { status: 500 });
  }
}
