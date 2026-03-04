// Script to add course_id column to lessons table for individual lessons
// Run with: node scripts/add-lessons-course-id.js

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
  
  console.log('🔄 Adding course_id column to lessons table...');
  
  // Add course_id column
  try {
    await sql`ALTER TABLE lessons ADD COLUMN course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL`;
    console.log('✅ Column course_id added to lessons table');
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      console.log('ℹ️ Column course_id already exists in lessons table');
    } else {
      console.error('❌ Error adding course_id column:', e.message);
      process.exit(1);
    }
  }
  
  console.log('✅ Migration complete!');
}

main().catch(console.error);
