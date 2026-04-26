/**
 * Migration: Add teacher_invite_tokens table
 * Used for QR-based teacher self-registration via Telegram Mini App.
 *
 * Run with: node scripts/add-teacher-invites.js
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
    await sql`
      CREATE TABLE IF NOT EXISTS teacher_invite_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'expired')),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        teacher_name TEXT,
        teacher_email TEXT,
        teacher_phone TEXT,
        telegram_id TEXT,
        telegram_username TEXT,
        notes TEXT,
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMPTZ
      )
    `;
    console.log('✅ Таблиця teacher_invite_tokens створена');

    await sql`CREATE INDEX IF NOT EXISTS idx_teacher_invite_tokens_token ON teacher_invite_tokens(token)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teacher_invite_tokens_status ON teacher_invite_tokens(status)`;
    console.log('✅ Індекси створені');

    console.log('\n🎉 Міграція teacher_invite_tokens завершена успішно!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error);
    process.exit(1);
  }
}

migrate();
