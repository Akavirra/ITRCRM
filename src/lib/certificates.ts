import { run, get, all } from '@/db';

export type CertificateStatus = 'active' | 'used' | 'expired' | 'canceled';

export interface Certificate {
  id: number;
  public_id: string;
  amount: number;
  status: CertificateStatus;
  issued_at: string;
  used_at: string | null;
  printed_at: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CertificateListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CertificateStatus | 'printed' | 'unprinted';
}

export interface CertificateListResult {
  items: Certificate[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getCertificates(params: CertificateListParams = {}): Promise<CertificateListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const offset = (page - 1) * limit;
  const values: Array<string | number | boolean> = [];
  const where: string[] = [];

  if (params.search?.trim()) {
    values.push(`%${params.search.trim()}%`);
    where.push(`c.public_id ILIKE $${values.length}`);
  }

  if (params.status === 'printed') {
    where.push('c.printed_at IS NOT NULL');
  } else if (params.status === 'unprinted') {
    where.push('c.printed_at IS NULL');
  } else if (params.status) {
    values.push(params.status);
    where.push(`c.status = $${values.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countRow = await get<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM certificates c
     ${whereClause}`,
    values
  );

  values.push(limit);
  const limitParam = `$${values.length}`;
  values.push(offset);
  const offsetParam = `$${values.length}`;

  const items = await all<Certificate>(
    `SELECT c.*, u.name as creator_name 
     FROM certificates c 
     LEFT JOIN users u ON c.created_by = u.id
     ${whereClause}
     ORDER BY c.created_at DESC
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

export async function getCertificateByPublicId(publicId: string) {
  return await get<Certificate>(
    'SELECT * FROM certificates WHERE public_id = $1',
    [publicId]
  );
}

export async function getNextPublicId(): Promise<string> {
  const lastCert = await get<Certificate>(
    "SELECT public_id FROM certificates WHERE public_id LIKE 'ID:%' ORDER BY id DESC LIMIT 1"
  );

  let nextId = 85331; // Starting ID
  if (lastCert) {
    const lastIdNum = parseInt(lastCert.public_id.replace('ID:', ''), 10);
    if (!isNaN(lastIdNum)) {
      nextId = lastIdNum + 1;
    }
  }

  return `ID:${nextId}`;
}

export async function createCertificate(data: {
  amount: number;
  notes?: string;
  created_by: number;
}) {
  const publicId = await getNextPublicId();

  const sql = `
    INSERT INTO certificates (public_id, amount, notes, created_by)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

  return await get<Certificate>(sql, [
    publicId,
    data.amount,
    data.notes || null,
    data.created_by
  ]);
}

export async function updateCertificateStatus(id: number, status: CertificateStatus) {
  const usedAt = status === 'used' ? new Date().toISOString() : null;
  const sql = `
    UPDATE certificates 
    SET status = $1, used_at = $2, updated_at = NOW() 
    WHERE id = $3 
    RETURNING *
  `;
  return await get<Certificate>(sql, [status, usedAt, id]);
}

export async function deleteCertificate(id: number) {
  return await run('DELETE FROM certificates WHERE id = $1', [id]);
}
