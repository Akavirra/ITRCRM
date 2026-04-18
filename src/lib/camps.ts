import { get, all, run } from '@/db';
import { generateUniquePublicId } from './public-id';

export type CampSeason = 'winter' | 'spring' | 'summer' | 'autumn';

export interface Camp {
  id: number;
  public_id: string;
  title: string;
  season: CampSeason;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  price_per_day_snapshot: number | null;
  notes: string | null;
  is_archived: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CampWithStats extends Camp {
  shifts_count: number;
  participants_count: number;
  total_expected: number;
  total_paid: number;
  total_debt: number;
  effective_price_per_day: number;
}

const SEASON_TITLES: Record<CampSeason, string> = {
  winter: 'Зимовий науково-розважальний IT-табір',
  spring: 'Весняний науково-розважальний IT-табір',
  summer: 'Літній науково-розважальний IT-табір',
  autumn: 'Осінній науково-розважальний IT-табір',
};

export function getSeasonFromDate(dateStr: string): CampSeason {
  const month = new Date(dateStr).getMonth() + 1; // 1-12
  if (month === 12 || month === 1 || month === 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'autumn';
}

export function generateCampTitle(startDate: string): string {
  return SEASON_TITLES[getSeasonFromDate(startDate)];
}

export async function getCampPricePerDay(): Promise<number> {
  const row = await get<{ value: string }>(
    `SELECT value FROM system_settings WHERE key = 'camp_price_per_day'`
  );
  return parseInt(row?.value || '500', 10);
}

export function getEffectivePricePerDay(camp: Pick<Camp, 'price_per_day_snapshot'>, globalPrice: number): number {
  return camp.price_per_day_snapshot ?? globalPrice;
}

export async function listCamps(options: { includeArchived?: boolean } = {}): Promise<Camp[]> {
  const where = options.includeArchived ? '' : 'WHERE is_archived = FALSE';
  return all<Camp>(
    `SELECT * FROM camps ${where} ORDER BY start_date DESC, id DESC`
  );
}

export async function listCampsWithStats(options: { includeArchived?: boolean } = {}): Promise<CampWithStats[]> {
  const globalPrice = await getCampPricePerDay();
  const where = options.includeArchived ? '' : 'WHERE c.is_archived = FALSE';

  const rows = await all<CampWithStats & { price_per_day_snapshot: number | null }>(
    `SELECT
       c.*,
       COALESCE((SELECT COUNT(*) FROM camp_shifts cs WHERE cs.camp_id = c.id), 0)::int AS shifts_count,
       COALESCE((SELECT COUNT(*) FROM camp_participants cp WHERE cp.camp_id = c.id AND cp.status = 'active'), 0)::int AS participants_count,
       COALESCE((
         SELECT SUM(
           (SELECT COUNT(*) FROM camp_participant_days cpd WHERE cpd.participant_id = cp.id)
           * COALESCE(c.price_per_day_snapshot, $1)
         )
         FROM camp_participants cp
         WHERE cp.camp_id = c.id AND cp.status = 'active'
       ), 0)::int AS total_expected,
       COALESCE((
         SELECT SUM(p.amount)
         FROM camp_payments p
         JOIN camp_participants cp ON cp.id = p.participant_id
         WHERE cp.camp_id = c.id AND cp.status = 'active'
       ), 0)::int AS total_paid
     FROM camps c
     ${where}
     ORDER BY c.start_date DESC, c.id DESC`,
    [globalPrice]
  );

  return rows.map(r => ({
    ...r,
    total_debt: Math.max(0, r.total_expected - r.total_paid),
    effective_price_per_day: r.price_per_day_snapshot ?? globalPrice,
  }));
}

export async function getCampById(id: number): Promise<Camp | null> {
  const row = await get<Camp>(`SELECT * FROM camps WHERE id = $1`, [id]);
  return row ?? null;
}

export async function createCamp(input: {
  start_date: string;
  end_date: string;
  title?: string;
  notes?: string | null;
  price_per_day_snapshot?: number | null;
  created_by: number;
}): Promise<Camp> {
  const season = getSeasonFromDate(input.start_date);
  const title = input.title && input.title.trim() !== ''
    ? input.title.trim()
    : generateCampTitle(input.start_date);

  const publicId = await generateUniquePublicId('camp', async (id) => {
    const existing = await get<{ id: number }>(`SELECT id FROM camps WHERE public_id = $1`, [id]);
    return !existing;
  });

  const rows = await run(
    `INSERT INTO camps (public_id, title, season, start_date, end_date, price_per_day_snapshot, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      publicId,
      title,
      season,
      input.start_date,
      input.end_date,
      input.price_per_day_snapshot ?? null,
      input.notes ?? null,
      input.created_by,
    ]
  );
  return rows[0] as Camp;
}

export async function updateCamp(id: number, patch: {
  title?: string;
  start_date?: string;
  end_date?: string;
  price_per_day_snapshot?: number | null;
  notes?: string | null;
  is_archived?: boolean;
}): Promise<Camp | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (patch.title !== undefined) { fields.push(`title = $${i++}`); params.push(patch.title); }
  if (patch.start_date !== undefined) {
    fields.push(`start_date = $${i++}`);
    params.push(patch.start_date);
    // also refresh season
    fields.push(`season = $${i++}`);
    params.push(getSeasonFromDate(patch.start_date));
  }
  if (patch.end_date !== undefined) { fields.push(`end_date = $${i++}`); params.push(patch.end_date); }
  if (patch.price_per_day_snapshot !== undefined) {
    fields.push(`price_per_day_snapshot = $${i++}`);
    params.push(patch.price_per_day_snapshot);
  }
  if (patch.notes !== undefined) { fields.push(`notes = $${i++}`); params.push(patch.notes); }
  if (patch.is_archived !== undefined) { fields.push(`is_archived = $${i++}`); params.push(patch.is_archived); }

  if (fields.length === 0) return getCampById(id);

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const rows = await run(
    `UPDATE camps SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    params
  );
  return (rows[0] as Camp) ?? null;
}

export async function deleteCamp(id: number): Promise<void> {
  await run(`DELETE FROM camps WHERE id = $1`, [id]);
}
