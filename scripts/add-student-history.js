/**
 * Migration: Add student_history table
 * Used to track all changes and events for students.
 *
 * Run with: node scripts/add-student-history.js
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
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'student_history'
    `;

    if (existing.length > 0) {
      console.log('ℹ️ Таблиця student_history вже існує — пропускаємо.');
    } else {
      await sql`
        CREATE TABLE student_history (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          action_type TEXT NOT NULL,
          action_description TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          user_name TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX idx_student_history_student ON student_history(student_id)`;
      await sql`CREATE INDEX idx_student_history_created ON student_history(created_at)`;
      console.log('✅ Таблиця student_history створена');
    }

    console.log('\n🎉 Міграція успішна!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
