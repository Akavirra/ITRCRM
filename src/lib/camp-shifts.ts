import { get, all, run } from '@/db';

export interface CampShift {
  id: number;
  camp_id: number;
  title: string;
  start_date: string;
  end_date: string;
  order_index: number;
  notes: string | null;
  created_at: string;
}

export interface CampShiftDay {
  id: number;
  shift_id: number;
  day_date: string;
  is_working: boolean;
}

export interface CampShiftWithDays extends CampShift {
  days: CampShiftDay[];
  working_days_count: number;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diffDays(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00Z').getTime();
  const b = new Date(to + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

function weekdayIndex(dateStr: string): number {
  // 0=Sun..6=Sat
  return new Date(dateStr + 'T00:00:00Z').getUTCDay();
}

function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  const count = diffDays(start, end);
  for (let i = 0; i <= count; i++) out.push(addDays(start, i));
  return out;
}

export async function listShifts(campId: number): Promise<CampShiftWithDays[]> {
  const shifts = await all<CampShift>(
    `SELECT * FROM camp_shifts WHERE camp_id = $1 ORDER BY order_index ASC, start_date ASC, id ASC`,
    [campId]
  );
  if (shifts.length === 0) return [];

  const ids = shifts.map(s => s.id);
  const days = await all<CampShiftDay>(
    `SELECT id, shift_id, day_date::text AS day_date, is_working
     FROM camp_shift_days
     WHERE shift_id = ANY($1::int[])
     ORDER BY day_date ASC`,
    [ids]
  );

  return shifts.map(s => {
    const myDays = days.filter(d => d.shift_id === s.id);
    return {
      ...s,
      days: myDays,
      working_days_count: myDays.filter(d => d.is_working).length,
    };
  });
}

export async function getShiftById(shiftId: number): Promise<CampShiftWithDays | null> {
  const s = await get<CampShift>(`SELECT * FROM camp_shifts WHERE id = $1`, [shiftId]);
  if (!s) return null;
  const days = await all<CampShiftDay>(
    `SELECT id, shift_id, day_date::text AS day_date, is_working
     FROM camp_shift_days
     WHERE shift_id = $1
     ORDER BY day_date ASC`,
    [shiftId]
  );
  return { ...s, days, working_days_count: days.filter(d => d.is_working).length };
}

export async function createShift(input: {
  camp_id: number;
  title?: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  order_index?: number;
  /** Якщо true — Sub/Sun позначаються як вихідні автоматично. За замовч. true. */
  autoSkipWeekends?: boolean;
}): Promise<CampShiftWithDays> {
  // Next order_index if not provided
  let order = input.order_index;
  if (order === undefined) {
    const last = await get<{ max: number | null }>(
      `SELECT MAX(order_index) AS max FROM camp_shifts WHERE camp_id = $1`,
      [input.camp_id]
    );
    order = (last?.max ?? -1) + 1;
  }

  const title = input.title?.trim() || `Зміна ${order + 1}`;
  const autoSkip = input.autoSkipWeekends !== false;

  const shiftRows = await run(
    `INSERT INTO camp_shifts (camp_id, title, start_date, end_date, order_index, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.camp_id, title, input.start_date, input.end_date, order, input.notes ?? null]
  );
  const shift = shiftRows[0] as CampShift;

  // Generate days
  const dates = enumerateDates(input.start_date, input.end_date);
  if (dates.length > 0) {
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const d of dates) {
      const wd = weekdayIndex(d); // 0=Sun..6=Sat
      const isWorking = autoSkip ? (wd !== 0 && wd !== 6) : true;
      values.push(`($${p++}, $${p++}, $${p++})`);
      params.push(shift.id, d, isWorking);
    }
    await run(
      `INSERT INTO camp_shift_days (shift_id, day_date, is_working) VALUES ${values.join(', ')}`,
      params
    );
  }

  const full = await getShiftById(shift.id);
  return full!;
}

export async function updateShift(shiftId: number, patch: {
  title?: string;
  start_date?: string;
  end_date?: string;
  notes?: string | null;
  order_index?: number;
}): Promise<CampShiftWithDays | null> {
  const existing = await getShiftById(shiftId);
  if (!existing) return null;

  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (patch.title !== undefined) { fields.push(`title = $${i++}`); params.push(patch.title); }
  if (patch.start_date !== undefined) { fields.push(`start_date = $${i++}`); params.push(patch.start_date); }
  if (patch.end_date !== undefined) { fields.push(`end_date = $${i++}`); params.push(patch.end_date); }
  if (patch.notes !== undefined) { fields.push(`notes = $${i++}`); params.push(patch.notes); }
  if (patch.order_index !== undefined) { fields.push(`order_index = $${i++}`); params.push(patch.order_index); }

  if (fields.length > 0) {
    params.push(shiftId);
    await run(
      `UPDATE camp_shifts SET ${fields.join(', ')} WHERE id = $${i}`,
      params
    );
  }

  // If dates changed — rebuild missing days, keep existing is_working flags and participant selections intact.
  const newStart = patch.start_date ?? existing.start_date;
  const newEnd = patch.end_date ?? existing.end_date;
  if (patch.start_date !== undefined || patch.end_date !== undefined) {
    const wanted = new Set(enumerateDates(newStart, newEnd));
    const current = new Set(existing.days.map(d => d.day_date));

    // Delete days that are no longer in range
    const toDelete: string[] = existing.days.filter(d => !wanted.has(d.day_date)).map(d => d.day_date);
    if (toDelete.length > 0) {
      await run(
        `DELETE FROM camp_shift_days WHERE shift_id = $1 AND day_date = ANY($2::date[])`,
        [shiftId, toDelete]
      );
    }

    // Insert new days
    const toAdd = Array.from(wanted).filter(d => !current.has(d));
    if (toAdd.length > 0) {
      const values: string[] = [];
      const params2: unknown[] = [];
      let p = 1;
      for (const d of toAdd) {
        const wd = weekdayIndex(d);
        const isWorking = wd !== 0 && wd !== 6;
        values.push(`($${p++}, $${p++}, $${p++})`);
        params2.push(shiftId, d, isWorking);
      }
      await run(
        `INSERT INTO camp_shift_days (shift_id, day_date, is_working) VALUES ${values.join(', ')}
         ON CONFLICT (shift_id, day_date) DO NOTHING`,
        params2
      );
    }
  }

  return getShiftById(shiftId);
}

export async function deleteShift(shiftId: number): Promise<void> {
  await run(`DELETE FROM camp_shifts WHERE id = $1`, [shiftId]);
}

export async function toggleShiftDay(shiftId: number, dayDate: string): Promise<CampShiftDay | null> {
  const day = await get<CampShiftDay>(
    `SELECT id, shift_id, day_date::text AS day_date, is_working
     FROM camp_shift_days WHERE shift_id = $1 AND day_date = $2`,
    [shiftId, dayDate]
  );
  if (!day) return null;
  const rows = await run(
    `UPDATE camp_shift_days SET is_working = NOT is_working
     WHERE id = $1
     RETURNING id, shift_id, day_date::text AS day_date, is_working`,
    [day.id]
  );
  return (rows[0] as CampShiftDay) ?? null;
}

export async function setShiftDayWorking(shiftId: number, dayDate: string, isWorking: boolean): Promise<CampShiftDay | null> {
  const rows = await run(
    `UPDATE camp_shift_days SET is_working = $3
     WHERE shift_id = $1 AND day_date = $2
     RETURNING id, shift_id, day_date::text AS day_date, is_working`,
    [shiftId, dayDate, isWorking]
  );
  return (rows[0] as CampShiftDay) ?? null;
}

/**
 * Duplicate a shift, shifting dates by `offsetDays`. Default: place right after existing shift.
 */
export async function duplicateShift(shiftId: number, opts: { offsetDays?: number; newTitle?: string } = {}): Promise<CampShiftWithDays | null> {
  const src = await getShiftById(shiftId);
  if (!src) return null;

  const span = diffDays(src.start_date, src.end_date) + 1;
  const offset = opts.offsetDays ?? span;

  const newStart = addDays(src.start_date, offset);
  const newEnd = addDays(src.end_date, offset);

  // Increment order_index
  const last = await get<{ max: number | null }>(
    `SELECT MAX(order_index) AS max FROM camp_shifts WHERE camp_id = $1`,
    [src.camp_id]
  );
  const newOrder = (last?.max ?? -1) + 1;

  const newTitle = opts.newTitle ?? `${src.title} (копія)`;

  const rows = await run(
    `INSERT INTO camp_shifts (camp_id, title, start_date, end_date, order_index, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [src.camp_id, newTitle, newStart, newEnd, newOrder, src.notes]
  );
  const dup = rows[0] as CampShift;

  // Copy days with shifted date + preserve is_working flags
  if (src.days.length > 0) {
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const d of src.days) {
      const shifted = addDays(d.day_date, offset);
      values.push(`($${p++}, $${p++}, $${p++})`);
      params.push(dup.id, shifted, d.is_working);
    }
    await run(
      `INSERT INTO camp_shift_days (shift_id, day_date, is_working) VALUES ${values.join(', ')}`,
      params
    );
  }

  return getShiftById(dup.id);
}
