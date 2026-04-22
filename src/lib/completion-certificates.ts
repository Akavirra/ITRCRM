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

export interface CompletionCertificateListParams {
  page?: number;
  limit?: number;
  search?: string;
  courseId?: number;
  groupId?: number;
}

export interface CompletionCertificateListResult {
  items: CompletionCertificateWithDetails[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getCompletionCertificates(
  params: CompletionCertificateListParams = {}
): Promise<CompletionCertificateListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const offset = (page - 1) * limit;
  const values: Array<string | number> = [];
  const where: string[] = [];

  if (params.search?.trim()) {
    values.push(`%${params.search.trim()}%`);
    const searchParam = `$${values.length}`;
    where.push(`(
      s.full_name ILIKE ${searchParam}
      OR c.title ILIKE ${searchParam}
      OR g.title ILIKE ${searchParam}
    )`);
  }

  if (typeof params.courseId === 'number' && !Number.isNaN(params.courseId)) {
    values.push(params.courseId);
    where.push(`cc.course_id = $${values.length}`);
  }

  if (typeof params.groupId === 'number' && !Number.isNaN(params.groupId)) {
    values.push(params.groupId);
    where.push(`cc.group_id = $${values.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRow = await get<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM completion_certificates cc
     LEFT JOIN students s ON cc.student_id = s.id
     LEFT JOIN courses c ON cc.course_id = c.id
     LEFT JOIN groups g ON cc.group_id = g.id
     ${whereClause}`,
    values
  );

  values.push(limit);
  const limitParam = `$${values.length}`;
  values.push(offset);
  const offsetParam = `$${values.length}`;

  const items = await all<CompletionCertificateWithDetails>(
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
     ${whereClause}
     ORDER BY cc.created_at DESC
     LIMIT ${limitParam}
     OFFSET ${offsetParam}`,
    values
  );

  const total = Number.parseInt(countRow?.count || '0', 10) || 0;

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
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
