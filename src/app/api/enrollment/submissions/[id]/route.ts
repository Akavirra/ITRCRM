import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, notFound } from '@/lib/api-utils';
import { getSubmissionById, updateSubmission, rejectSubmission } from '@/lib/enrollment';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const submission = await getSubmissionById(parseInt(params.id, 10));
  if (!submission) return notFound('Анкету не знайдено');

  return NextResponse.json(submission);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const submission = await getSubmissionById(parseInt(params.id, 10));
  if (!submission) return notFound('Анкету не знайдено');

  if (submission.status !== 'pending') {
    return badRequest('Можна редагувати тільки анкети зі статусом "очікує"');
  }

  const body = await request.json();
  const allowedFields = [
    'child_first_name',
    'child_last_name',
    'birth_date',
    'school',
    'email',
    'parent_name',
    'parent_phone',
    'parent_relation',
    'parent2_name',
    'parent2_phone',
    'parent2_relation',
    'notes',
    'interested_courses',
    'source',
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return badRequest('Немає даних для оновлення');
  }

  await updateSubmission(submission.id, updates);
  const updated = await getSubmissionById(submission.id);
  await safeAddAuditEvent({
    entityType: 'enrollment',
    entityId: submission.id,
    entityTitle: `${submission.child_last_name} ${submission.child_first_name}`.trim(),
    eventType: 'enrollment_submission_updated',
    eventBadge: toAuditBadge('enrollment_submission_updated'),
    description: 'Анкету оновлено',
    userId: user.id,
    userName: user.name,
    metadata: {
      submissionId: submission.id,
      tokenId: submission.token_id,
      updatedFields: Object.keys(updates),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const submission = await getSubmissionById(parseInt(params.id, 10));
  if (!submission) return notFound('Анкету не знайдено');

  if (submission.status !== 'pending') {
    return badRequest('Можна відхилити тільки анкети зі статусом "очікує"');
  }

  await rejectSubmission(submission.id, user.id);
  await safeAddAuditEvent({
    entityType: 'enrollment',
    entityId: submission.id,
    entityTitle: `${submission.child_last_name} ${submission.child_first_name}`.trim(),
    eventType: 'enrollment_submission_rejected',
    eventBadge: toAuditBadge('enrollment_submission_rejected'),
    description: 'Анкету відхилено',
    userId: user.id,
    userName: user.name,
    metadata: {
      submissionId: submission.id,
      tokenId: submission.token_id,
    },
  });

  return NextResponse.json({ success: true });
}
