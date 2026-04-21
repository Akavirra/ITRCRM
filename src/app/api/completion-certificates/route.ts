import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest } from '@/lib/api-utils';
import {
  getCompletionCertificates,
  createCompletionCertificate,
  getCompletionCertificateById,
} from '@/lib/completion-certificates';
import { get } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const certificates = await getCompletionCertificates();
    return NextResponse.json(certificates);
  } catch (error: any) {
    console.error('Completion Certificates GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { student_id, course_id, group_id, issue_date, gender } = body;

    if (!student_id || !issue_date || !gender) {
      return badRequest("Обов'язкові поля: учень, дата видачі, стать");
    }

    if (!['male', 'female'].includes(gender)) {
      return badRequest('Стать має бути male або female');
    }

    // Verify student exists
    const student = await get<{ id: number }>('SELECT id FROM students WHERE id = $1', [student_id]);
    if (!student) {
      return badRequest('Учня не знайдено');
    }

    const cert = await createCompletionCertificate({
      student_id: parseInt(student_id, 10),
      course_id: course_id ? parseInt(course_id, 10) : null,
      group_id: group_id ? parseInt(group_id, 10) : null,
      issue_date,
      gender,
      created_by: user.id,
    });

    if (!cert) {
      throw new Error('Не вдалося створити сертифікат');
    }

    const fullCert = await getCompletionCertificateById(cert.id);

    return NextResponse.json(fullCert ?? cert);
  } catch (error: any) {
    console.error('Completion Certificates POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
