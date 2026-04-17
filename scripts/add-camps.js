require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS camps (
      id SERIAL PRIMARY KEY,
      public_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      season TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      price_per_day_snapshot INTEGER,
      notes TEXT,
      is_archived BOOLEAN DEFAULT FALSE,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (end_date >= start_date)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_camps_start_date ON camps(start_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_camps_season ON camps(season)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_camps_active ON camps(is_archived) WHERE is_archived = FALSE`;

  await sql`
    CREATE TABLE IF NOT EXISTS camp_shifts (
      id SERIAL PRIMARY KEY,
      camp_id INTEGER NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      order_index INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (end_date >= start_date)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_camp_shifts_camp ON camp_shifts(camp_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_camp_shifts_dates ON camp_shifts(start_date, end_date)`;

  await sql`
    CREATE TABLE IF NOT EXISTS camp_shift_days (
      id SERIAL PRIMARY KEY,
      shift_id INTEGER NOT NULL REFERENCES camp_shifts(id) ON DELETE CASCADE,
      day_date DATE NOT NULL,
      is_working BOOLEAN DEFAULT TRUE,
      UNIQUE(shift_id, day_date)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_camp_shift_days_shift ON camp_shift_days(shift_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_camp_shift_days_date ON camp_shift_days(day_date)`;

  await sql`
    CREATE TABLE IF NOT EXISTS camp_participants (
      id SERIAL PRIMARY KEY,
      public_id TEXT UNIQUE NOT NULL,
      camp_id INTEGER NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
      shift_id INTEGER REFERENCES camp_shifts(id) ON DELETE SET NULL,
      student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      parent_name TEXT,
      parent_phone TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (status IN ('active', 'cancelled'))
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_camp_participants_camp ON camp_participants(camp_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_camp_participants_shift ON camp_participants(shift_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_camp_participants_student ON camp_participants(student_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_camp_participants_status ON camp_participants(status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS camp_participant_days (
      id SERIAL PRIMARY KEY,
      participant_id INTEGER NOT NULL REFERENCES camp_participants(id) ON DELETE CASCADE,
      day_date DATE NOT NULL,
      UNIQUE(participant_id, day_date)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_cpd_participant ON camp_participant_days(participant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cpd_date ON camp_participant_days(day_date)`;

  await sql`
    CREATE TABLE IF NOT EXISTS camp_payments (
      id SERIAL PRIMARY KEY,
      participant_id INTEGER NOT NULL REFERENCES camp_participants(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL,
      paid_at TIMESTAMPTZ DEFAULT NOW(),
      note TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (method IN ('cash', 'account'))
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_camp_payments_participant ON camp_payments(participant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_camp_payments_paid_at ON camp_payments(paid_at)`;

  // Seed default price per day
  await sql`
    INSERT INTO system_settings (key, value) VALUES
      ('camp_price_per_day', '500')
    ON CONFLICT (key) DO NOTHING
  `;

  console.log('Camps tables created and seeded.');
}

main().catch(e => { console.error(e); process.exit(1); });
