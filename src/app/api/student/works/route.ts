/**
 * GET /api/student/works — список власних робіт учня (не видалених).
 *
 * Використовує ТІЛЬКИ роль crm_student через @/db/neon-student.
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentFromRequest } from '@/lib/student-auth';
import { listStudentWorks } from '@/lib/student-works';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const works = await listStudentWorks(student.id);
  return NextResponse.json({ works });
}
