/**
 * Налаштування Postgres-ролі crm_teacher — обмежені GRANT-и для teacher-порталу.
 *
 * ПЕРЕДУМОВА: роль crm_teacher уже створена через scripts/recreate-teacher-role.js
 * (важливо: НЕ через Neon Console — інакше потрапить у neon_superuser).
 *
 * ФІЛОСОФІЯ: викладач — внутрішній користувач, але компрометація teacher-сесії
 * дає доступ до даних 50-100 учнів (PII, оцінки). Тому GRANT-и явні і обмежені.
 *
 * ЩО ДОЗВОЛЕНО:
 *   - повний CRUD на teacher_sessions, teacher_login_attempts, teacher_audit_log
 *   - SELECT + UPDATE на attendance / lessons (теми, статус)
 *   - SELECT на свої групи + учнів у них
 *   - SELECT/INSERT/UPDATE/DELETE на lesson_shortcuts (свої заняття)
 *   - SELECT на lesson_photo_files + INSERT/DELETE (галерея заняття)
 *   - SELECT на student_works (перевірка робіт учнів)
 *   - SELECT на student_marks + INSERT/UPDATE (виставлення оцінок) — на майбутнє
 *   - SELECT/UPDATE на власний профіль у users (фото, ім'я, password_hash)
 *
 * ЩО ЗАБОРОНЕНО:
 *   - DELETE на groups, lessons, students, courses (тільки адмін може видалити)
 *   - INSERT на students, groups (тільки адмін реєструє)
 *   - SELECT на чужих викладачів (тільки своя role='teacher' рядка)
 *   - Жодного доступу до payments, salary_*, enrollment_*, camp_*,
 *     student_credentials, student_codes, sessions (адмінських), notifications
 *
 * ВАЖЛИВО: фільтр "тільки свої групи/учні" робиться на рівні SQL у код-домені,
 * НЕ через RLS. crm_teacher має NOBYPASSRLS, але RLS-policies ми не вмикаємо
 * (як і в crm_student). Захист на рівні коду + GRANT-обмежень достатньо.
 *
 * Запуск: npm run db:setup-teacher-role
 *
 * Ідемпотентний — повторно виконається коректно (REVOKE ALL → нові GRANT-и).
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

const ROLE = 'crm_teacher';

// Повний CRUD — таблиці порталу викладача
const FULL_ACCESS_TABLES = [
  'teacher_sessions',
  'teacher_login_attempts',
  'teacher_audit_log',
];

// Тільки SELECT — read-only довідники
const READ_ONLY_TABLES = [
  'courses',
  'student_groups',
  'group_teacher_assignments',
  'lesson_teacher_replacements',
];

// Tables with mixed access — кожен указує свої колонки + дії
// Формат: { table: { select?, insert?, update?, delete? } }
const MIXED_ACCESS = {
  // Власний профіль викладача (фільтр id=current у коді).
  // INSERT не даємо (нових користувачів створює адмін).
  // DELETE не даємо.
  users: {
    select: [
      'id',
      'public_id',
      'name',
      'email',
      'role',
      'phone',
      'telegram_id',
      'photo_url',
      'is_active',
      'created_at',
    ],
    update: ['name', 'phone', 'photo_url', 'password_hash'],
  },
  // Групи: SELECT повний (для відображення розкладу), UPDATE заборонено
  // (адмін керує). Викладач може лише оновити topic/status у lessons.
  groups: {
    select: [
      'id',
      'public_id',
      'course_id',
      'title',
      'teacher_id',
      'weekly_day',
      'start_time',
      'duration_minutes',
      'timezone',
      'start_date',
      'end_date',
      'status',
      'price',
      'is_active',
      'weather_city',
    ],
  },
  // Учні: SELECT повний (з PII батьків — викладачу треба для зв'язку).
  // INSERT/DELETE заборонено.
  students: {
    select: [
      'id',
      'public_id',
      'full_name',
      'photo',
      'birth_date',
      'parent_name',
      'parent_phone',
      'parent2_phone',
      'parent_email',
      'gender',
      'notes',
      'is_active',
      'created_at',
    ],
  },
  // Заняття: SELECT повний + UPDATE на тему/статус/нотатки/фактичні дати
  // (викладач веде урок). Створення/видалення лишається адміну.
  lessons: {
    select: [
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
      'teacher_id',
      'original_date',
      'cancellation_reason',
      'actual_start_at',
      'actual_end_at',
      'notes',
    ],
    update: [
      'topic',
      'status',
      'actual_start_at',
      'actual_end_at',
      'notes',
    ],
  },
  // Присутність: викладач відмічає (INSERT/UPDATE/DELETE — є випадки коли треба
  // видалити помилкову позначку). DELETE даємо обмежено через код.
  attendance: {
    select: ['id', 'lesson_id', 'student_id', 'status', 'comment', 'is_trial', 'created_at'],
    insert: ['lesson_id', 'student_id', 'status', 'comment', 'is_trial'],
    update: ['status', 'comment'],
    delete: true,
  },
  // Ярлики (Phase D.1): викладач керує своїми
  lesson_shortcuts: {
    select: [
      'id',
      'lesson_id',
      'kind',
      'label',
      'target',
      'icon',
      'sort_order',
      'created_by_user',
      'created_by_name',
      'created_at',
      'updated_at',
    ],
    insert: [
      'lesson_id',
      'kind',
      'label',
      'target',
      'icon',
      'sort_order',
      'created_by_user',
      'created_by_name',
    ],
    update: ['kind', 'label', 'target', 'icon', 'sort_order', 'updated_at'],
    delete: true,
  },
  // Галерея заняття: викладач читає всі поля + може додавати/видаляти.
  // (Завантаження файлу до Drive — окремий flow через upload-service.)
  lesson_photo_files: {
    select: [
      'id',
      'lesson_id',
      'drive_file_id',
      'file_name',
      'mime_type',
      'file_size',
      'uploaded_by',
      'uploaded_by_name',
      'uploaded_via',
      'uploaded_by_telegram_id',
      'created_at',
    ],
    insert: [
      'lesson_id',
      'drive_file_id',
      'file_name',
      'mime_type',
      'file_size',
      'uploaded_by',
      'uploaded_by_name',
      'uploaded_via',
    ],
    delete: true,
  },
  lesson_photo_folders: {
    select: ['lesson_id', 'lesson_folder_id', 'lesson_folder_name', 'drive_url'],
  },
  // Роботи учнів: викладач читає (перевірка), не пише (учень сам завантажує).
  student_works: {
    select: [
      'id',
      'student_id',
      'course_id',
      'lesson_id',
      'title',
      'description',
      'storage_url',
      'storage_kind',
      'mime_type',
      'size_bytes',
      'status',
      'deleted_at',
      'created_at',
      'updated_at',
    ],
  },
  // Оцінки (на майбутнє): викладач виставляє учням своїх груп
  student_marks: {
    select: ['id', 'student_id', 'lesson_id', 'work_id', 'value', 'comment', 'given_by', 'created_at'],
    insert: ['student_id', 'lesson_id', 'work_id', 'value', 'comment', 'given_by'],
    update: ['value', 'comment'],
    delete: true,
  },
  // Аудит занять — read-only (викладач бачить історію змін)
  audit_events: {
    select: [
      'id',
      'entity_type',
      'entity_id',
      'action',
      'actor_user_id',
      'actor_name',
      'meta',
      'created_at',
    ],
  },
};

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL не встановлена в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🚀 Підключення до Neon (admin)...');

  try {
    // 0. Перевірити що роль існує
    const [roleRow] = await sql`
      SELECT rolname FROM pg_roles WHERE rolname = ${ROLE}
    `;
    if (!roleRow) {
      console.error(`❌ Роль "${ROLE}" не знайдена.`);
      console.error('   Створіть її через: node scripts/recreate-teacher-role.js');
      process.exit(1);
    }
    console.log(`✅ Роль "${ROLE}" знайдена`);

    // 0.5. NOINHERIT (страховка — мало бути встановлено при створенні)
    console.log('\n🛡️  Підтверджуємо NOINHERIT...');
    try {
      await sql.query(`ALTER ROLE ${ROLE} NOINHERIT`);
      console.log('   ✅ NOINHERIT підтверджено');
    } catch (e) {
      console.log('   ⚠️  NOINHERIT:', e.message);
    }

    // 1. Очистити попередні дозволи
    console.log('\n🧹 Очищуємо попередні дозволи...');
    await sql.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ROLE}`);
    await sql.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${ROLE}`);
    await sql.query(`REVOKE ALL ON SCHEMA public FROM ${ROLE}`);
    await sql.query(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
    console.log('✅ Очищено, USAGE на схему public надано');

    // 2. CRUD на teacher_* таблиці
    console.log('\n📝 Надаємо CRUD на teacher-* таблиці...');
    for (const table of FULL_ACCESS_TABLES) {
      await sql.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${ROLE}`);
      console.log(`   ✅ ${table}`);
    }

    // 3. SELECT на read-only довідники
    console.log('\n📖 Надаємо SELECT на read-only таблиці...');
    for (const table of READ_ONLY_TABLES) {
      await sql.query(`GRANT SELECT ON ${table} TO ${ROLE}`);
      console.log(`   ✅ ${table}`);
    }

    // 4. Mixed access — column-level GRANT-и
    console.log('\n🔍 Надаємо обмежені GRANT-и на mixed-access таблиці...');
    for (const [table, perms] of Object.entries(MIXED_ACCESS)) {
      const summary = [];
      if (perms.select) {
        await sql.query(`GRANT SELECT (${perms.select.join(', ')}) ON ${table} TO ${ROLE}`);
        summary.push(`SELECT(${perms.select.length} col)`);
      }
      if (perms.insert) {
        await sql.query(`GRANT INSERT (${perms.insert.join(', ')}) ON ${table} TO ${ROLE}`);
        summary.push(`INSERT(${perms.insert.length} col)`);
      }
      if (perms.update) {
        await sql.query(`GRANT UPDATE (${perms.update.join(', ')}) ON ${table} TO ${ROLE}`);
        summary.push(`UPDATE(${perms.update.length} col)`);
      }
      if (perms.delete) {
        await sql.query(`GRANT DELETE ON ${table} TO ${ROLE}`);
        summary.push('DELETE');
      }
      console.log(`   ✅ ${table}: ${summary.join(' + ')}`);
    }

    // 5. USAGE на sequences (для INSERT з autogen id)
    console.log('\n🔢 Надаємо USAGE на потрібні sequences...');
    const sequenceRows = await sql.query(`
      SELECT sequence_name FROM information_schema.sequences
      WHERE sequence_schema = 'public'
        AND (
          sequence_name LIKE 'teacher_%'
          OR sequence_name LIKE 'attendance_%'
          OR sequence_name LIKE 'lesson_shortcuts_%'
          OR sequence_name LIKE 'lesson_photo_files_%'
          OR sequence_name LIKE 'student_marks_%'
        )
    `);
    for (const row of sequenceRows) {
      const seqName = row.sequence_name;
      await sql.query(`GRANT USAGE, SELECT ON SEQUENCE ${seqName} TO ${ROLE}`);
      console.log(`   ✅ ${seqName}`);
    }

    console.log('\n🎉 GRANT-и для crm_teacher налаштовано!');
    console.log('\nПеревірка ізоляції:');
    console.log('   npm run db:test-teacher-isolation');
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    if (error.code) console.error('   Код:', error.code);
    process.exit(1);
  }
}

run();
