/**
 * Migration: Add is_trial column to lessons table
 * Used to mark individual lessons as trial lessons.
 *
 * Run with: node scripts/add-is-trial.js
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
      WHERE table_name = 'lessons' AND column_name = 'is_trial'
    `;

    if (existing.length > 0) {
      console.log('ℹ️ Колонка is_trial вже існує в lessons — пропускаємо.');
    } else {
      await sql`ALTER TABLE lessons ADD COLUMN is_trial BOOLEAN NOT NULL DEFAULT FALSE`;
      console.log('✅ Колонка is_trial додана до lessons');
    }

    console.log('\n🎉 Міграція успішна!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
