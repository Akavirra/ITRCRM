/**
 * PATCH / DELETE /api/teacher/lessons/[id]/shortcuts/[shortcutId]
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  updateMyLessonShortcut,
  deleteMyLessonShortcut,
} from '@/lib/teacher-data';
import { validateShortcutInput } from '@/lib/lesson-shortcuts-shared';
import {
  requireTeacher,
  handleTeacherApiError,
  parsePositiveInt,
} from '@/lib/teacher-api-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; shortcutId: string } },
) {
  const teacher = await requireTeacher(request);
  if (teacher instanceof NextResponse) return teacher;

  const lessonId = parsePositiveInt(params.id);
  const shortcutId = parsePositiveInt(params.shortcutId);
  if (!lessonId || !shortcutId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    const input = validateShortcutInput(body);
    const item = await updateMyLessonShortcut(teacher.id, lessonId, shortcutId, input);
    if (!item) {
      return NextResponse.json({ error: 'Ярлик не знайдено' }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (e) {
    const handled = handleTeacherApiError(e);
    if (handled) return handled;
    console.error('[teacher/shortcuts PATCH] error:', e);
    return NextResponse.json({ error: 'Не вдалося оновити ярлик' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; shortcutId: string } },
) {
  const teacher = await requireTeacher(request);
  if (teacher instanceof NextResponse) return teacher;

  const lessonId = parsePositiveInt(params.id);
  const shortcutId = parsePositiveInt(params.shortcutId);
  if (!lessonId || !shortcutId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const ok = await deleteMyLessonShortcut(teacher.id, lessonId, shortcutId);
    if (!ok) {
      return NextResponse.json({ error: 'Ярлик не знайдено' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const handled = handleTeacherApiError(e);
    if (handled) return handled;
    console.error('[teacher/shortcuts DELETE] error:', e);
    return NextResponse.json({ error: 'Не вдалося видалити' }, { status: 500 });
  }
}
