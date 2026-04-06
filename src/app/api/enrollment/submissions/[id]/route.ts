import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, notFound } from '@/lib/api-utils';
import { getSubmissionById, updateSubmission, rejectSubmission } from '@/lib/enrollment';

export const dynamic = 'force-dynamic';

// GET — get submission details (admin)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const submission = await getSubmissionById(parseInt(params.id));
  if (!submission) return notFound('Анкету не знайдено');

  return NextResponse.json(submission);
}

// PUT — update submission data (admin)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const submission = await getSubmissionById(parseInt(params.id));
  if (!submission) return notFound('Анкету не знайдено');

  if (submission.status !== 'pending') {
    return badRequest('Можна редагувати тільки анкети зі статусом "очікує"');
  }

  const body = await request.json();
  const allowedFields = [
    'child_first_name', 'child_last_name', 'birth_date', 'school',
    'parent_name', 'parent_phone', 'parent_relation',
    'parent2_name', 'parent2_relation', 'notes', 'interested_courses', 'source',
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

  return NextResponse.json(updated);
}

// DELETE — reject submission (admin)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const submission = await getSubmissionById(parseInt(params.id));
  if (!submission) return notFound('Анкету не знайдено');

  if (submission.status !== 'pending') {
    return badRequest('Можна відхилити тільки анкети зі статусом "очікує"');
  }

  await rejectSubmission(submission.id, user.id);
  return NextResponse.json({ success: true });
}
