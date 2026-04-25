/**
 * GET/POST /api/lessons/[id]/shortcuts — адмінський CRUD ярликів заняття.
 *
 * GET — список усіх ярликів заняття.
 * POST — створити новий (приймає {kind, label, target, icon?, sortOrder?}).
 *
 * Пер-elementні дії — у `[shortcutId]/route.ts` (PATCH/DELETE).
 *
 * Phase D.1.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, notFound } from '@/lib/api-utils';
import { get } from '@/db';
import {
  createLessonShortcut,
  listLessonShortcuts,
  validateShortcutInput,
  ShortcutValidationError,
} from '@/lib/lesson-shortcuts';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

async function loadLesson(lessonId: number) {
  return get<{ id: number; group_id: number | null }>(
    `SELECT id, group_id FROM lessons WHERE id = $1`,
    [lessonId],
  );
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const lessonId = Number(params.id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) return badRequest('Invalid lesson id');

  const lesson = await loadLesson(lessonId);
  if (!lesson) return notFound('Заняття не знайдено');

  const items = await listLessonShortcuts(lessonId);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const lessonId = Number(params.id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) return badRequest('Invalid lesson id');

  const lesson = await loadLesson(lessonId);
  if (!lesson) return notFound('Заняття не знайдено');

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

  const created = await createLessonShortcut(lessonId, input, {
    userId: user.id,
    name: user.name,
    telegramId: null,
  });

  return NextResponse.json({ item: created }, { status: 201 });
}
