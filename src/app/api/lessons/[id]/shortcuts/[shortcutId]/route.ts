/**
 * PATCH/DELETE /api/lessons/[id]/shortcuts/[shortcutId] — адмінський update/delete.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, notFound } from '@/lib/api-utils';
import {
  deleteLessonShortcut,
  getLessonShortcut,
  updateLessonShortcut,
  validateShortcutInput,
  ShortcutValidationError,
} from '@/lib/lesson-shortcuts';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string; shortcutId: string };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const lessonId = Number(params.id);
  const shortcutId = Number(params.shortcutId);
  if (!Number.isInteger(lessonId) || lessonId <= 0) return badRequest('Invalid lesson id');
  if (!Number.isInteger(shortcutId) || shortcutId <= 0) return badRequest('Invalid shortcut id');

  const existing = await getLessonShortcut(shortcutId);
  if (!existing) return notFound('Ярлик не знайдено');
  if (existing.lesson_id !== lessonId) return notFound('Ярлик не належить цьому заняттю');

  const body = await request.json().catch(() => ({}));

  let input;
  try {
    input = validateShortcutInput(body);
  } catch (e) {
    if (e instanceof ShortcutValidationError) {
      return NextResponse.json({ error: e.message, field: e.field }, { status: 400 });
    }
    throw e;
  }

  const updated = await updateLessonShortcut(shortcutId, input);
  if (!updated) return notFound('Ярлик не знайдено');

  return NextResponse.json({ item: updated });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const lessonId = Number(params.id);
  const shortcutId = Number(params.shortcutId);
  if (!Number.isInteger(lessonId) || lessonId <= 0) return badRequest('Invalid lesson id');
  if (!Number.isInteger(shortcutId) || shortcutId <= 0) return badRequest('Invalid shortcut id');

  const existing = await getLessonShortcut(shortcutId);
  if (!existing) return notFound('Ярлик не знайдено');
  if (existing.lesson_id !== lessonId) return notFound('Ярлик не належить цьому заняттю');

  const ok = await deleteLessonShortcut(shortcutId);
  if (!ok) return notFound('Ярлик не знайдено');

  return NextResponse.json({ ok: true });
}
