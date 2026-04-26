import { run, get, all } from '@/db';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface EnrollmentToken {
  id: number;
  token: string;
  expires_at: string;
  used_at: string | null;
  manually_closed_at?: string | null;
  has_submission?: boolean;
  parent_telegram_chat_id: string | null;
  created_by: number;
  created_at: string;
}

export interface EnrollmentSubmission {
  id: number;
  token_id: number;
  child_first_name: string;
  child_last_name: string;
  birth_date: string | null;
  school: string | null;
  email: string | null;
  parent_name: string;
  parent_phone: string;
  parent_relation: string | null;
  parent2_name: string | null;
  parent2_phone: string | null;
  parent2_relation: string | null;
  notes: string | null;
  interested_courses: string | null;
  source: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: number | null;
  reviewed_at: string | null;
  student_id: number | null;
  parent_telegram_chat_id: string | null;
  created_at: string;
}

// ── Tokens ──────────────────────────────────────────────────────────

export async function createEnrollmentToken(
  createdBy: number,
  expiresInMinutes: number = 60
): Promise<EnrollmentToken> {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const result = await run(
    `INSERT INTO enrollment_tokens (token, expires_at, created_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [token, expiresAt.toISOString(), createdBy]
  );

  return result[0] as EnrollmentToken;
}

export async function getEnrollmentToken(token: string): Promise<EnrollmentToken | undefined> {
  return get<EnrollmentToken>(
    `SELECT * FROM enrollment_tokens WHERE token = $1`,
    [token]
  );
}

export async function getEnrollmentTokenById(id: number): Promise<EnrollmentToken | undefined> {
  return get<EnrollmentToken>(
    `SELECT * FROM enrollment_tokens WHERE id = $1`,
    [id]
  );
}

export async function validateToken(token: string): Promise<{ valid: boolean; reason?: string; tokenData?: EnrollmentToken }> {
  const tokenData = await getEnrollmentToken(token);

  if (!tokenData) {
    return { valid: false, reason: 'not_found' };
  }

  if (tokenData.used_at) {
    return { valid: false, reason: 'already_used' };
  }

  if (new Date(tokenData.expires_at) < new Date()) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, tokenData };
}

export async function markTokenUsed(tokenId: number): Promise<void> {
  await run(
    `UPDATE enrollment_tokens
     SET used_at = NOW(), manually_closed_at = NULL
     WHERE id = $1`,
    [tokenId]
  );
}

export async function closeEnrollmentToken(tokenId: number): Promise<void> {
  await run(
    `UPDATE enrollment_tokens
     SET used_at = NOW(), manually_closed_at = NOW()
     WHERE id = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [tokenId]
  );
}

export async function getActiveTokens(): Promise<EnrollmentToken[]> {
  return all<EnrollmentToken>(
    `SELECT * FROM enrollment_tokens
     WHERE used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`
  );
}

export async function getAllTokens(limit: number = 50): Promise<EnrollmentToken[]> {
  return all<EnrollmentToken>(
    `SELECT
       et.*,
       EXISTS(
         SELECT 1
         FROM enrollment_submissions es
         WHERE es.token_id = et.id
       ) AS has_submission
     FROM enrollment_tokens et
     ORDER BY et.created_at DESC
     LIMIT $1`,
    [limit]
  );
}

// ── Submissions ─────────────────────────────────────────────────────

export async function createSubmission(
  tokenId: number,
  data: {
    child_first_name: string;
    child_last_name: string;
    birth_date?: string;
    school?: string;
    email?: string;
    parent_name: string;
    parent_phone: string;
    parent_relation?: string;
    parent2_name?: string;
    parent2_phone?: string;
    parent2_relation?: string;
    notes?: string;
    interested_courses?: string;
    source?: string;
    parent_telegram_chat_id?: string | null;
  }
): Promise<EnrollmentSubmission> {
  const result = await run(
    `INSERT INTO enrollment_submissions
     (token_id, child_first_name, child_last_name, birth_date, school, email,
      parent_name, parent_phone, parent_relation,
      parent2_name, parent2_phone, parent2_relation, notes, interested_courses, source,
      parent_telegram_chat_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      tokenId,
      data.child_first_name,
      data.child_last_name,
      data.birth_date || null,
      data.school || null,
      data.email || null,
      data.parent_name,
      data.parent_phone,
      data.parent_relation || null,
      data.parent2_name || null,
      data.parent2_phone || null,
      data.parent2_relation || null,
      data.notes || null,
      data.interested_courses || null,
      data.source || null,
      data.parent_telegram_chat_id || null,
    ]
  );

  return result[0] as EnrollmentSubmission;
}

export async function getSubmissions(status?: string): Promise<EnrollmentSubmission[]> {
  if (status) {
    return all<EnrollmentSubmission>(
      `SELECT * FROM enrollment_submissions WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    );
  }
  return all<EnrollmentSubmission>(
    `SELECT * FROM enrollment_submissions ORDER BY created_at DESC`
  );
}

export async function getSubmissionById(id: number): Promise<EnrollmentSubmission | undefined> {
  return get<EnrollmentSubmission>(
    `SELECT * FROM enrollment_submissions WHERE id = $1`,
    [id]
  );
}

export async function updateSubmission(
  id: number,
  data: Partial<{
    child_first_name: string;
    child_last_name: string;
    birth_date: string | null;
    school: string | null;
    email: string | null;
    parent_name: string;
    parent_phone: string;
    parent_relation: string | null;
    parent2_name: string | null;
    parent2_phone: string | null;
    parent2_relation: string | null;
    notes: string | null;
    interested_courses: string | null;
    source: string | null;
    parent_telegram_chat_id: string | null;
  }>
): Promise<void> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    fields.push(`${key} = $${idx}`);
    params.push(value ?? null);
    idx++;
  }

  if (fields.length === 0) return;

  params.push(id);
  await run(
    `UPDATE enrollment_submissions SET ${fields.join(', ')} WHERE id = $${idx}`,
    params
  );
}

export async function approveSubmission(
  submissionId: number,
  reviewedBy: number,
  studentId: number
): Promise<void> {
  await run(
    `UPDATE enrollment_submissions
     SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), student_id = $2
     WHERE id = $3`,
    [reviewedBy, studentId, submissionId]
  );
}

export async function rejectSubmission(
  submissionId: number,
  reviewedBy: number
): Promise<void> {
  await run(
    `UPDATE enrollment_submissions
     SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW()
     WHERE id = $2`,
    [reviewedBy, submissionId]
  );
}
