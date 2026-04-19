import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, notFound } from '@/lib/api-utils';
import { getSubmissionById, approveSubmission } from '@/lib/enrollment';
import { createStudent } from '@/lib/students';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const submission = await getSubmissionById(parseInt(params.id, 10));
  if (!submission) return notFound('Анкету не знайдено');

  if (submission.status !== 'pending') {
    return badRequest('Можна затвердити тільки анкети зі статусом "очікує"');
  }

  const body = await request.json().catch(() => ({}));
  const fullName = normalizeOptionalString(body.full_name) || `${submission.child_last_name} ${submission.child_first_name}`;
  const parentName = normalizeOptionalString(body.parent_name) || submission.parent_name || undefined;
  const parentPhone = normalizeOptionalString(body.parent_phone) || submission.parent_phone || undefined;
  const parent2Name = normalizeOptionalString(body.parent2_name) || submission.parent2_name || undefined;
  const parent2Phone = normalizeOptionalString(body.parent2_phone) || submission.parent2_phone || undefined;

  const student = await createStudent(
    fullName,
    undefined,
    submission.email || undefined,
    parentName,
    parentPhone,
    submission.notes || undefined,
    submission.birth_date || undefined,
    undefined,
    submission.school || undefined,
    undefined,
    submission.parent_relation || undefined,
    parent2Name,
    parent2Phone,
    submission.parent2_relation || undefined,
    submission.interested_courses || undefined,
    submission.source || undefined
  );

  await approveSubmission(submission.id, user.id, student.id);
  await safeAddAuditEvent({
    entityType: 'enrollment',
    entityId: submission.id,
    entityTitle: `${submission.child_last_name} ${submission.child_first_name}`.trim(),
    eventType: 'enrollment_submission_approved',
    eventBadge: toAuditBadge('enrollment_submission_approved'),
    description: `Анкету затверджено та створено учня ${fullName}`,
    userId: user.id,
    userName: user.name,
    studentId: student.id,
    metadata: {
      submissionId: submission.id,
      tokenId: submission.token_id,
      studentId: student.id,
      studentPublicId: student.public_id,
      email: submission.email,
      interestedCourses: submission.interested_courses,
    },
  });

  return NextResponse.json({
    success: true,
    student_id: student.id,
    student_public_id: student.public_id,
  });
}
