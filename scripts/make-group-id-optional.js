// Script to make group_id nullable in lessons table for individual lessons
// Run with: node scripts/make-group-id-optional.js

const { neon } = require('@neondatabase/serverless');

// Load .env.local
const fs = require('fs');
const path = require('path');
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  }
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  const sql = neon(DATABASE_URL);
  
  console.log('🔄 Making group_id nullable in lessons table...');
  
  // Make group_id nullable
  try {
    await sql`ALTER TABLE lessons ALTER COLUMN group_id DROP NOT NULL`;
    console.log('✅ group_id is now nullable');
  } catch (e) {
    console.error('❌ Error making group_id nullable:', e.message);
    process.exit(1);
  }
  
  console.log('✅ Migration complete!');
}

main().catch(console.error);
