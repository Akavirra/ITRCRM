/**
 * Migration: Add group_teacher_assignments table
 *
 * Tracks the full history of teacher assignments per group,
 * enabling accurate per-teacher lesson counting across teacher changes.
 *
 * Run with: node scripts/add-group-teacher-assignments.js
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
      WHERE table_schema = 'public' AND table_name = 'group_teacher_assignments'
    `;

    if (existing.length > 0) {
      console.log('ℹ️  Таблиця group_teacher_assignments вже існує — пропускаємо.');
    } else {
      await sql`
        CREATE TABLE group_teacher_assignments (
          id           SERIAL PRIMARY KEY,
          group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          teacher_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ended_at     TIMESTAMPTZ,
          changed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
          reason       TEXT,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX idx_gta_group_id  ON group_teacher_assignments(group_id)`;
      await sql`CREATE INDEX idx_gta_teacher_id ON group_teacher_assignments(teacher_id)`;
      await sql`CREATE INDEX idx_gta_active ON group_teacher_assignments(group_id) WHERE ended_at IS NULL`;
      console.log('✅ Таблиця group_teacher_assignments створена');

      // Backfill: one initial record per existing group
      console.log('📦 Заповнення існуючих груп...');
      const groups = await sql`SELECT id, teacher_id, created_at FROM groups`;
      let count = 0;
      for (const g of groups) {
        await sql`
          INSERT INTO group_teacher_assignments
            (group_id, teacher_id, started_at, ended_at, changed_by, reason)
          VALUES
            (${g.id}, ${g.teacher_id}, ${g.created_at}, NULL, NULL, 'Початкове призначення (backfill)')
        `;
        count++;
      }
      console.log(`✅ Заповнено ${count} записів для існуючих груп`);
    }

    console.log('\n🎉 Міграція успішна!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
