/**
 * Migration: Add original_date column to lessons table
 * Used to track when a lesson was originally scheduled before rescheduling.
 *
 * Run with: node scripts/add-lesson-original-date.js
 */

const { neon } = require('@neondatabase/serverless');
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

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL не встановлена в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🚀 Підключення до Neon PostgreSQL...');

  try {
    const existing = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'lessons' AND column_name = 'original_date'
    `;

    if (existing.length > 0) {
      console.log('ℹ️ Колонка original_date вже існує в lessons — пропускаємо.');
    } else {
      await sql`ALTER TABLE lessons ADD COLUMN original_date DATE`;
      console.log('✅ Колонка original_date додана до lessons');
    }

    console.log('\n🎉 Міграція успішна!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
