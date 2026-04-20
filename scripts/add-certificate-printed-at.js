require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('Adding printed_at to certificates...');
  await sql`ALTER TABLE certificates ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ`;
  console.log('Done.');
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
