import { run, get, all } from '@/db';

export interface CompletionCertificate {
  id: number;
  student_id: number;
  course_id: number | null;
  group_id: number | null;
  issue_date: string;
  gender: 'male' | 'female';
  template_url: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CompletionCertificateWithDetails extends CompletionCertificate {
  student_name: string;
  course_title: string | null;
  group_title: string | null;
  creator_name: string | null;
}

export async function getCompletionCertificates(): Promise<CompletionCertificateWithDetails[]> {
  return await all<CompletionCertificateWithDetails>(
    `SELECT cc.*,
            s.full_name as student_name,
            c.title as course_title,
            g.title as group_title,
            u.name as creator_name
     FROM completion_certificates cc
     LEFT JOIN students s ON cc.student_id = s.id
     LEFT JOIN courses c ON cc.course_id = c.id
     LEFT JOIN groups g ON cc.group_id = g.id
     LEFT JOIN users u ON cc.created_by = u.id
     ORDER BY cc.created_at DESC`
  );
}

export async function getCompletionCertificateById(id: number): Promise<CompletionCertificateWithDetails | undefined> {
  return await get<CompletionCertificateWithDetails>(
    `SELECT cc.*,
            s.full_name as student_name,
            c.title as course_title,
            g.title as group_title,
            u.name as creator_name
     FROM completion_certificates cc
     LEFT JOIN students s ON cc.student_id = s.id
     LEFT JOIN courses c ON cc.course_id = c.id
     LEFT JOIN groups g ON cc.group_id = g.id
     LEFT JOIN users u ON cc.created_by = u.id
     WHERE cc.id = $1`,
    [id]
  );
}

export async function createCompletionCertificate(data: {
  student_id: number;
  course_id?: number | null;
  group_id?: number | null;
  issue_date: string;
  gender: 'male' | 'female';
  created_by: number;
}) {
  const sql = `
    INSERT INTO completion_certificates (student_id, course_id, group_id, issue_date, gender, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  return await get<CompletionCertificate>(sql, [
    data.student_id,
    data.course_id || null,
    data.group_id || null,
    data.issue_date,
    data.gender,
    data.created_by,
  ]);
}

export async function deleteCompletionCertificate(id: number) {
  return await run('DELETE FROM completion_certificates WHERE id = $1', [id]);
}
