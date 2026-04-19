require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('Adding avatar_seed column to users table...');
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_seed TEXT`;
  
  // Backfill existing users with a seed based on their email if they don't have one
  // This ensures they have a consistent avatar immediately
  console.log('Backfilling avatar_seed for existing users...');
  await sql`UPDATE users SET avatar_seed = substring(md5(email), 1, 10) WHERE avatar_seed IS NULL`;

  console.log('✓ Success: avatar_seed column added and backfilled.');
}

main().catch(console.error);
