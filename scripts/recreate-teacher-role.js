/**
 * Створює роль crm_teacher через SQL (НЕ через Neon Console UI).
 *
 * НАВІЩО (та сама пастка, що й у crm_student):
 *   Якщо створити роль через Neon Console — Neon автоматично додає її в групу
 *   neon_superuser і вмикає BYPASSRLS/CREATEROLE. Звичайний admin не може це
 *   відмінити (permission denied to alter role).
 *
 *   Створення через SQL від neondb_owner залишає роль "чистою": NOINHERIT,
 *   NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS — все що нам треба.
 *
 * ПЕРЕДУМОВИ:
 *   - crm_teacher НЕ існує (видалити в Neon Console → Roles → Delete якщо є)
 *   - DATABASE_URL у .env.local — admin (neondb_owner)
 *
 * Запуск: node scripts/recreate-teacher-role.js
 *
 * Виводить готовий DATABASE_URL_TEACHER — скопіювати в .env.local + у Vercel.
 */

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  }
}

function generatePassword(length = 32) {
  // URL-safe alphanumeric — без потреби URL-encode у connection string
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL не встановлена');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // 1. Переконатись що роль НЕ існує
  const existing = await sql.query(
    `SELECT rolname FROM pg_roles WHERE rolname = 'crm_teacher'`,
  );
  if (existing.length > 0) {
    console.error('❌ Роль crm_teacher вже існує.');
    console.error('   Видаліть її в Neon Console → Branches → Roles → Delete,');
    console.error('   потім перезапустіть цей скрипт.');
    process.exit(1);
  }

  // 2. Згенерувати пароль
  const password = generatePassword(32);
  console.log('🔐 Згенеровано пароль для crm_teacher');

  // 3. CREATE ROLE
  console.log('👤 Створюємо роль crm_teacher через SQL...');
  await sql.query(
    `CREATE ROLE crm_teacher WITH LOGIN PASSWORD '${password}' ` +
      `NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
  );
  console.log(
    '✅ Роль створено з прапорцями: NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS',
  );

  // 4. Перевірка членства в groups
  const members = await sql.query(`
    SELECT r.rolname
    FROM pg_auth_members m
    JOIN pg_roles r ON r.oid = m.roleid
    JOIN pg_roles u ON u.oid = m.member
    WHERE u.rolname = 'crm_teacher'
  `);
  if (members.length > 0) {
    console.log('\n⚠️  УВАГА: роль потрапила у groups:');
    for (const m of members) console.log('   -', m.rolname);
  } else {
    console.log('✅ Роль не складається в жодних групах (neon_superuser НЕ успадковано)');
  }

  // 5. Скласти connection string
  const adminUrl = new URL(process.env.DATABASE_URL);
  const teacherUrl = new URL(adminUrl.toString());
  teacherUrl.username = 'crm_teacher';
  teacherUrl.password = password;

  console.log('\n' + '='.repeat(72));
  console.log('📋 Скопіюйте цей рядок у .env.local як DATABASE_URL_TEACHER:');
  console.log('='.repeat(72));
  console.log('');
  console.log(`DATABASE_URL_TEACHER=${teacherUrl.toString()}`);
  console.log('');
  console.log('='.repeat(72));
  console.log('\nНаступні кроки:');
  console.log('  1. Замініть/додайте DATABASE_URL_TEACHER у .env.local');
  console.log('  2. Додайте DATABASE_URL_TEACHER у Vercel Environment Variables');
  console.log('  3. npm run db:setup-teacher-role');
  console.log('  4. npm run db:test-teacher-isolation');
}

run().catch((e) => {
  console.error('❌ Помилка:', e.message);
  if (e.code) console.error('   Код:', e.code);
  process.exit(1);
});
