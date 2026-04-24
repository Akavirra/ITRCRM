/**
 * DELETE /api/student/works/[id] — soft-delete власної роботи учня.
 *
 * Файл на Google Drive НЕ видаляється — лише виставляється deleted_at.
 * Адмін може відновити (через адмін-панель, майбутнє розширення).
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentFromRequest } from '@/lib/student-auth';
import { softDeleteStudentWork } from '@/lib/student-works';

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

  const ok = await softDeleteStudentWork(workId, student.id);
  if (!ok) {
    return NextResponse.json({ error: 'Роботу не знайдено' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
