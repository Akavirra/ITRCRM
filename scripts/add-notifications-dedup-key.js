/**
 * Migration: Add dedup_key column to notifications for atomic deduplication
 *
 * Run with: npm run db:add-notifications-dedup-key
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
      WHERE table_name = 'notifications' AND column_name = 'dedup_key'
    `;

    if (exists.length > 0) {
      console.log('ℹ️  Колонка dedup_key вже існує — пропускаємо.');
    } else {
      await sql`ALTER TABLE notifications ADD COLUMN dedup_key TEXT`;
      await sql`CREATE UNIQUE INDEX idx_notifications_dedup_key ON notifications(dedup_key) WHERE dedup_key IS NOT NULL`;
      console.log('✅ Колонка dedup_key з унікальним індексом додана');
    }

    console.log('\n🎉 Міграція успішна!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
