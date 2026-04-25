/**
 * Phase C.1: дати ролі crm_student SELECT-доступ на lesson_photo_files
 * (галерея заняття в порталі учня).
 *
 * Файли на Google Drive публічні (через makeFilePublic), тому проксі не потрібен —
 * учень отримує прямі URL з Drive. У БД ми відкриваємо тільки колонки, які не PII:
 *   id, lesson_id, drive_file_id, file_name, mime_type, file_size,
 *   uploaded_by_name, uploaded_via, created_at
 *
 * Свідомо не відкриваємо: uploaded_by (admin user id), uploaded_by_telegram_id.
 *
 * Ідемпотентний — повторні запуски просто перезапишуть GRANT.
 *
 * Запуск:
 *   node scripts/add-student-gallery-grant.js
 *
 * Або: запустити повний `npm run db:setup-student-role` — він тепер також включає
 * lesson_photo_files (див. setup-student-role-grants.js).
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

const ROLE = 'crm_student';
const TABLE = 'lesson_photo_files';
const COLUMNS = [
  'id',
  'lesson_id',
  'drive_file_id',
  'file_name',
  'mime_type',
  'file_size',
  'uploaded_by_name',
  'uploaded_via',
  'created_at',
];

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL не встановлена в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log(`🚀 Підключення до Neon (admin)...`);

  try {
    // Перевірити що роль існує
    const [roleRow] = await sql`
      SELECT rolname FROM pg_roles WHERE rolname = ${ROLE}
    `;
    if (!roleRow) {
      console.error(`❌ Роль "${ROLE}" не знайдена. Запусти спершу setup-student-role-grants.js.`);
      process.exit(1);
    }

    // Перевірити що таблиця існує
    const [tableRow] = await sql`
      SELECT to_regclass(${'public.' + TABLE}) AS exists
    `;
    if (!tableRow?.exists) {
      console.error(`❌ Таблиця "${TABLE}" не знайдена.`);
      process.exit(1);
    }

    // Зняти попередні column-level дозволи (на випадок зміни набору колонок)
    console.log(`\n🧹 Знімаємо попередні дозволи на ${TABLE}...`);
    await sql.query(`REVOKE ALL ON TABLE ${TABLE} FROM ${ROLE}`);

    // Видати column-level SELECT
    const cols = COLUMNS.join(', ');
    console.log(`\n📖 GRANT SELECT (${cols}) ON ${TABLE} TO ${ROLE}`);
    await sql.query(`GRANT SELECT (${cols}) ON ${TABLE} TO ${ROLE}`);

    console.log('\n✅ Готово. Учень тепер може читати галерею заняття.');
    console.log('   Перевірка: студент-роль → SELECT id, lesson_id FROM lesson_photo_files LIMIT 1;');
  } catch (e) {
    console.error('❌ Помилка:', e.message);
    process.exit(1);
  }
}

run();
