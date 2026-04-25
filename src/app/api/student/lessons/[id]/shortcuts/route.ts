/**
 * GET /api/student/lessons/[id]/shortcuts
 *
 * Phase D.1: учень читає ярлики свого заняття. Тільки SELECT, тільки безпечні
 * колонки (через crm_student GRANT).
 *
 * Доступ перевіряється у listStudentShortcuts (груповий або attendance).
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentFromRequest } from '@/lib/student-auth';
import { listStudentShortcuts } from '@/lib/student-shortcuts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const student = await getStudentFromRequest(request);
  if (!student) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const lessonId = parseInt(params.id, 10);
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  const items = await listStudentShortcuts(student.id, lessonId);
  if (items === null) {
    return NextResponse.json({ error: 'Немає доступу до цього заняття' }, { status: 403 });
  }

  return NextResponse.json({ items });
}
