/**
 * Migration: Add notification_filters column to user_settings table
 * Run with: npm run db:add-notification-filters
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
      WHERE table_name = 'user_settings' AND column_name = 'notification_filters'
    `;

    if (existing.length > 0) {
      console.log('ℹ️  Колонка notification_filters вже існує в user_settings — пропускаємо.');
    } else {
      await sql`ALTER TABLE user_settings ADD COLUMN notification_filters JSONB DEFAULT '[]'::jsonb`;
      console.log('✅ Колонка notification_filters додана до user_settings');
    }

    console.log('\n🎉 Міграція успішна!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
