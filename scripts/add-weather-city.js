/**
 * Migration: Add weather_city column to user_settings table
 * Run with: npm run db:add-weather-city
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
    // Ensure user_settings table exists (defensive)
    await sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        phone TEXT DEFAULT '',
        language TEXT DEFAULT 'uk',
        timezone TEXT DEFAULT 'Europe/Kyiv',
        date_format TEXT DEFAULT 'DD.MM.YYYY',
        currency TEXT DEFAULT 'UAH',
        email_notifications INTEGER DEFAULT 1,
        push_notifications INTEGER DEFAULT 1,
        lesson_reminders INTEGER DEFAULT 1,
        payment_alerts INTEGER DEFAULT 1,
        weekly_report INTEGER DEFAULT 1
      )
    `;

    const existing = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'weather_city'
    `;

    if (existing.length > 0) {
      console.log('ℹ️  Колонка weather_city вже існує в user_settings — пропускаємо.');
    } else {
      await sql`ALTER TABLE user_settings ADD COLUMN weather_city TEXT DEFAULT 'Kyiv'`;
      console.log('✅ Колонка weather_city додана до user_settings');
    }

    console.log('\n🎉 Міграція успішна!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
