/**
 * Migration: Add is_trial and added_by columns to attendance table.
 *
 * Rationale: current model stores is_trial on the lesson, but we need
 * per-student trial marks because a single group lesson may host both
 * regular students and trial visitors at the same time.
 *
 * - attendance.is_trial BOOLEAN NOT NULL DEFAULT FALSE
 *     Authoritative marker for whether a particular student attended
 *     this lesson as a trial participant (free of charge).
 * - attendance.added_by INTEGER REFERENCES users(id)
 *     Who added this student to the lesson as a trial (optional).
 *
 * Backfill: for every existing lesson where lessons.is_trial = TRUE,
 * mark its attendance rows as is_trial = TRUE too, so existing trial
 * individual lessons keep their semantics.
 *
 * Run with: node scripts/add-attendance-is-trial.js
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
    const isTrialCol = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'attendance' AND column_name = 'is_trial'
    `;

    if (isTrialCol.length > 0) {
      console.log('ℹ️ Колонка attendance.is_trial вже існує — пропускаємо.');
    } else {
      await sql`ALTER TABLE attendance ADD COLUMN is_trial BOOLEAN NOT NULL DEFAULT FALSE`;
      console.log('✅ Колонку attendance.is_trial додано');
    }

    const addedByCol = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'attendance' AND column_name = 'added_by'
    `;

    if (addedByCol.length > 0) {
      console.log('ℹ️ Колонка attendance.added_by вже існує — пропускаємо.');
    } else {
      await sql`ALTER TABLE attendance ADD COLUMN added_by INTEGER REFERENCES users(id)`;
      console.log('✅ Колонку attendance.added_by додано');
    }

    // Partial index for fast lookup of trial students per lesson.
    await sql`
      CREATE INDEX IF NOT EXISTS idx_attendance_trial
      ON attendance(lesson_id) WHERE is_trial = TRUE
    `;
    console.log('✅ Індекс idx_attendance_trial готовий');

    // Backfill: existing trial lessons → mark their attendance rows as trial too.
    const updated = await sql`
      UPDATE attendance a
      SET is_trial = TRUE
      FROM lessons l
      WHERE a.lesson_id = l.id
        AND COALESCE(l.is_trial, FALSE) = TRUE
        AND a.is_trial = FALSE
      RETURNING a.id
    `;
    console.log(`✅ Backfill: оновлено ${updated.length} рядків attendance для вже існуючих пробних занять`);

    console.log('\n🎉 Міграція успішна!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
