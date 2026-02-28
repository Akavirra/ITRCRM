// Script to add reporting columns to lessons table
// Run with: node scripts/add-reporting-columns.js

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
  
  console.log('🔄 Adding reporting columns to lessons table...');
  
  // Add reported_by column
  try {
    await sql`ALTER TABLE lessons ADD COLUMN reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL`;
    console.log('✅ Column reported_by added');
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      console.log('ℹ️ Column reported_by already exists');
    } else {
      console.error('❌ Error adding reported_by:', e.message);
    }
  }
  
  // Add reported_at column
  try {
    await sql`ALTER TABLE lessons ADD COLUMN reported_at TIMESTAMPTZ`;
    console.log('✅ Column reported_at added');
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      console.log('ℹ️ Column reported_at already exists');
    } else {
      console.error('❌ Error adding reported_at:', e.message);
    }
  }
  
  // Add reported_via column
  try {
    await sql`ALTER TABLE lessons ADD COLUMN reported_via TEXT CHECK(reported_via IN ('telegram', 'web', NULL))`;
    console.log('✅ Column reported_via added');
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      console.log('ℹ️ Column reported_via already exists');
    } else {
      console.error('❌ Error adding reported_via:', e.message);
    }
  }
  
  console.log('✅ Migration complete!');
}

main().catch(console.error);
