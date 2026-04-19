/**
 * Пересоздає роль crm_student через SQL (не через Neon UI).
 *
 * НАВІЩО: коли роль створюється через Neon Console, вона автоматично стає членом
 * neon_superuser — тобто де-факто адмін. ALTER ROLE/REVOKE звичайним admin-ам
 * Neon не дозволяє (permission denied to alter role).
 *
 * Рішення: створити роль через SQL від імені нашого neondb_owner. Тоді Neon НЕ
 * додає її в neon_superuser автоматично, і прапорці BYPASSRLS/CREATEROLE за
 * замовчуванням вимкнені.
 *
 * ПЕРЕДУМОВИ:
 *   - crm_student НЕ існує (видалити через Neon Console → Branches → Roles → Delete)
 *   - DATABASE_URL в .env.local — адмінська роль (neondb_owner)
 *
 * ЩО РОБИТЬ:
 *   1. Генерує криптографічно стійкий пароль
 *   2. CREATE ROLE crm_student WITH LOGIN PASSWORD '...' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
 *   3. Виводить готовий DATABASE_URL_STUDENT — скопіювати в .env.local
 *
 * Запуск: node scripts/recreate-student-role.js
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
  // URL-safe: тільки літери+цифри, щоб не треба було URL-encode в connection string
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
  const existing = await sql.query(`SELECT rolname FROM pg_roles WHERE rolname = 'crm_student'`);
  if (existing.length > 0) {
    console.error('❌ Роль crm_student вже існує.');
    console.error('   Спочатку видаліть її в Neon Console → Branches → Roles → Delete,');
    console.error('   потім перезапустіть цей скрипт.');
    process.exit(1);
  }

  // 2. Згенерувати пароль
  const password = generatePassword(32);
  console.log('🔐 Згенеровано пароль для crm_student');

  // 3. CREATE ROLE через SQL з усіма правильними прапорцями
  console.log('👤 Створюємо роль crm_student через SQL...');
  // Важливо: використовуємо одинарні лапки навколо пароля. Пароль з тільки
  // alphanumeric символів — SQL injection неможлива.
  await sql.query(
    `CREATE ROLE crm_student WITH LOGIN PASSWORD '${password}' ` +
    `NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`
  );
  console.log('✅ Роль створено з прапорцями: NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS');

  // 4. Перевірка що в neon_superuser не потрапила
  const members = await sql.query(`
    SELECT r.rolname
    FROM pg_auth_members m
    JOIN pg_roles r ON r.oid = m.roleid
    JOIN pg_roles u ON u.oid = m.member
    WHERE u.rolname = 'crm_student'
  `);
  if (members.length > 0) {
    console.log('\n⚠️  УВАГА: роль потрапила у groups:');
    for (const m of members) console.log('   -', m.rolname);
    console.log('   Це може бути проблемою для ізоляції — діагностуйте через scripts/diagnose-student-role.js');
  } else {
    console.log('✅ Роль ні в яких групах не складається (neon_superuser не успадковується)');
  }

  // 5. Скласти connection string: беремо host/database з DATABASE_URL, підставляємо нові user/password
  const adminUrl = new URL(process.env.DATABASE_URL);
  const studentUrl = new URL(adminUrl.toString());
  studentUrl.username = 'crm_student';
  studentUrl.password = password;

  console.log('\n' + '='.repeat(72));
  console.log('📋 Скопіюйте цей рядок у .env.local як DATABASE_URL_STUDENT:');
  console.log('='.repeat(72));
  console.log('');
  console.log(`DATABASE_URL_STUDENT=${studentUrl.toString()}`);
  console.log('');
  console.log('='.repeat(72));
  console.log('\nНаступні кроки:');
  console.log('  1. Замініть існуючий DATABASE_URL_STUDENT у .env.local на новий (вище)');
  console.log('  2. npm run db:setup-student-role');
  console.log('  3. npm run db:test-student-isolation');
}

run().catch((e) => {
  console.error('❌ Помилка:', e.message);
  if (e.code) console.error('   Код:', e.code);
  process.exit(1);
});
