require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('Creating certificates table...');

  await sql`
    CREATE TABLE IF NOT EXISTS certificates (
      id SERIAL PRIMARY KEY,
      public_id TEXT UNIQUE NOT NULL,
      amount INTEGER NOT NULL DEFAULT 1000,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'canceled')),
      issued_at TIMESTAMPTZ DEFAULT NOW(),
      used_at TIMESTAMPTZ,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_certificates_public_id ON certificates(public_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status)`;

  console.log('certificates table created successfully.');
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
