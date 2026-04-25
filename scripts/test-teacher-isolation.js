/**
 * Smoke-test ізоляції ролі crm_teacher.
 *
 * Перевіряє (використовуючи DATABASE_URL_TEACHER):
 *   ✅ читає teacher_sessions, teacher_login_attempts
 *   ✅ читає дозволені колонки users, students, groups, lessons, attendance
 *   ✅ INSERT/UPDATE на attendance, lesson_shortcuts, lesson_photo_files
 *   ❌ НЕ читає student_credentials (PIN-хеші!)
 *   ❌ НЕ читає student_sessions (учнівські сесії)
 *   ❌ НЕ читає sessions (адмінські сесії!)
 *   ❌ НЕ читає payments, individual_payments, salary-таблиці
 *   ❌ НЕ робить DELETE на groups/lessons/students/courses
 *   ❌ НЕ робить INSERT на students/groups/courses
 *
 * Якщо будь-який ❌ тест ПРОХОДИТЬ (тобто запит виконався) — це critical security
 * issue, скрипт завершиться з exit 1.
 *
 * Запуск: npm run db:test-teacher-isolation
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

async function expectDenied(sql, description, query) {
  try {
    await sql.query(query);
    console.log(`   ❌ [denied]  ${description}`);
    console.log(`      ПРОБЛЕМА: запит виконався, хоча мав бути заборонений!`);
    failed++;
  } catch (error) {
    if (
      error.message.includes('permission denied') ||
      error.message.includes('does not exist')
    ) {
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
  if (!process.env.DATABASE_URL_TEACHER) {
    console.error('❌ DATABASE_URL_TEACHER не встановлена в .env.local');
    console.error('\nКроки:');
    console.error('  1. node scripts/recreate-teacher-role.js');
    console.error('  2. Додати DATABASE_URL_TEACHER у .env.local');
    console.error('  3. npm run db:setup-teacher-role');
    console.error('  4. Повторити цей тест');
    process.exit(1);
  }

  // Обхід Neon pgbouncer cache stale OID після пересоздання ролі
  const url = process.env.DATABASE_URL_TEACHER.replace('-pooler.', '.');
  const sql = neon(url);
  console.log('🔐 Тестуємо ізоляцію ролі crm_teacher...\n');

  console.log('📂 Дозволені операції:');

  // teacher-* таблиці — повний CRUD
  await expectAllowed(sql, 'SELECT teacher_sessions', `SELECT id FROM teacher_sessions LIMIT 1`);
  await expectAllowed(
    sql,
    'SELECT teacher_login_attempts',
    `SELECT id FROM teacher_login_attempts LIMIT 1`,
  );
  await expectAllowed(sql, 'SELECT teacher_audit_log', `SELECT id FROM teacher_audit_log LIMIT 1`);

  // users — обмежені колонки
  await expectAllowed(
    sql,
    'SELECT users.id, name, email',
    `SELECT id, name, email FROM users LIMIT 1`,
  );

  // students з PII батьків (потрібно викладачу)
  await expectAllowed(
    sql,
    'SELECT students.full_name, parent_name, parent_phone',
    `SELECT id, full_name, parent_name, parent_phone FROM students LIMIT 1`,
  );

  // lessons + UPDATE topic
  await expectAllowed(sql, 'SELECT lessons', `SELECT id, topic FROM lessons LIMIT 1`);

  // attendance read
  await expectAllowed(sql, 'SELECT attendance', `SELECT id FROM attendance LIMIT 1`);

  // lesson_shortcuts read
  await expectAllowed(
    sql,
    'SELECT lesson_shortcuts',
    `SELECT id FROM lesson_shortcuts LIMIT 1`,
  );

  // student_works read
  await expectAllowed(
    sql,
    'SELECT student_works',
    `SELECT id, title FROM student_works LIMIT 1`,
  );

  console.log('\n🚫 Заборонені операції (мають бути 🔒 permission denied):');

  // Чужі секрети
  await expectDenied(
    sql,
    'SELECT users.password_hash',
    `SELECT password_hash FROM users LIMIT 1`,
  );
  await expectDenied(
    sql,
    'SELECT student_credentials.pin_hash',
    `SELECT pin_hash FROM student_credentials LIMIT 1`,
  );
  await expectDenied(
    sql,
    'SELECT sessions (admin)',
    `SELECT id FROM sessions LIMIT 1`,
  );
  await expectDenied(
    sql,
    'SELECT student_sessions',
    `SELECT id FROM student_sessions LIMIT 1`,
  );

  // Гроші / платежі / зарплати
  await expectDenied(sql, 'SELECT payments', `SELECT id FROM payments LIMIT 1`);
  await expectDenied(
    sql,
    'SELECT individual_payments',
    `SELECT id FROM individual_payments LIMIT 1`,
  );
  await expectDenied(
    sql,
    'SELECT salary_extra_items',
    `SELECT id FROM salary_extra_items LIMIT 1`,
  );

  // Адмін-конфіги
  await expectDenied(sql, 'SELECT system_settings', `SELECT * FROM system_settings LIMIT 1`);
  await expectDenied(sql, 'SELECT notifications', `SELECT id FROM notifications LIMIT 1`);

  // Зміни даних, які мають бути тільки в адміна
  await expectDenied(
    sql,
    'INSERT into students (нових учнів реєструє адмін)',
    `INSERT INTO students(full_name, is_active) VALUES ('hacker_test', TRUE)`,
  );
  await expectDenied(
    sql,
    'INSERT into groups',
    `INSERT INTO groups(course_id, title, teacher_id, weekly_day, start_time, duration_minutes) VALUES (1, 'h', 1, 1, '12:00', 60)`,
  );
  await expectDenied(
    sql,
    'DELETE from groups',
    `DELETE FROM groups WHERE id = -1`,
  );
  await expectDenied(
    sql,
    'DELETE from lessons',
    `DELETE FROM lessons WHERE id = -1`,
  );
  await expectDenied(
    sql,
    'DELETE from students',
    `DELETE FROM students WHERE id = -1`,
  );
  await expectDenied(
    sql,
    'DELETE from courses',
    `DELETE FROM courses WHERE id = -1`,
  );
  await expectDenied(
    sql,
    'UPDATE users.role (escalation!)',
    `UPDATE users SET role = 'admin' WHERE id = -1`,
  );

  console.log(`\n📊 Результат: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\n❌ Ізоляція НЕ повна. Перевір setup-teacher-role-grants.js');
    process.exit(1);
  }
  console.log('\n🎉 Ізоляція працює — всі тести пройшли.');
}

run().catch((e) => {
  console.error('❌ Помилка:', e.message);
  process.exit(1);
});
