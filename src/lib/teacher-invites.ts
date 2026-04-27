import { run, get, all } from '@/db';
import { v4 as uuidv4 } from 'uuid';

export interface TeacherInviteToken {
  id: number;
  token: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired';
  created_by: number;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  teacher_name: string | null;
  teacher_email: string | null;
  teacher_phone: string | null;
  telegram_id: string | null;
  telegram_username: string | null;
  notes: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
}

export interface TeacherInviteSubmission {
  teacher_name: string;
  teacher_email: string;
  teacher_phone?: string;
  telegram_id: string;
  telegram_username?: string;
  notes?: string;
}

const DEFAULT_EXPIRES_MINUTES = 60;
const STALE_TOKEN_CLEANUP_DAYS = 30;

export async function createTeacherInviteToken(
  createdBy: number,
  expiresInMinutes: number = DEFAULT_EXPIRES_MINUTES
): Promise<TeacherInviteToken> {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const result = await run(
    `INSERT INTO teacher_invite_tokens (token, expires_at, created_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [token, expiresAt.toISOString(), createdBy]
  );

  return result[0] as TeacherInviteToken;
}

export async function getTeacherInviteToken(token: string): Promise<TeacherInviteToken | undefined> {
  return get<TeacherInviteToken>(
    `SELECT * FROM teacher_invite_tokens WHERE token = $1`,
    [token]
  );
}

export async function getTeacherInviteTokenById(id: number): Promise<TeacherInviteToken | undefined> {
  return get<TeacherInviteToken>(
    `SELECT * FROM teacher_invite_tokens WHERE id = $1`,
    [id]
  );
}

export async function validateTeacherInviteToken(
  token: string
): Promise<{ valid: boolean; reason?: string; tokenData?: TeacherInviteToken }> {
  const tokenData = await getTeacherInviteToken(token);

  if (!tokenData) {
    return { valid: false, reason: 'not_found' };
  }

  if (tokenData.status !== 'pending') {
    if (tokenData.status === 'submitted') return { valid: false, reason: 'already_used' };
    if (tokenData.status === 'approved') return { valid: false, reason: 'already_approved' };
    if (tokenData.status === 'rejected') return { valid: false, reason: 'already_rejected' };
    return { valid: false, reason: 'already_used' };
  }

  if (new Date(tokenData.expires_at) < new Date()) {
    await run(
      `UPDATE teacher_invite_tokens SET status = 'expired' WHERE id = $1`,
      [tokenData.id]
    );
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, tokenData };
}

export async function submitTeacherInvite(
  tokenId: number,
  data: TeacherInviteSubmission
): Promise<void> {
  await run(
    `UPDATE teacher_invite_tokens
     SET status = 'submitted',
         used_at = NOW(),
         teacher_name = $1,
         teacher_email = $2,
         teacher_phone = $3,
         telegram_id = $4,
         telegram_username = $5,
         notes = $6
     WHERE id = $7`,
    [
      data.teacher_name,
      data.teacher_email,
      data.teacher_phone || null,
      data.telegram_id,
      data.telegram_username || null,
      data.notes || null,
      tokenId,
    ]
  );
}

export async function approveTeacherInvite(
  tokenId: number,
  reviewedBy: number
): Promise<TeacherInviteToken> {
  const result = await run(
    `UPDATE teacher_invite_tokens
     SET status = 'approved',
         reviewed_by = $1,
         reviewed_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [reviewedBy, tokenId]
  );
  return result[0] as TeacherInviteToken;
}

export async function rejectTeacherInvite(
  tokenId: number,
  reviewedBy: number
): Promise<void> {
  await run(
    `UPDATE teacher_invite_tokens
     SET status = 'rejected',
         reviewed_by = $1,
         reviewed_at = NOW()
     WHERE id = $2`,
    [reviewedBy, tokenId]
  );
}

export async function getAllTeacherInviteTokens(limit: number = 50): Promise<TeacherInviteToken[]> {
  // Auto-cleanup: remove tokens that are expired/rejected/approved older than STALE_TOKEN_CLEANUP_DAYS
  // (pending tokens that already passed expires_at also get marked, then deleted by this same query).
  await run(
    `DELETE FROM teacher_invite_tokens
     WHERE (status IN ('expired', 'rejected', 'approved') AND created_at < NOW() - INTERVAL '${STALE_TOKEN_CLEANUP_DAYS} days')
        OR (status = 'pending' AND expires_at < NOW() - INTERVAL '${STALE_TOKEN_CLEANUP_DAYS} days')`
  );

  return all<TeacherInviteToken>(
    `SELECT * FROM teacher_invite_tokens
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
}

export async function deleteTeacherInviteToken(id: number): Promise<void> {
  await run(
    `DELETE FROM teacher_invite_tokens WHERE id = $1`,
    [id]
  );
}
