/**
 * Migration: Add enrollment_tokens + enrollment_submissions tables
 * Used for electronic enrollment forms (QR-based).
 *
 * Run with: node scripts/add-enrollment.js
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
    // 1. enrollment_tokens — one-time tokens for enrollment forms
    await sql`
      CREATE TABLE IF NOT EXISTS enrollment_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        manually_closed_at TIMESTAMPTZ,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця enrollment_tokens створена');

    // 2. enrollment_submissions — filled enrollment forms awaiting approval
    await sql`
      CREATE TABLE IF NOT EXISTS enrollment_submissions (
        id SERIAL PRIMARY KEY,
        token_id INTEGER REFERENCES enrollment_tokens(id),
        child_first_name TEXT NOT NULL,
        child_last_name TEXT NOT NULL,
        birth_date DATE,
        school TEXT,
        parent_name TEXT NOT NULL,
        parent_phone TEXT NOT NULL,
        parent_relation TEXT,
        parent2_name TEXT,
        parent2_relation TEXT,
        notes TEXT,
        interested_courses TEXT,
        source TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMPTZ,
        student_id INTEGER REFERENCES students(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця enrollment_submissions створена');

    // 3. Index for fast token lookup
    await sql`CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_token ON enrollment_tokens(token)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_enrollment_submissions_status ON enrollment_submissions(status)`;
    console.log('✅ Індекси створені');

    console.log('\n🎉 Міграція enrollment завершена успішно!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error);
    process.exit(1);
  }
}

migrate();
