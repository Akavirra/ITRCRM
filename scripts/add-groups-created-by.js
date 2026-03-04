// Script to add created_by column to groups table
// Run with: node scripts/add-groups-created-by.js

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
  
  console.log('🔄 Adding created_by column to groups table...');
  
  // Add created_by column
  try {
    await sql`ALTER TABLE groups ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL`;
    console.log('✅ Column created_by added to groups table');
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      console.log('ℹ️ Column created_by already exists in groups table');
    } else {
      console.error('❌ Error adding created_by column:', e.message);
      process.exit(1);
    }
  }

  // Add updated_by column for consistency
  try {
    await sql`ALTER TABLE groups ADD COLUMN updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL`;
    console.log('✅ Column updated_by added to groups table');
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      console.log('ℹ️ Column updated_by already exists in groups table');
    } else {
      console.error('❌ Error adding updated_by column:', e.message);
      process.exit(1);
    }
  }
  
  console.log('✅ Migration complete!');
}

main().catch(console.error);
