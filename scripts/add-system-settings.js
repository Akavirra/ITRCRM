require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Seed default values (INSERT IF NOT EXISTS)
  await sql`
    INSERT INTO system_settings (key, value) VALUES
      ('teacher_salary_group', '75'),
      ('teacher_salary_individual', '100')
    ON CONFLICT (key) DO NOTHING
  `;

  console.log('system_settings table created and seeded.');
}

main().catch(e => { console.error(e); process.exit(1); });
