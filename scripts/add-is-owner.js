require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT FALSE`;

  console.log('✓ Added is_owner column to users table');
  console.log('');
  console.log('To make yourself the owner, run:');
  console.log("  UPDATE users SET is_owner = true WHERE email = 'your@email.com';");
}

main().catch(console.error);
