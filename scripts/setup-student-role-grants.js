/**
 * Налаштування Postgres-ролі crm_student — обмежені GRANT-и для порталу учнів.
 *
 * ВАЖЛИВО: цей скрипт ПРИПУСКАЄ що роль crm_student уже створено в Neon Console.
 * Neon не дозволяє створювати ролі через SQL з HTTP-драйвера (нема CREATE ROLE).
 * Тому створення ролі треба зробити руками:
 *   1. https://console.neon.tech → ваш проект → Roles → New Role
 *   2. Назва: crm_student
 *   3. Скопіювати connection string — це DATABASE_URL_STUDENT
 *
 * Після цього запустити: npm run db:setup-student-role
 *
 * Скрипт видаляє всі попередні дозволи і встановлює точні:
 *   - повний CRUD на student-* таблиці (свої)
 *   - тільки SELECT на окремі колонки зовнішніх таблиць
 *   - НЕМАЄ доступу до users, sessions, payments, telegram, settings тощо
 *
 * Запускається від admin-ролі (DATABASE_URL), що володіє таблицями.
 * Ідемпотентний — можна повторно, дозволи перезапишуться.
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

// Таблиці, де учень має повний CRUD (свої власні)
const FULL_ACCESS_TABLES = [
  'student_credentials',
  'student_sessions',
  'student_login_attempts',
  'student_works',
  'student_notes',
  'student_audit_log',
];

// Таблиці, де учень читає тільки свої дані (write — тільки адмін)
const READ_ONLY_TABLES = ['student_codes', 'student_marks'];

// Зовнішні таблиці — тільки SELECT, і тільки перелічені колонки.
// Не всі колонки — щоб не витікало: наприклад, price у groups, telegram_id у users,
// parent_phone/email/birth_date у students (PII батьків).
//
// ЩО СВІДОМО НЕ ВКЛЮЧЕНО (додавайте якщо з'явиться потреба на стороні UI):
//   - camps, camp_shifts, camp_participants* (нова camp-система не інтегрована з порталом)
//   - group_teacher_assignments, lesson_teacher_replacements (учню не треба знати заміни)
//   - media_files, lesson_photos (окремий продукт з Telegram-медіа)
//   - enrollment_* (публічна форма запису — окремий кейс)
const EXTERNAL_READS = {
  // Увага: students.phone видалено в remove-student-phone.js — тільки parent_phone/parent2_phone
  // (які сюди НЕ включаємо — це PII батьків)
  students: ['id', 'public_id', 'full_name', 'photo', 'is_active'],
  courses: ['id', 'public_id', 'title', 'description', 'age_min', 'duration_months', 'is_active'],
  groups: [
    'id',
    'public_id',
    'course_id',
    'title',
    'weekly_day',
    'start_time',
    'duration_minutes',
    'timezone',
    'start_date',
    'end_date',
    'status',
    'is_active',
  ],
  lessons: [
    'id',
    'public_id',
    'group_id',
    'course_id',
    'lesson_date',
    'start_datetime',
    'end_datetime',
    'topic',
    'status',
    'is_makeup',
    'is_trial',
  ],
  student_groups: ['id', 'student_id', 'group_id', 'join_date', 'leave_date', 'is_active', 'status'],
  attendance: ['id', 'lesson_id', 'student_id', 'status', 'comment'],
};

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL не встановлена в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🚀 Підключення до Neon PostgreSQL (admin-роль)...');

  try {
    // Перевірити що роль існує
    const [roleRow] = await sql`
      SELECT rolname FROM pg_roles WHERE rolname = ${ROLE}
    `;
    if (!roleRow) {
      console.error(`❌ Роль "${ROLE}" не знайдена.`);
      console.error('\nСтворіть її в Neon Console:');
      console.error('  1. https://console.neon.tech → проект → Roles → New Role');
      console.error('  2. Назва: crm_student');
      console.error('  3. Скопіюйте connection string у DATABASE_URL_STUDENT (.env.local)');
      console.error('  4. Запустіть цей скрипт знову');
      process.exit(1);
    }
    console.log(`✅ Роль "${ROLE}" знайдена`);

    // ⚠️ Крок 0: ЗНЯТИ успадкування neon_superuser + зняти привілеї BYPASSRLS/CREATEROLE.
    // Neon за замовчуванням додає НОВІ ролі у групу neon_superuser — це обходить ВСІ
    // наші GRANT-и (роль де-факто стає суперюзером). Без цього кроку ізоляції немає.
    // Безпечно повторювати: REVOKE якщо не членом — просто попередження.
    console.log('\n🛡️  Знімаємо успадкування neon_superuser...');
    // Neon не дозволяє звичайному admin-role робити REVOKE neon_superuser або
    // ALTER ROLE ... NOBYPASSRLS (це системні привілеї). Але NOINHERIT працює —
    // роль залишається членом neon_superuser, але НЕ отримує її привілеї автоматично.
    // Для доступу треба явний `SET ROLE neon_superuser`, чого код порталу ніколи не робить.
    try {
      await sql.query(`ALTER ROLE ${ROLE} NOINHERIT`);
      console.log('   ✅ NOINHERIT (привілеї neon_superuser більше не успадковуються)');
    } catch (e) {
      console.log('   ⚠️  NOINHERIT не вдалося:', e.message);
      console.log('      → треба виконати в Neon SQL Editor вручну.');
    }

    // Крок 1: revoke всіх публічних і раніше виданих дозволів
    console.log('\n🧹 Очищуємо попередні дозволи...');
    await sql.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ROLE}`);
    await sql.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${ROLE}`);
    await sql.query(`REVOKE ALL ON SCHEMA public FROM ${ROLE}`);
    await sql.query(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
    console.log('✅ Очищено, USAGE на схему public надано');

    // Крок 2: повний CRUD на власні таблиці учня
    console.log('\n📝 Надаємо CRUD на student-* таблиці...');
    for (const table of FULL_ACCESS_TABLES) {
      await sql.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${ROLE}`);
      console.log(`   ✅ ${table} (SELECT, INSERT, UPDATE, DELETE)`);
    }

    // Крок 3: SELECT на read-only таблиці (student_codes, student_marks)
    console.log('\n📖 Надаємо SELECT на read-only таблиці...');
    for (const table of READ_ONLY_TABLES) {
      await sql.query(`GRANT SELECT ON ${table} TO ${ROLE}`);
      console.log(`   ✅ ${table} (SELECT)`);
    }

    // Крок 4: обмежений SELECT на зовнішні таблиці (тільки певні колонки)
    console.log('\n🔍 Надаємо обмежений SELECT на зовнішні таблиці (тільки певні колонки)...');
    for (const [table, columns] of Object.entries(EXTERNAL_READS)) {
      const cols = columns.join(', ');
      await sql.query(`GRANT SELECT (${cols}) ON ${table} TO ${ROLE}`);
      console.log(`   ✅ ${table} (${columns.length} колонок)`);
    }

    // Крок 5: USAGE на sequences (для INSERT з автогенерацією id)
    console.log('\n🔢 Надаємо USAGE на sequences для student-* таблиць...');
    const sequenceRows = await sql.query(`
      SELECT sequence_name FROM information_schema.sequences
      WHERE sequence_schema = 'public' AND sequence_name LIKE 'student_%'
    `);
    for (const row of sequenceRows) {
      const seqName = row.sequence_name;
      await sql.query(`GRANT USAGE, SELECT ON SEQUENCE ${seqName} TO ${ROLE}`);
      console.log(`   ✅ ${seqName}`);
    }

    console.log('\n🎉 GRANT-и для crm_student налаштовано!');
    console.log('\nПеревірка ізоляції:');
    console.log('   npm run db:test-student-isolation');
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    if (error.code) console.error('   Код:', error.code);
    process.exit(1);
  }
}

run();
