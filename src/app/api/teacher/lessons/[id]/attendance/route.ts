/**
 * POST /api/teacher/lessons/[id]/attendance
 *
 * Upsert присутності одного учня. Body:
 *   { studentId: number, status: 'present'|'absent'|'late'|'excused', comment?: string|null }
 *
 * Перевірки:
 *   - заняття належить викладачу (assertOwnsLesson)
 *   - учень — у моїй групі (assertOwnsStudent)
 *
 * Відповідь — оновлений список присутності для зручності UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  upsertAttendanceForMyLesson,
  listAttendanceForMyLesson,
} from '@/lib/teacher-data';
import {
  requireTeacher,
  handleTeacherApiError,
  parsePositiveInt,
} from '@/lib/teacher-api-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// БД дозволяє: 'present', 'absent', 'makeup_planned', 'makeup_done'.
// makeup-статуси — окремий flow (планування відпрацювання), не звичайна позначка.
// Якщо UI шле 'sick' (для сумісності з teacher-app) — мапимо на 'absent'.
const VALID_STATUSES = new Set(['present', 'absent']);
const MAX_COMMENT = 500;

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
  const studentId = parsePositiveInt(String(body?.studentId ?? ''));
  const rawStatus = typeof body?.status === 'string' ? body.status : '';
  // Сумісність з teacher-app, який шле 'sick' як еквівалент 'absent'
  const status = rawStatus === 'sick' ? 'absent' : rawStatus;
  const commentRaw = typeof body?.comment === 'string' ? body.comment.trim() : '';

  if (!studentId) {
    return NextResponse.json({ error: 'studentId обовʼязковий' }, { status: 400 });
  }
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json(
      { error: 'status має бути "present" або "absent"' },
      { status: 400 },
    );
  }
  if (commentRaw.length > MAX_COMMENT) {
    return NextResponse.json(
      { error: `Коментар задовгий (макс. ${MAX_COMMENT} символів)` },
      { status: 400 },
    );
  }

  try {
    await upsertAttendanceForMyLesson(
      teacher.id,
      lessonId,
      studentId,
      status as 'present' | 'absent',
      commentRaw || null,
    );
    const attendance = await listAttendanceForMyLesson(teacher.id, lessonId);
    return NextResponse.json({ attendance });
  } catch (e) {
    const handled = handleTeacherApiError(e);
    if (handled) return handled;
    console.error('[teacher/attendance POST] error:', e);
    return NextResponse.json({ error: 'Не вдалося зберегти присутність' }, { status: 500 });
  }
}
