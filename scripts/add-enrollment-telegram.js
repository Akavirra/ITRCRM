/**
 * Migration: Add parent_telegram_chat_id columns for enrollment Telegram integration
 *
 * Run with: node scripts/add-enrollment-telegram.js
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
    await sql`ALTER TABLE enrollment_tokens ADD COLUMN IF NOT EXISTS parent_telegram_chat_id BIGINT`;
    console.log('✅ Колонка parent_telegram_chat_id додана до enrollment_tokens');

    await sql`ALTER TABLE enrollment_submissions ADD COLUMN IF NOT EXISTS parent_telegram_chat_id BIGINT`;
    console.log('✅ Колонка parent_telegram_chat_id додана до enrollment_submissions');

    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_telegram_chat_id BIGINT`;
    console.log('✅ Колонка parent_telegram_chat_id додана до students');

    console.log('\n🎉 Міграція Telegram для анкет завершена успішно!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error);
    process.exit(1);
  }
}

migrate();
