require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  // 1. Add lesson_price to system_settings
  await sql`
    INSERT INTO system_settings (key, value) VALUES ('lesson_price', '300')
    ON CONFLICT (key) DO NOTHING
  `;
  console.log('1. lesson_price added to system_settings');

  // 2. Convert students.discount from TEXT to INTEGER
  // First, update any existing text values to clean integers
  await sql`
    UPDATE students SET discount = NULL
    WHERE discount IS NOT NULL
    AND discount !~ '^\d+%?$'
  `;
  await sql`
    UPDATE students SET discount = REPLACE(discount, '%', '')
    WHERE discount IS NOT NULL AND discount LIKE '%\%%'
  `;
  // Now alter the column type
  await sql`
    ALTER TABLE students
    ALTER COLUMN discount TYPE INTEGER USING (
      CASE
        WHEN discount IS NULL THEN NULL
        WHEN discount ~ '^\d+$' THEN discount::INTEGER
        ELSE NULL
      END
    )
  `;
  await sql`
    ALTER TABLE students ALTER COLUMN discount SET DEFAULT 0
  `;
  console.log('2. students.discount converted to INTEGER');

  // 3. Create individual_balances table
  await sql`
    CREATE TABLE IF NOT EXISTS individual_balances (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      lessons_paid INTEGER NOT NULL DEFAULT 0,
      lessons_used INTEGER NOT NULL DEFAULT 0,
      UNIQUE(student_id)
    )
  `;
  console.log('3. individual_balances table created');

  // 4. Create individual_payments table
  await sql`
    CREATE TABLE IF NOT EXISTS individual_payments (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      lessons_count INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('cash', 'account')),
      paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      note TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_individual_payments_student
    ON individual_payments(student_id)
  `;
  console.log('4. individual_payments table created');

  console.log('\nPayment system v2 migration complete!');
}

main().catch(e => { console.error(e); process.exit(1); });
