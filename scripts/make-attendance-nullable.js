// Run migration to make attendance status nullable
const { neon } = require('@neondatabase/serverless');

// Load .env.local
const fs = require('fs');
const path = require('path');
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length > 0) {
      process.env[key.trim()] = vals.join('=').trim();
    }
  }
}

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Making attendance status nullable...');
  try {
    await sql`ALTER TABLE attendance ALTER COLUMN status DROP NOT NULL`;
    console.log('✅ Migration complete - attendance status is now nullable');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

migrate();
