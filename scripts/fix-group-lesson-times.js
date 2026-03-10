/**
 * Migration: Fix group lesson timestamps from "Kyiv-as-UTC" to true UTC.
 *
 * Background: group lessons were historically stored with Kyiv local time
 * in the TIMESTAMPTZ column (e.g., 16:00 Kyiv stored as "16:00+00" instead
 * of the correct "14:00+00"). Individual lessons were stored as true UTC.
 *
 * This migration reinterprets the stored value as Kyiv local time and
 * converts it to proper UTC. PostgreSQL handles DST automatically.
 *
 * Run ONCE before deploying the timezone-aware API changes:
 *   node scripts/fix-group-lesson-times.js
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
    // Check how many group lessons exist
    const [{ count }] = await sql`
      SELECT COUNT(*) as count FROM lessons WHERE group_id IS NOT NULL
    `;
    console.log(`📊 Знайдено ${count} групових занять`);

    if (count === 0) {
      console.log('ℹ️  Немає групових занять для міграції.');
      return;
    }

    // Show a sample before migration
    const samples = await sql`
      SELECT id, start_datetime, end_datetime
      FROM lessons
      WHERE group_id IS NOT NULL
      ORDER BY id
      LIMIT 3
    `;
    console.log('📋 Приклад ДО міграції:');
    samples.forEach(r => console.log(`   id=${r.id}: start=${r.start_datetime}, end=${r.end_datetime}`));

    // Convert: reinterpret stored UTC timestamps as Kyiv local time, then convert to true UTC.
    // "start_datetime::timestamp" strips the timezone offset (treating value as naive local time).
    // "AT TIME ZONE 'Europe/Kyiv'" then converts from Kyiv to UTC (handles DST correctly).
    await sql`
      UPDATE lessons
      SET
        start_datetime = (start_datetime::timestamp AT TIME ZONE 'Europe/Kyiv'),
        end_datetime   = (end_datetime::timestamp   AT TIME ZONE 'Europe/Kyiv'),
        updated_at     = NOW()
      WHERE group_id IS NOT NULL
    `;

    // Show a sample after migration
    const samplesAfter = await sql`
      SELECT id, start_datetime, end_datetime
      FROM lessons
      WHERE group_id IS NOT NULL
      ORDER BY id
      LIMIT 3
    `;
    console.log('📋 Приклад ПІСЛЯ міграції:');
    samplesAfter.forEach(r => console.log(`   id=${r.id}: start=${r.start_datetime}, end=${r.end_datetime}`));

    console.log(`\n✅ Міграцію завершено: ${count} занять оновлено`);
    console.log('🎉 Тепер deploy нової версії API з підтримкою AT TIME ZONE');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
