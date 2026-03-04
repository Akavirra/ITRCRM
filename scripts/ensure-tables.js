// Script to ensure all required tables exist in Neon database
// Run with: node scripts/ensure-tables.js

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
  
  console.log('🔄 Checking/creating student_groups table...');
  
  // Create student_groups table if it doesn't exist
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS student_groups (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        join_date DATE NOT NULL DEFAULT CURRENT_DATE,
        leave_date DATE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Table student_groups ready');
  } catch (e) {
    console.error('❌ Error creating student_groups table:', e.message);
  }
  
  // Create indexes
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_student_groups_student ON student_groups(student_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_student_groups_group ON student_groups(group_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_student_groups_active ON student_groups(is_active)`;
    console.log('✅ Indexes for student_groups ready');
  } catch (e) {
    console.error('❌ Error creating indexes:', e.message);
  }
  
  console.log('✅ All tables verified!');
}

main().catch(console.error);
