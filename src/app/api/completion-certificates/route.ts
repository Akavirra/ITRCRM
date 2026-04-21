import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest } from '@/lib/api-utils';
import {
  getCompletionCertificates,
  createCompletionCertificate,
  getCompletionCertificateById,
} from '@/lib/completion-certificates';
import { all, get } from '@/db';

export const dynamic = 'force-dynamic';

const MALE_NAME_EXCEPTIONS = new Set([
  'Микола',
  'Ілля',
  'Лука',
  'Кузьма',
  'Сава',
  'Фома',
  'Жора',
]);

const inferGenderFromName = (fullName?: string | null): 'male' | 'female' => {
  const nameParts = fullName?.trim().split(/\s+/).filter(Boolean) || [];
  const candidates = Array.from(new Set([nameParts[1], nameParts[0], nameParts[nameParts.length - 1]].filter(Boolean)));

  for (const token of candidates) {
    if (!token) continue;
    if (MALE_NAME_EXCEPTIONS.has(token)) return 'male';
    const normalized = token.toLowerCase();
    if (normalized.endsWith('а') || normalized.endsWith('я')) return 'female';
  }

  return 'male';
};

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
    const { student_id, student_ids, course_id, group_id, issue_date, gender } = body;
    const parsedCourseId = course_id ? parseInt(String(course_id), 10) : null;
    const parsedGroupId = group_id ? parseInt(String(group_id), 10) : null;
    const parsedStudentId = student_id ? parseInt(String(student_id), 10) : null;
    const normalizedStudentIds = Array.isArray(student_ids)
      ? student_ids.map((value) => parseInt(String(value), 10)).filter((value) => !Number.isNaN(value))
      : [];

    if ((!parsedStudentId && normalizedStudentIds.length === 0) || !issue_date) {
      return badRequest("Обов'язкові поля: учень або група учнів, дата видачі");
    }

    if (normalizedStudentIds.length > 0) {
      const students = await all<{ id: number; full_name: string; gender: 'male' | 'female' | null }>(
        `SELECT id, full_name, gender
         FROM students
         WHERE id = ANY($1::int[])`,
        [normalizedStudentIds]
      );

      if (students.length !== normalizedStudentIds.length) {
        return badRequest('Частину учнів не знайдено');
      }

      const studentsById = new Map(students.map((student) => [student.id, student]));
      const created = [];

      for (const currentStudentId of normalizedStudentIds) {
        const currentStudent = studentsById.get(currentStudentId);
        if (!currentStudent) continue;

        const certificate = await createCompletionCertificate({
          student_id: currentStudentId,
          course_id: parsedCourseId,
          group_id: parsedGroupId,
          issue_date,
          gender: currentStudent.gender || inferGenderFromName(currentStudent.full_name),
          created_by: user.id,
        });

        if (!certificate) {
          throw new Error('Не вдалося створити сертифікат');
        }

        const fullCertificate = await getCompletionCertificateById(certificate.id);
        created.push(fullCertificate ?? certificate);
      }

      return NextResponse.json({ created });
    }

    if (!parsedStudentId || !gender) {
      return badRequest("Обов'язкові поля: учень, дата видачі, стать");
    }

    if (!['male', 'female'].includes(gender)) {
      return badRequest('Стать має бути male або female');
    }

    const student = await get<{ id: number }>('SELECT id FROM students WHERE id = $1', [parsedStudentId]);
    if (!student) {
      return badRequest('Учня не знайдено');
    }

    const certificate = await createCompletionCertificate({
      student_id: parsedStudentId,
      course_id: parsedCourseId,
      group_id: parsedGroupId,
      issue_date,
      gender,
      created_by: user.id,
    });

    if (!certificate) {
      throw new Error('Не вдалося створити сертифікат');
    }

    const fullCertificate = await getCompletionCertificateById(certificate.id);

    return NextResponse.json(fullCertificate ?? certificate);
  } catch (error: any) {
    console.error('Completion Certificates POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
