/**
 * Migration: Student Portal — створення всіх таблиць для окремого порталу учнів.
 *
 * Створює:
 *   - student_codes            — унікальний код учня (формат R0042), окремо від students.id
 *   - student_credentials      — bcrypt-хеш PIN-у (6 цифр)
 *   - student_sessions         — сесії учнів (окремо від sessions адмінів)
 *   - student_login_attempts   — журнал спроб логіну (для rate limit + аудиту)
 *   - student_works            — роботи учнів (файли в Nextcloud), з draft/submitted + soft-delete
 *   - student_notes            — нотатки учнів
 *   - student_marks            — оцінки від адмінів (учень читає, ставить адмін)
 *   - student_audit_log        — журнал дій учня
 *
 * Ізоляція від адмінської CRM забезпечується окремою Postgres-роллю crm_student —
 * див. scripts/setup-student-role-grants.js.
 *
 * Запуск: npm run db:add-student-portal
 *
 * Ідемпотентна — можна виконувати кілька разів, існуючі таблиці пропускаються.
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

async function tableExists(sql, tableName) {
  const rows = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName}
  `;
  return rows.length > 0;
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL не встановлена в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🚀 Підключення до Neon PostgreSQL...');

  try {
    // ---------------------------------------------------------------------
    // 1. student_codes — публічний код учня (R0042), окремо від students.id
    // ---------------------------------------------------------------------
    if (await tableExists(sql, 'student_codes')) {
      console.log('ℹ️  student_codes вже існує — пропускаємо');
    } else {
      await sql`
        CREATE TABLE student_codes (
          id          SERIAL PRIMARY KEY,
          student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          code        TEXT NOT NULL UNIQUE,
          is_active   BOOLEAN NOT NULL DEFAULT TRUE,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          revoked_at  TIMESTAMPTZ,
          created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
        )
      `;
      await sql`
        CREATE UNIQUE INDEX uniq_active_code_per_student
          ON student_codes(student_id) WHERE is_active = TRUE
      `;
      await sql`CREATE INDEX idx_student_codes_code ON student_codes(code)`;
      console.log('✅ student_codes створено');
    }

    // ---------------------------------------------------------------------
    // 2. student_credentials — bcrypt-хеш PIN-у
    // ---------------------------------------------------------------------
    if (await tableExists(sql, 'student_credentials')) {
      console.log('ℹ️  student_credentials вже існує — пропускаємо');
    } else {
      await sql`
        CREATE TABLE student_credentials (
          id           SERIAL PRIMARY KEY,
          student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          pin_hash     TEXT NOT NULL,
          pin_last2    CHAR(2) NOT NULL,
          is_active    BOOLEAN NOT NULL DEFAULT TRUE,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          revoked_at   TIMESTAMPTZ,
          created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL
        )
      `;
      await sql`
        CREATE UNIQUE INDEX uniq_active_pin_per_student
          ON student_credentials(student_id) WHERE is_active = TRUE
      `;
      console.log('✅ student_credentials створено');
    }

    // ---------------------------------------------------------------------
    // 3. student_sessions — сесії учнів (ID як text, за патерном sessions)
    // ---------------------------------------------------------------------
    if (await tableExists(sql, 'student_sessions')) {
      console.log('ℹ️  student_sessions вже існує — пропускаємо');
    } else {
      await sql`
        CREATE TABLE student_sessions (
          id            TEXT PRIMARY KEY,
          student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at    TIMESTAMPTZ NOT NULL,
          ip            INET,
          user_agent    TEXT
        )
      `;
      await sql`CREATE INDEX idx_student_sessions_student ON student_sessions(student_id)`;
      await sql`CREATE INDEX idx_student_sessions_expires ON student_sessions(expires_at)`;
      console.log('✅ student_sessions створено');
    }

    // ---------------------------------------------------------------------
    // 4. student_login_attempts — журнал спроб (для rate limit)
    // ---------------------------------------------------------------------
    if (await tableExists(sql, 'student_login_attempts')) {
      console.log('ℹ️  student_login_attempts вже існує — пропускаємо');
    } else {
      await sql`
        CREATE TABLE student_login_attempts (
          id            BIGSERIAL PRIMARY KEY,
          identifier    TEXT NOT NULL,
          ip            INET NOT NULL,
          success       BOOLEAN NOT NULL,
          attempted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX idx_login_attempts_ip_time ON student_login_attempts(ip, attempted_at DESC)`;
      await sql`CREATE INDEX idx_login_attempts_identifier_time ON student_login_attempts(identifier, attempted_at DESC)`;
      console.log('✅ student_login_attempts створено');
    }

    // ---------------------------------------------------------------------
    // 5. student_works — роботи учнів
    // ---------------------------------------------------------------------
    if (await tableExists(sql, 'student_works')) {
      console.log('ℹ️  student_works вже існує — пропускаємо');
    } else {
      await sql`
        CREATE TABLE student_works (
          id                    SERIAL PRIMARY KEY,
          student_id            INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          course_id             INTEGER REFERENCES courses(id) ON DELETE SET NULL,
          lesson_id             INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
          title                 TEXT NOT NULL,
          description           TEXT,
          storage_url           TEXT NOT NULL,
          storage_kind          TEXT NOT NULL,
          mime_type             TEXT,
          size_bytes            BIGINT,
          status                TEXT NOT NULL DEFAULT 'submitted',
          deleted_at            TIMESTAMPTZ,
          deleted_by_student    BOOLEAN NOT NULL DEFAULT FALSE,
          created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT student_works_status_check CHECK (status IN ('draft', 'submitted')),
          CONSTRAINT student_works_storage_kind_check
            CHECK (storage_kind IN ('nextcloud', 'cloudinary', 'external'))
        )
      `;
      await sql`CREATE INDEX idx_student_works_student_created
        ON student_works(student_id, created_at DESC) WHERE deleted_at IS NULL`;
      await sql`CREATE INDEX idx_student_works_lesson ON student_works(lesson_id) WHERE lesson_id IS NOT NULL`;
      await sql`CREATE INDEX idx_student_works_course ON student_works(course_id) WHERE course_id IS NOT NULL`;
      console.log('✅ student_works створено');
    }

    // ---------------------------------------------------------------------
    // 6. student_notes — нотатки учня
    // ---------------------------------------------------------------------
    if (await tableExists(sql, 'student_notes')) {
      console.log('ℹ️  student_notes вже існує — пропускаємо');
    } else {
      await sql`
        CREATE TABLE student_notes (
          id          SERIAL PRIMARY KEY,
          student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          lesson_id   INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
          body        TEXT NOT NULL,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX idx_student_notes_student_updated
        ON student_notes(student_id, updated_at DESC)`;
      console.log('✅ student_notes створено');
    }

    // ---------------------------------------------------------------------
    // 7. student_marks — оцінки (адмін ставить, учень читає)
    // ---------------------------------------------------------------------
    if (await tableExists(sql, 'student_marks')) {
      console.log('ℹ️  student_marks вже існує — пропускаємо');
    } else {
      await sql`
        CREATE TABLE student_marks (
          id          SERIAL PRIMARY KEY,
          student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          lesson_id   INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
          work_id     INTEGER REFERENCES student_works(id) ON DELETE SET NULL,
          value       TEXT NOT NULL,
          comment     TEXT,
          given_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX idx_student_marks_student_created
        ON student_marks(student_id, created_at DESC)`;
      console.log('✅ student_marks створено');
    }

    // ---------------------------------------------------------------------
    // 8. student_audit_log — журнал дій учня
    // ---------------------------------------------------------------------
    if (await tableExists(sql, 'student_audit_log')) {
      console.log('ℹ️  student_audit_log вже існує — пропускаємо');
    } else {
      await sql`
        CREATE TABLE student_audit_log (
          id          BIGSERIAL PRIMARY KEY,
          student_id  INTEGER NOT NULL,
          action      TEXT NOT NULL,
          meta        JSONB,
          ip          INET,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX idx_student_audit_student_time
        ON student_audit_log(student_id, created_at DESC)`;
      console.log('✅ student_audit_log створено');
    }

    console.log('\n🎉 Міграція успішна!');
    console.log('\nНаступний крок:');
    console.log('  1. Створити роль crm_student у Neon Console (https://console.neon.tech)');
    console.log('  2. Додати DATABASE_URL_STUDENT у .env.local і Vercel env vars');
    console.log('  3. Запустити: npm run db:setup-student-role');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    if (error.code) console.error('   Код:', error.code);
    process.exit(1);
  }
}

migrate();
