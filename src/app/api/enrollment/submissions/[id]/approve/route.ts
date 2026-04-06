import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, notFound } from '@/lib/api-utils';
import { getSubmissionById, approveSubmission } from '@/lib/enrollment';
import { createStudent } from '@/lib/students';

export const dynamic = 'force-dynamic';

// POST — approve submission and create student (admin)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const submission = await getSubmissionById(parseInt(params.id));
  if (!submission) return notFound('Анкету не знайдено');

  if (submission.status !== 'pending') {
    return badRequest('Можна затвердити тільки анкети зі статусом "очікує"');
  }

  // Allow admin to override data before creating student
  const body = await request.json().catch(() => ({}));

  const fullName = body.full_name ||
    `${submission.child_last_name} ${submission.child_first_name}`;

  const student = await createStudent(
    fullName,
    undefined,                                     // phone (student)
    undefined,                                     // email
    body.parent_name || submission.parent_name,
    body.parent_phone || submission.parent_phone,
    submission.notes || undefined,
    submission.birth_date || undefined,
    undefined,                                     // photo
    submission.school || undefined,
    undefined,                                     // discount
    submission.parent_relation || undefined,
    submission.parent2_name || undefined,
    submission.parent2_phone || undefined,
    submission.parent2_relation || undefined,
    submission.interested_courses || undefined,
    submission.source || undefined
  );

  await approveSubmission(submission.id, user.id, student.id);

  return NextResponse.json({
    success: true,
    student_id: student.id,
    student_public_id: student.public_id,
  });
}
