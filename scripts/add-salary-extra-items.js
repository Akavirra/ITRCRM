require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS salary_extra_items (
      id         SERIAL PRIMARY KEY,
      teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      year       INTEGER NOT NULL,
      month      INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount     NUMERIC(10,2) NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS salary_extra_items_teacher_month
      ON salary_extra_items (teacher_id, year, month)
  `;

  console.log('salary_extra_items table created.');
}

main().catch(e => { console.error(e); process.exit(1); });
