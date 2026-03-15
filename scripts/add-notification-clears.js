/**
 * Migration: Add notification_clears table for per-user notification clearing
 *
 * Run with: npm run db:add-notification-clears
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
    const exists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'notification_clears' AND column_name = 'user_id'
    `;

    if (exists.length > 0) {
      console.log('ℹ️  Таблиця notification_clears вже існує — пропускаємо.');
    } else {
      await sql`
        CREATE TABLE notification_clears (
          user_id    INTEGER      NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          cleared_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `;
      console.log('✅ Таблиця notification_clears створена');
    }

    console.log('\n🎉 Міграція успішна!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
