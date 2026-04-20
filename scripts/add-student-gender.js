require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('Adding gender to students...');
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'))`;
  console.log('Done.');
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
