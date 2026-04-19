/**
 * Діагностика — показує, якою роллю реально ходить DATABASE_URL_STUDENT
 * і в яких groups/roles ця роль складається (bypass ізоляції через успадкування).
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

async function run() {
  if (!process.env.DATABASE_URL_STUDENT) {
    console.error('❌ DATABASE_URL_STUDENT не встановлена');
    process.exit(1);
  }

  // Обхід pgbouncer cache: прибираємо -pooler з host
  const directUrl = process.env.DATABASE_URL_STUDENT.replace('-pooler.', '.');
  console.log('🔌 URL:', directUrl.replace(/:[^:@]+@/, ':****@'));

  const sql = neon(directUrl);

  // 1. Хто ми насправді
  const [me] = await sql.query(`SELECT current_user, session_user, current_database()`);
  console.log('\n🔍 Реальне підключення:');
  console.log('   current_user     =', me.current_user);
  console.log('   session_user     =', me.session_user);
  console.log('   current_database =', me.current_database);

  // 2. Чи ми superuser / rolbypassrls
  const [rights] = await sql.query(`
    SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolinherit
    FROM pg_roles WHERE rolname = current_user
  `);
  console.log('\n🔍 Прапорці ролі:');
  console.log('   rolsuper       =', rights.rolsuper, '(має бути false)');
  console.log('   rolbypassrls   =', rights.rolbypassrls, '(має бути false)');
  console.log('   rolinherit     =', rights.rolinherit, '(для direct GRANTs не критично)');
  console.log('   rolcreaterole  =', rights.rolcreaterole, '(має бути false)');

  // 3. У які ролі ми входимо (memberships)
  const members = await sql.query(`
    SELECT r.rolname AS member_of
    FROM pg_auth_members m
    JOIN pg_roles r ON r.oid = m.roleid
    JOIN pg_roles u ON u.oid = m.member
    WHERE u.rolname = current_user
  `);
  console.log('\n🔍 Membership (успадкування ролей):');
  if (members.length === 0) {
    console.log('   (нема — добре)');
  } else {
    for (const m of members) {
      console.log('   ⚠️ входить у:', m.member_of);
    }
  }

  // 4. Чи ми володіємо якимись таблицями
  const owned = await sql.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tableowner = current_user
    LIMIT 5
  `);
  console.log('\n🔍 Таблиці, якими володіє ця роль (має бути 0):');
  if (owned.length === 0) {
    console.log('   (нема — добре)');
  } else {
    for (const o of owned) console.log('   ⚠️', o.tablename);
  }

  // 5. Перевірка прямих grants: чи has_table_privilege каже що у нас є SELECT
  const probe = await sql.query(`
    SELECT
      has_table_privilege(current_user, 'public.student_sessions', 'SELECT') AS student_sessions_select,
      has_table_privilege(current_user, 'public.student_works',    'SELECT') AS student_works_select,
      has_table_privilege(current_user, 'public.students',         'SELECT') AS students_select_any,
      has_table_privilege(current_user, 'public.users',            'SELECT') AS users_select_should_be_false
  `);
  console.log('\n🔍 has_table_privilege (що каже планувальник):');
  console.log('   student_sessions  SELECT =', probe[0].student_sessions_select, '(має бути true)');
  console.log('   student_works     SELECT =', probe[0].student_works_select, '(має бути true)');
  console.log('   students          SELECT =', probe[0].students_select_any, '(true якщо є хоч одна колонка)');
  console.log('   users             SELECT =', probe[0].users_select_should_be_false, '(має бути false)');
}

run().catch((e) => { console.error('❌', e.message); process.exit(1); });
