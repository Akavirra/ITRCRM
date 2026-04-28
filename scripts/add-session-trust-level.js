/**
 * Migration: додати колонку is_persistent до student_sessions.
 *
 * Семантика:
 *   - is_persistent = FALSE (default) — короткоживуча session-only сесія для shared-девайсів
 *     (клас). TTL 2 години + idle-logout 60 хв (якщо last_seen_at не оновлювався).
 *   - is_persistent = TRUE — trusted-device, TTL 30 днів, без idle-logout.
 *
 * Запуск: npm run db:add-session-trust
 *
 * Ідемпотентна — якщо колонка вже існує, скрипт пропускає.
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

async function columnExists(sql, table, column) {
  const rows = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
  `;
  return rows.length > 0;
}

async function indexExists(sql, indexName) {
  const rows = await sql`
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = ${indexName}
  `;
  return rows.length > 0;
}

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL не встановлено');
    process.exit(1);
  }

  const sql = neon(url);

  if (await columnExists(sql, 'student_sessions', 'is_persistent')) {
    console.log('ℹ️  Колонка is_persistent вже існує — пропускаю ALTER');
  } else {
    await sql`
      ALTER TABLE student_sessions
        ADD COLUMN is_persistent BOOLEAN NOT NULL DEFAULT FALSE
    `;
    console.log('✅ Додано колонку student_sessions.is_persistent');
  }

  if (await indexExists(sql, 'idx_student_sessions_idle')) {
    console.log('ℹ️  Індекс idx_student_sessions_idle вже існує');
  } else {
    // Частковий індекс для idle-перевірки лише на short-сесіях
    await sql`
      CREATE INDEX idx_student_sessions_idle
        ON student_sessions(last_seen_at)
        WHERE is_persistent = FALSE
    `;
    console.log('✅ Створено індекс idx_student_sessions_idle');
  }

  console.log('🎉 Готово.');
}

run().catch((e) => {
  console.error('❌ Помилка міграції:', e);
  process.exit(1);
});
