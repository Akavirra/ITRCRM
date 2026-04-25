/**
 * GET /api/student/lessons/[id]/gallery
 *
 * Повертає галерею заняття (фото/відео від викладача та адміна).
 * Перевіряє, що учень має доступ до заняття (груповий або індивідуальний).
 *
 * Учень бачить лише прямі публічні Drive URL — БД-доступ обмежений роллю
 * crm_student із column-level GRANT (див. add-student-gallery-grant.js).
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentFromRequest } from '@/lib/student-auth';
import { listStudentGallery } from '@/lib/student-gallery';

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

  const items = await listStudentGallery(student.id, lessonId);
  if (items === null) {
    return NextResponse.json({ error: 'Немає доступу до цього заняття' }, { status: 403 });
  }

  return NextResponse.json({ items });
}
