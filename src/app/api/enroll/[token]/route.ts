import { NextRequest, NextResponse } from 'next/server';
import { validateToken, markTokenUsed, createSubmission } from '@/lib/enrollment';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const { valid, reason } = await validateToken(params.token);

  if (!valid) {
    return NextResponse.json({ valid: false, reason }, { status: 400 });
  }

  return NextResponse.json({ valid: true });
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const { valid, reason, tokenData } = await validateToken(params.token);

  if (!valid || !tokenData) {
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  const body = await request.json();
  const errors: string[] = [];

  if (!body.child_first_name?.trim()) errors.push("Ім'я дитини обов'язкове");
  if (!body.child_last_name?.trim()) errors.push('Прізвище дитини обов’язкове');
  if (!body.parent_name?.trim()) errors.push("Ім'я батьків обов'язкове");
  if (!body.parent_phone?.trim()) errors.push("Телефон обов'язковий");

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
  }

  const phone = body.parent_phone.replace(/[^\d+]/g, '');
  if (phone.length < 10) {
    return NextResponse.json({ error: 'Невірний формат телефону' }, { status: 400 });
  }

  const submission = await createSubmission(tokenData.id, {
    child_first_name: body.child_first_name.trim(),
    child_last_name: body.child_last_name.trim(),
    birth_date: body.birth_date || undefined,
    school: body.school?.trim() || undefined,
    parent_name: body.parent_name.trim(),
    parent_phone: phone,
    parent_relation: body.parent_relation || undefined,
    parent2_name: body.parent2_name?.trim() || undefined,
    parent2_phone: body.parent2_phone?.replace(/[^\d+]/g, '') || undefined,
    parent2_relation: body.parent2_relation || undefined,
    notes: body.notes?.trim() || undefined,
    interested_courses: body.interested_courses || undefined,
    source: body.source?.trim() || undefined,
  });

  await markTokenUsed(tokenData.id);
  await safeAddAuditEvent({
    entityType: 'enrollment',
    entityId: submission.id,
    entityTitle: `${submission.child_last_name} ${submission.child_first_name}`.trim(),
    eventType: 'enrollment_submission_created',
    eventBadge: toAuditBadge('enrollment_submission_created'),
    description: 'Створено нову анкету вступу',
    userName: 'Публічна форма',
    metadata: {
      submissionId: submission.id,
      tokenId: tokenData.id,
      parentPhone: phone,
    },
  });

  return NextResponse.json({ success: true, id: submission.id }, { status: 201 });
}
