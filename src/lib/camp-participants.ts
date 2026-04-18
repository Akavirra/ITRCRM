import { get, all, run } from '@/db';
import { generateUniquePublicId } from './public-id';
import { getCampPricePerDay } from './camps';

export interface CampParticipant {
  id: number;
  public_id: string;
  camp_id: number;
  shift_id: number | null;
  student_id: number | null;
  first_name: string;
  last_name: string;
  parent_name: string | null;
  parent_phone: string | null;
  notes: string | null;
  status: 'active' | 'cancelled';
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CampParticipantWithBilling extends CampParticipant {
  student_public_id: string | null;
  student_phone: string | null;
  student_parent_phone: string | null;
  selected_days: string[];
  days_count: number;
  total_expected: number;
  total_paid: number;
  balance: number; // positive = debt, negative = overpayment
  shift_title: string | null;
}

export async function listParticipants(campId: number, options: { shiftId?: number | null; includeCancelled?: boolean } = {}): Promise<CampParticipantWithBilling[]> {
  const price = await getCampPricePerDay();
  // Use camp snapshot if present
  const camp = await get<{ price_per_day_snapshot: number | null }>(
    `SELECT price_per_day_snapshot FROM camps WHERE id = $1`,
    [campId]
  );
  const effective = camp?.price_per_day_snapshot ?? price;

  const filters: string[] = [`cp.camp_id = $1`];
  const params: unknown[] = [campId];
  let i = 2;

  if (!options.includeCancelled) {
    filters.push(`cp.status = 'active'`);
  }
  if (options.shiftId !== undefined) {
    if (options.shiftId === null) {
      filters.push(`cp.shift_id IS NULL`);
    } else {
      filters.push(`cp.shift_id = $${i++}`);
      params.push(options.shiftId);
    }
  }

  const rows = await all<any>(
    `SELECT
       cp.*,
       s.public_id AS student_public_id,
       s.phone AS student_phone,
       s.parent_phone AS student_parent_phone,
       cs.title AS shift_title,
       COALESCE((
         SELECT array_agg(cpd.day_date::text ORDER BY cpd.day_date)
         FROM camp_participant_days cpd WHERE cpd.participant_id = cp.id
       ), ARRAY[]::text[]) AS selected_days,
       COALESCE((
         SELECT COUNT(*) FROM camp_participant_days cpd WHERE cpd.participant_id = cp.id
       ), 0)::int AS days_count,
       COALESCE((
         SELECT SUM(p.amount) FROM camp_payments p WHERE p.participant_id = cp.id
       ), 0)::int AS total_paid
     FROM camp_participants cp
     LEFT JOIN students s ON s.id = cp.student_id
     LEFT JOIN camp_shifts cs ON cs.id = cp.shift_id
     WHERE ${filters.join(' AND ')}
     ORDER BY cp.created_at ASC, cp.id ASC`,
    params
  );

  return rows.map((r: any) => {
    const total_expected = r.days_count * effective;
    return {
      ...r,
      selected_days: r.selected_days ?? [],
      total_expected,
      balance: total_expected - r.total_paid,
    } as CampParticipantWithBilling;
  });
}

export async function getParticipantById(id: number): Promise<CampParticipantWithBilling | null> {
  const price = await getCampPricePerDay();
  const row = await get<any>(
    `SELECT
       cp.*,
       s.public_id AS student_public_id,
       s.phone AS student_phone,
       s.parent_phone AS student_parent_phone,
       cs.title AS shift_title,
       c.price_per_day_snapshot AS camp_price_snapshot,
       COALESCE((
         SELECT array_agg(cpd.day_date::text ORDER BY cpd.day_date)
         FROM camp_participant_days cpd WHERE cpd.participant_id = cp.id
       ), ARRAY[]::text[]) AS selected_days,
       COALESCE((
         SELECT COUNT(*) FROM camp_participant_days cpd WHERE cpd.participant_id = cp.id
       ), 0)::int AS days_count,
       COALESCE((
         SELECT SUM(p.amount) FROM camp_payments p WHERE p.participant_id = cp.id
       ), 0)::int AS total_paid
     FROM camp_participants cp
     LEFT JOIN students s ON s.id = cp.student_id
     LEFT JOIN camp_shifts cs ON cs.id = cp.shift_id
     LEFT JOIN camps c ON c.id = cp.camp_id
     WHERE cp.id = $1`,
    [id]
  );
  if (!row) return null;
  const effective = row.camp_price_snapshot ?? price;
  const total_expected = row.days_count * effective;
  return {
    ...row,
    selected_days: row.selected_days ?? [],
    total_expected,
    balance: total_expected - row.total_paid,
  } as CampParticipantWithBilling;
}

export async function createParticipant(input: {
  camp_id: number;
  shift_id?: number | null;
  student_id?: number | null;
  first_name: string;
  last_name: string;
  parent_name?: string | null;
  parent_phone?: string | null;
  notes?: string | null;
  created_by: number;
  /** Дати, обрані учасником. Якщо shift_id вказано і дні не передані — нічого не додається (адмін обере потім). */
  days?: string[];
}): Promise<CampParticipant> {
  const publicId = await generateUniquePublicId('campParticipant', async (id) => {
    const existing = await get<{ id: number }>(`SELECT id FROM camp_participants WHERE public_id = $1`, [id]);
    return !existing;
  });

  // If student_id provided — snapshot names from students table if not explicit
  let firstName = input.first_name.trim();
  let lastName = input.last_name.trim();
  let parentName = input.parent_name ?? null;
  let parentPhone = input.parent_phone ?? null;

  if (input.student_id) {
    const st = await get<{ full_name: string; parent_name: string | null; parent_phone: string | null }>(
      `SELECT full_name, parent_name, parent_phone FROM students WHERE id = $1`,
      [input.student_id]
    );
    if (st) {
      if (!firstName && !lastName) {
        // Split full_name "Прізвище Ім'я" into last/first (heuristic)
        const parts = st.full_name.trim().split(/\s+/);
        if (parts.length >= 2) {
          lastName = parts[0];
          firstName = parts.slice(1).join(' ');
        } else {
          firstName = st.full_name;
        }
      }
      if (!parentName) parentName = st.parent_name;
      if (!parentPhone) parentPhone = st.parent_phone;
    }
  }

  const rows = await run(
    `INSERT INTO camp_participants (public_id, camp_id, shift_id, student_id, first_name, last_name, parent_name, parent_phone, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      publicId,
      input.camp_id,
      input.shift_id ?? null,
      input.student_id ?? null,
      firstName,
      lastName,
      parentName,
      parentPhone,
      input.notes ?? null,
      input.created_by,
    ]
  );
  const participant = rows[0] as CampParticipant;

  if (input.days && input.days.length > 0) {
    await setParticipantDays(participant.id, input.days);
  }

  return participant;
}

export async function updateParticipant(id: number, patch: {
  shift_id?: number | null;
  first_name?: string;
  last_name?: string;
  parent_name?: string | null;
  parent_phone?: string | null;
  notes?: string | null;
  status?: 'active' | 'cancelled';
  student_id?: number | null;
}): Promise<CampParticipant | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (patch.shift_id !== undefined) { fields.push(`shift_id = $${i++}`); params.push(patch.shift_id); }
  if (patch.first_name !== undefined) { fields.push(`first_name = $${i++}`); params.push(patch.first_name); }
  if (patch.last_name !== undefined) { fields.push(`last_name = $${i++}`); params.push(patch.last_name); }
  if (patch.parent_name !== undefined) { fields.push(`parent_name = $${i++}`); params.push(patch.parent_name); }
  if (patch.parent_phone !== undefined) { fields.push(`parent_phone = $${i++}`); params.push(patch.parent_phone); }
  if (patch.notes !== undefined) { fields.push(`notes = $${i++}`); params.push(patch.notes); }
  if (patch.status !== undefined) { fields.push(`status = $${i++}`); params.push(patch.status); }
  if (patch.student_id !== undefined) { fields.push(`student_id = $${i++}`); params.push(patch.student_id); }

  if (fields.length === 0) {
    const row = await get<CampParticipant>(`SELECT * FROM camp_participants WHERE id = $1`, [id]);
    return row ?? null;
  }

  fields.push(`updated_at = NOW()`);
  params.push(id);
  const rows = await run(
    `UPDATE camp_participants SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    params
  );
  return (rows[0] as CampParticipant) ?? null;
}

export async function deleteParticipant(id: number): Promise<void> {
  // Soft delete if has payments
  const p = await get<{ count: string }>(`SELECT COUNT(*)::text AS count FROM camp_payments WHERE participant_id = $1`, [id]);
  if (p && parseInt(p.count, 10) > 0) {
    await run(
      `UPDATE camp_participants SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    return;
  }
  await run(`DELETE FROM camp_participants WHERE id = $1`, [id]);
}

export async function setParticipantDays(participantId: number, dates: string[]): Promise<string[]> {
  // Replace the whole set
  await run(`DELETE FROM camp_participant_days WHERE participant_id = $1`, [participantId]);
  const unique = Array.from(new Set(dates));
  if (unique.length === 0) return [];

  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  for (const d of unique) {
    values.push(`($${p++}, $${p++})`);
    params.push(participantId, d);
  }
  await run(
    `INSERT INTO camp_participant_days (participant_id, day_date) VALUES ${values.join(', ')}
     ON CONFLICT (participant_id, day_date) DO NOTHING`,
    params
  );

  const rows = await all<{ day_date: string }>(
    `SELECT day_date::text AS day_date FROM camp_participant_days WHERE participant_id = $1 ORDER BY day_date ASC`,
    [participantId]
  );
  return rows.map(r => r.day_date);
}

export async function convertParticipantToStudent(participantId: number, actorUserId: number): Promise<{ student_id: number; already_existed: boolean }> {
  const p = await get<CampParticipant>(`SELECT * FROM camp_participants WHERE id = $1`, [participantId]);
  if (!p) throw new Error('Participant not found');

  if (p.student_id) {
    return { student_id: p.student_id, already_existed: true };
  }

  // Build full_name as "Прізвище Ім'я" для сумісності з базою
  const fullName = [p.last_name, p.first_name].filter(Boolean).join(' ').trim() || p.first_name;

  const publicId = await generateUniquePublicId('student', async (id) => {
    const existing = await get<{ id: number }>(`SELECT id FROM students WHERE public_id = $1`, [id]);
    return !existing;
  });

  const rows = await run(
    `INSERT INTO students (public_id, full_name, parent_name, parent_phone, notes, is_active, source)
     VALUES ($1, $2, $3, $4, $5, TRUE, 'camp')
     RETURNING id`,
    [publicId, fullName, p.parent_name, p.parent_phone, p.notes]
  );
  const studentId = (rows[0] as { id: number }).id;

  await run(
    `UPDATE camp_participants SET student_id = $1, updated_at = NOW() WHERE id = $2`,
    [studentId, participantId]
  );

  return { student_id: studentId, already_existed: false };
}

/**
 * Для автокомпліту: активні учні, НЕ додані як учасники цього табору.
 */
export async function searchAvailableStudentsForCamp(campId: number, search: string, limit = 20): Promise<Array<{ id: number; public_id: string; full_name: string; phone: string | null; parent_phone: string | null }>> {
  const q = `%${search.trim().toLowerCase()}%`;
  const rows = await all<{ id: number; public_id: string; full_name: string; phone: string | null; parent_phone: string | null }>(
    `SELECT s.id, s.public_id, s.full_name, s.phone, s.parent_phone
     FROM students s
     WHERE s.is_active = TRUE
       AND (LOWER(s.full_name) LIKE $1 OR s.phone LIKE $1 OR s.parent_phone LIKE $1)
       AND NOT EXISTS (
         SELECT 1 FROM camp_participants cp
         WHERE cp.camp_id = $2 AND cp.student_id = s.id AND cp.status = 'active'
       )
     ORDER BY s.full_name ASC
     LIMIT $3`,
    [q, campId, limit]
  );
  return rows;
}
