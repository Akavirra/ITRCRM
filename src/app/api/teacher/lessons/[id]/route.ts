/**
 * GET / PATCH /api/teacher/lessons/[id]
 *
 * GET   — повертає заняття (або 403/404 якщо не його)
 * PATCH — оновлює topic / notes
 *
 * Body PATCH:
 *   { topic?: string|null, notes?: string|null }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getMyLesson,
  updateMyLessonContent,
} from '@/lib/teacher-data';
import {
  requireTeacher,
  handleTeacherApiError,
  parsePositiveInt,
} from '@/lib/teacher-api-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_TOPIC = 500;
const MAX_NOTES = 5000;

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
    const lesson = await getMyLesson(teacher.id, lessonId);
    if (!lesson) {
      return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
    }
    return NextResponse.json({ lesson });
  } catch (e) {
    const handled = handleTeacherApiError(e);
    if (handled) return handled;
    console.error('[teacher/lessons GET] error:', e);
    return NextResponse.json({ error: 'Внутрішня помилка' }, { status: 500 });
  }
}

export async function PATCH(
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

  // Валідація на місці — мала кількість полів
  const patch: { topic?: string | null; notes?: string | null } = {};
  if (body && Object.prototype.hasOwnProperty.call(body, 'topic')) {
    if (body.topic === null || body.topic === '') {
      patch.topic = null;
    } else if (typeof body.topic === 'string') {
      const trimmed = body.topic.trim();
      if (trimmed.length > MAX_TOPIC) {
        return NextResponse.json(
          { error: `Тема задовга (макс. ${MAX_TOPIC} символів)` },
          { status: 400 },
        );
      }
      patch.topic = trimmed || null;
    }
  }
  if (body && Object.prototype.hasOwnProperty.call(body, 'notes')) {
    if (body.notes === null || body.notes === '') {
      patch.notes = null;
    } else if (typeof body.notes === 'string') {
      const trimmed = body.notes.trim();
      if (trimmed.length > MAX_NOTES) {
        return NextResponse.json(
          { error: `Нотатка задовга (макс. ${MAX_NOTES} символів)` },
          { status: 400 },
        );
      }
      patch.notes = trimmed || null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Нема що оновлювати' }, { status: 400 });
  }

  try {
    await updateMyLessonContent(teacher.id, lessonId, patch);
    const lesson = await getMyLesson(teacher.id, lessonId);
    return NextResponse.json({ lesson });
  } catch (e) {
    const handled = handleTeacherApiError(e);
    if (handled) return handled;
    console.error('[teacher/lessons PATCH] error:', e);
    return NextResponse.json({ error: 'Не вдалося оновити заняття' }, { status: 500 });
  }
}
