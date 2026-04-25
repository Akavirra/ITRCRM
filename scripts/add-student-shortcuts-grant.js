/**
 * Phase D.1: дати ролі crm_student SELECT-доступ на lesson_shortcuts.
 *
 * Колонки безпечні (нема PII викладача):
 *   id, lesson_id, kind, label, target, icon, sort_order,
 *   created_by_name, created_at
 *
 * Свідомо НЕ відкриваємо: created_by_user (admin id), created_by_telegram_id.
 *
 * Ідемпотентний.
 *
 * Запуск:
 *   node scripts/add-student-shortcuts-grant.js
 *
 * Або: повний `npm run db:setup-student-role` — там тепер також прописаний
 * lesson_shortcuts (див. setup-student-role-grants.js).
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
const TABLE = 'lesson_shortcuts';
const COLUMNS = [
  'id',
  'lesson_id',
  'kind',
  'label',
  'target',
  'icon',
  'sort_order',
  'created_by_name',
  'created_at',
];

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL не встановлена в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🚀 Підключення до Neon (admin)...');

  try {
    const [roleRow] = await sql`
      SELECT rolname FROM pg_roles WHERE rolname = ${ROLE}
    `;
    if (!roleRow) {
      console.error(`❌ Роль "${ROLE}" не знайдена. Запусти спершу setup-student-role-grants.js.`);
      process.exit(1);
    }

    const [tableRow] = await sql`
      SELECT to_regclass(${'public.' + TABLE}) AS exists
    `;
    if (!tableRow?.exists) {
      console.error(`❌ Таблиця "${TABLE}" не знайдена. Запусти спершу add-lesson-shortcuts.js.`);
      process.exit(1);
    }

    console.log(`\n🧹 Знімаємо попередні дозволи на ${TABLE}...`);
    await sql.query(`REVOKE ALL ON TABLE ${TABLE} FROM ${ROLE}`);

    const cols = COLUMNS.join(', ');
    console.log(`\n📖 GRANT SELECT (${cols}) ON ${TABLE} TO ${ROLE}`);
    await sql.query(`GRANT SELECT (${cols}) ON ${TABLE} TO ${ROLE}`);

    console.log('\n✅ Готово. Учень тепер може читати ярлики свого заняття.');
  } catch (e) {
    console.error('❌ Помилка:', e.message);
    process.exit(1);
  }
}

run();
