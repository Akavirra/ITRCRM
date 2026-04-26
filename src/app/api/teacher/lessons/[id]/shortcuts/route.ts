/**
 * GET / POST /api/teacher/lessons/[id]/shortcuts
 *
 * GET  — список ярликів заняття
 * POST — створити новий ярлик ({kind, label, target, icon?, sortOrder?})
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listMyLessonShortcuts,
  createMyLessonShortcut,
} from '@/lib/teacher-data';
import { validateShortcutInput } from '@/lib/lesson-shortcuts-shared';
import {
  requireTeacher,
  handleTeacherApiError,
  parsePositiveInt,
} from '@/lib/teacher-api-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const teacher = await requireTeacher(request);
  if (teacher instanceof NextResponse) return teacher;

  const lessonId = parsePositiveInt(params.id);
  if (!lessonId) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  try {
    const items = await listMyLessonShortcuts(teacher.id, lessonId);
    return NextResponse.json({ items });
  } catch (e) {
    const handled = handleTeacherApiError(e);
    if (handled) return handled;
    console.error('[teacher/shortcuts GET] error:', e);
    return NextResponse.json({ error: 'Внутрішня помилка' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const teacher = await requireTeacher(request);
  if (teacher instanceof NextResponse) return teacher;

  const lessonId = parsePositiveInt(params.id);
  if (!lessonId) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    const input = validateShortcutInput(body);
    const item = await createMyLessonShortcut(
      teacher.id,
      teacher.full_name,
      lessonId,
      input,
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    const handled = handleTeacherApiError(e);
    if (handled) return handled;
    console.error('[teacher/shortcuts POST] error:', e);
    return NextResponse.json({ error: 'Не вдалося створити ярлик' }, { status: 500 });
  }
}
