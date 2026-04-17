/**
 * Migration: Add audit_events table
 * Unified audit stream for dashboard and entity histories.
 *
 * Run with: node scripts/add-audit-events.js
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
      WHERE table_schema = 'public' AND table_name = 'audit_events'
    `;

    if (existing.length > 0) {
      console.log('ℹ️ Таблиця audit_events вже існує — пропускаємо.');
    } else {
      await sql`
        CREATE TABLE audit_events (
          id SERIAL PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id INTEGER,
          entity_public_id TEXT,
          entity_title TEXT NOT NULL,
          event_type TEXT NOT NULL,
          event_badge TEXT NOT NULL,
          description TEXT NOT NULL,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          user_name TEXT NOT NULL,
          student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
          group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
          lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
          payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
          course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      await sql`CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC)`;
      await sql`CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id)`;
      await sql`CREATE INDEX idx_audit_events_student_id ON audit_events(student_id)`;
      await sql`CREATE INDEX idx_audit_events_group_id ON audit_events(group_id)`;
      await sql`CREATE INDEX idx_audit_events_lesson_id ON audit_events(lesson_id)`;
      console.log('✅ Таблиця audit_events створена');
    }

    console.log('\n🎉 Міграція успішна!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
