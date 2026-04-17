/**
 * Migration: Add manually_closed_at to enrollment_tokens
 *
 * Run with: node scripts/add-enrollment-manual-close.js
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
  console.log('🚀 Додаємо manually_closed_at до enrollment_tokens...');

  try {
    await sql`
      ALTER TABLE enrollment_tokens
      ADD COLUMN IF NOT EXISTS manually_closed_at TIMESTAMPTZ
    `;

    console.log('✅ Поле manually_closed_at додано');
    console.log('🎉 Міграція завершена успішно!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error);
    process.exit(1);
  }
}

migrate();
