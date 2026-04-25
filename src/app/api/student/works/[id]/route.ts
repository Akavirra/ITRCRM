/**
 * DELETE /api/student/works/[id] — soft-delete власної роботи учня.
 *
 * Phase B: можна видалити ТІЛЬКИ поки upload-вікно заняття відкрите.
 * Legacy-роботи без lesson_id також дозволено видаляти (інакше адмін
 * заблокує все старе, що до міграції не мало прив'язки).
 *
 * Файл на Google Drive НЕ видаляється — лише виставляється deleted_at.
 * Адмін може відновити (через адмін-панель, майбутнє розширення).
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentFromRequest } from '@/lib/student-auth';
import {
  getStudentWorkForStudent,
  getLessonForStudent,
  softDeleteStudentWork,
} from '@/lib/student-works';
import { getUploadWindow } from '@/lib/student-lesson-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const student = await getStudentFromRequest(request);
  if (!student) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const workId = parseInt(params.id, 10);
  if (!Number.isFinite(workId) || workId <= 0) {
    return NextResponse.json({ error: 'Invalid work id' }, { status: 400 });
  }

  // 1) знайти роботу (з перевіркою ownership)
  const work = await getStudentWorkForStudent(workId, student.id);
  if (!work) {
    return NextResponse.json({ error: 'Роботу не знайдено' }, { status: 404 });
  }

  // 2) якщо прив'язана до заняття — upload window має бути відкрите
  if (work.lesson_id) {
    const lesson = await getLessonForStudent(student.id, work.lesson_id);
    if (lesson) {
      const window = getUploadWindow(lesson);
      if (!window.isOpen) {
        return NextResponse.json(
          {
            error: 'Видалення недоступне — вікно завантаження вже закрито. Зверніться до викладача.',
            opensAt: window.opensAt,
            closesAt: window.closesAt,
          },
          { status: 403 },
        );
      }
    }
    // якщо lesson не знайдено (видалений з боку адміна) — дозволяємо soft-delete
  }

  const ok = await softDeleteStudentWork(workId, student.id);
  if (!ok) {
    return NextResponse.json({ error: 'Роботу не знайдено' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
