/**
 * Smoke-test ізоляції ролі crm_student.
 *
 * Перевіряє (використовуючи DATABASE_URL_STUDENT):
 *   ✅ має читати student-* таблиці
 *   ✅ має читати дозволені колонки students / courses / groups / lessons
 *   ❌ НЕ має читати users (password_hash!)
 *   ❌ НЕ має читати sessions (адмінські сесії!)
 *   ❌ НЕ має читати individual_payments, system_settings, telegram-таблиці
 *   ❌ НЕ має читати заборонені колонки (наприклад groups.monthly_price)
 *
 * Якщо будь-який з ❌ тестів ПРОХОДИТЬ (тобто запит виконається) — це ВЕЛИКА ПОМИЛКА,
 * скрипт завершиться з кодом 1.
 *
 * Запуск: npm run db:test-student-isolation
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

let passed = 0;
let failed = 0;

/** Очікуємо що запит УСПІШНО виконається */
async function expectAllowed(sql, description, query) {
  try {
    await sql.query(query);
    console.log(`   ✅ [allowed] ${description}`);
    passed++;
  } catch (error) {
    console.log(`   ❌ [allowed] ${description}`);
    console.log(`      Помилка: ${error.message}`);
    failed++;
  }
}

/** Очікуємо що запит ВІДХИЛИТЬСЯ з permission denied */
async function expectDenied(sql, description, query) {
  try {
    await sql.query(query);
    console.log(`   ❌ [denied]  ${description}`);
    console.log(`      ПРОБЛЕМА: запит виконався, хоча мав бути заборонений!`);
    failed++;
  } catch (error) {
    if (error.message.includes('permission denied') || error.message.includes('does not exist')) {
      console.log(`   ✅ [denied]  ${description}`);
      passed++;
    } else {
      console.log(`   ⚠️  [denied]  ${description}`);
      console.log(`      Несподівана помилка: ${error.message}`);
      failed++;
    }
  }
}

async function run() {
  if (!process.env.DATABASE_URL_STUDENT) {
    console.error('❌ DATABASE_URL_STUDENT не встановлена в .env.local');
    console.error('\nКроки:');
    console.error('  1. Створити роль crm_student у Neon Console');
    console.error('  2. Додати DATABASE_URL_STUDENT у .env.local');
    console.error('  3. Запустити: npm run db:setup-student-role');
    console.error('  4. Повторити цей тест');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL_STUDENT);
  console.log('🔐 Тестуємо ізоляцію ролі crm_student...\n');

  console.log('📖 Дозволені запити (мають виконуватись):');
  await expectAllowed(sql, 'SELECT з student_sessions', 'SELECT 1 FROM student_sessions LIMIT 1');
  await expectAllowed(sql, 'SELECT з student_works', 'SELECT 1 FROM student_works LIMIT 1');
  await expectAllowed(sql, 'SELECT з student_notes', 'SELECT 1 FROM student_notes LIMIT 1');
  await expectAllowed(sql, 'SELECT з student_codes', 'SELECT 1 FROM student_codes LIMIT 1');
  await expectAllowed(sql, 'SELECT з student_credentials', 'SELECT 1 FROM student_credentials LIMIT 1');
  await expectAllowed(sql, 'SELECT students.full_name', 'SELECT id, full_name FROM students LIMIT 1');
  await expectAllowed(sql, 'SELECT courses.title', 'SELECT id, title FROM courses LIMIT 1');
  await expectAllowed(sql, 'SELECT lessons.lesson_date', 'SELECT id, lesson_date FROM lessons LIMIT 1');
  await expectAllowed(sql, 'SELECT student_groups', 'SELECT student_id, group_id FROM student_groups LIMIT 1');
  await expectAllowed(sql, 'SELECT attendance', 'SELECT lesson_id, student_id FROM attendance LIMIT 1');

  console.log('\n🚫 Заборонені запити (мають падати з permission denied):');

  // Найкритичніше: адмінські creds та сесії
  await expectDenied(sql, 'SELECT з users (password_hash витік!)',
    'SELECT password_hash FROM users LIMIT 1');
  await expectDenied(sql, 'SELECT з users (будь-яка колонка)',
    'SELECT id FROM users LIMIT 1');
  await expectDenied(sql, 'SELECT з sessions (адмінські сесії)',
    'SELECT id FROM sessions LIMIT 1');

  // Фінансові дані
  await expectDenied(sql, 'SELECT з individual_payments',
    'SELECT amount FROM individual_payments LIMIT 1');
  await expectDenied(sql, 'SELECT з individual_balances',
    'SELECT lessons_paid FROM individual_balances LIMIT 1');

  // Системні налаштування
  await expectDenied(sql, 'SELECT з system_settings',
    'SELECT key FROM system_settings LIMIT 1');
  await expectDenied(sql, 'SELECT з user_settings',
    'SELECT user_id FROM user_settings LIMIT 1');

  // Приватні колонки дозволених таблиць (students PII — номери батьків, email, імʼя батьків)
  // Увага: students.phone більше не існує (видалено в remove-student-phone.js) —
  // контакти тепер тільки в parent_phone / parent2_phone.
  await expectDenied(sql, 'SELECT students.parent_phone (PII батьків 1)',
    'SELECT parent_phone FROM students LIMIT 1');
  await expectDenied(sql, 'SELECT students.parent2_phone (PII батьків 2)',
    'SELECT parent2_phone FROM students LIMIT 1');
  await expectDenied(sql, 'SELECT students.email (PII)',
    'SELECT email FROM students LIMIT 1');
  await expectDenied(sql, 'SELECT students.parent_name (PII)',
    'SELECT parent_name FROM students LIMIT 1');
  await expectDenied(sql, 'SELECT students.birth_date (PII)',
    'SELECT birth_date FROM students LIMIT 1');
  await expectDenied(sql, 'SELECT students.notes (приватні нотатки адміна)',
    'SELECT notes FROM students LIMIT 1');
  await expectDenied(sql, 'SELECT groups.monthly_price (фінансові дані)',
    'SELECT monthly_price FROM groups LIMIT 1');
  await expectDenied(sql, 'SELECT groups.teacher_id (хто веде групу)',
    'SELECT teacher_id FROM groups LIMIT 1');

  // Історія та аудит
  await expectDenied(sql, 'SELECT з student_history',
    'SELECT id FROM student_history LIMIT 1');
  await expectDenied(sql, 'SELECT з error_logs',
    'SELECT id FROM error_logs LIMIT 1');

  // Спроби запису у заборонені таблиці
  await expectDenied(sql, 'INSERT у users (створення адміна)',
    "INSERT INTO users (name, email, password_hash, role) VALUES ('hack', 'h@h.h', 'x', 'admin')");
  await expectDenied(sql, 'UPDATE students (зміна PII батьків)',
    "UPDATE students SET parent_phone = '000' WHERE id = 1");
  await expectDenied(sql, 'INSERT у student_codes (має бути read-only для учнів)',
    "INSERT INTO student_codes (student_id, code) VALUES (1, 'HACK')");
  await expectDenied(sql, 'INSERT у student_marks (оцінки ставить тільки адмін)',
    "INSERT INTO student_marks (student_id, value) VALUES (1, '5')");

  console.log(`\n📊 Результати: ${passed} пройдено, ${failed} провалено`);

  if (failed > 0) {
    console.log('\n❌ Ізоляція не повна! Перегляньте GRANT-и у scripts/setup-student-role-grants.js');
    process.exit(1);
  } else {
    console.log('\n🎉 Ізоляція працює коректно!');
  }
}

run().catch((error) => {
  console.error('❌ Фатальна помилка:', error);
  process.exit(1);
});
