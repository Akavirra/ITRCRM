import { all, run } from '@/db';

export type AuditEntityType =
  | 'student'
  | 'group'
  | 'lesson'
  | 'payment'
  | 'individual_payment'
  | 'course'
  | 'teacher'
  | 'user'
  | 'enrollment'
  | 'teacher_invite'
  | 'media'
  | 'system';

export interface AuditEventEntry {
  id: number;
  entity_type: AuditEntityType;
  entity_id: number | null;
  entity_public_id: string | null;
  entity_title: string;
  event_type: string;
  event_badge: string;
  description: string;
  user_id: number | null;
  user_name: string;
  student_id: number | null;
  group_id: number | null;
  lesson_id: number | null;
  payment_id: number | null;
  course_id: number | null;
  metadata: unknown;
  created_at: string;
}

export interface AddAuditEventInput {
  entityType: AuditEntityType;
  entityId?: number | null;
  entityPublicId?: string | null;
  entityTitle: string;
  eventType: string;
  eventBadge?: string | null;
  description: string;
  userId?: number | null;
  userName: string;
  studentId?: number | null;
  groupId?: number | null;
  lessonId?: number | null;
  paymentId?: number | null;
  courseId?: number | null;
  metadata?: Record<string, unknown> | null;
}

export function toAuditBadge(eventType: string): string {
  return eventType
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'UPDATED';
}

export async function addAuditEvent(input: AddAuditEventInput): Promise<number> {
  const result = await run(
    `INSERT INTO audit_events (
      entity_type,
      entity_id,
      entity_public_id,
      entity_title,
      event_type,
      event_badge,
      description,
      user_id,
      user_name,
      student_id,
      group_id,
      lesson_id,
      payment_id,
      course_id,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
    RETURNING id`,
    [
      input.entityType,
      input.entityId ?? null,
      input.entityPublicId ?? null,
      input.entityTitle,
      input.eventType,
      input.eventBadge ?? toAuditBadge(input.eventType),
      input.description,
      input.userId ?? null,
      input.userName,
      input.studentId ?? null,
      input.groupId ?? null,
      input.lessonId ?? null,
      input.paymentId ?? null,
      input.courseId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );

  return Number(result[0]?.id);
}

export async function safeAddAuditEvent(input: AddAuditEventInput): Promise<void> {
  try {
    await addAuditEvent(input);
  } catch (error) {
    console.error('[audit-events] Failed to log audit event:', error);
  }
}

export async function getRecentAuditEvents(limit = 10): Promise<AuditEventEntry[]> {
  return all<AuditEventEntry>(
    `SELECT *
     FROM audit_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
}
