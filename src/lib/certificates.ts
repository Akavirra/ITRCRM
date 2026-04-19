import { run, get, all } from '@/db';
import { generateUniquePublicId } from './public-id';

export type CertificateStatus = 'active' | 'used' | 'expired' | 'canceled';

export interface Certificate {
  id: number;
  public_id: string;
  amount: number;
  status: CertificateStatus;
  issued_at: string;
  used_at: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export async function getCertificates() {
  return await all<Certificate>(
    `SELECT c.*, u.name as creator_name 
     FROM certificates c 
     LEFT JOIN users u ON c.created_by = u.id 
     ORDER BY c.created_at DESC`
  );
}

export async function getCertificateByPublicId(publicId: string) {
  return await get<Certificate>(
    'SELECT * FROM certificates WHERE public_id = $1',
    [publicId]
  );
}

export async function createCertificate(data: {
  amount: number;
  notes?: string;
  created_by: number;
}) {
  const publicId = await generateUniquePublicId('certificate', async (id) => {
    const existing = await getCertificateByPublicId(id);
    return !existing;
  });

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
