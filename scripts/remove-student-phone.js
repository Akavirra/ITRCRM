/**
 * Migration: move legacy students.phone into students.parent_phone and remove the old column.
 *
 * Run with: node scripts/remove-student-phone.js
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
    const phoneColumnExists = await sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'students'
          AND column_name = 'phone'
      ) AS exists
    `;

    if (!phoneColumnExists[0]?.exists) {
      console.log('ℹ️ Колонка students.phone вже відсутня, міграція не потрібна');
      return;
    }

    const backfillResult = await sql`
      UPDATE students
      SET parent_phone = phone,
          updated_at = NOW()
      WHERE phone IS NOT NULL
        AND BTRIM(phone) <> ''
        AND (parent_phone IS NULL OR BTRIM(parent_phone) = '')
    `;
    console.log(`✅ Перенесено legacy-номерів у parent_phone: ${backfillResult.count ?? 0}`);

    await sql`DROP INDEX IF EXISTS idx_students_phone_trgm`;
    console.log('✅ Старий індекс idx_students_phone_trgm видалено');

    await sql`ALTER TABLE students DROP COLUMN IF EXISTS phone`;
    console.log('✅ Колонка students.phone видалена');

    console.log('\n🎉 Міграція students.phone завершена успішно!');
  } catch (error) {
    console.error('❌ Помилка міграції students.phone:', error);
    process.exit(1);
  }
}

migrate();
