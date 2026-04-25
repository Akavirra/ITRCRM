/**
 * Migration: Teacher Portal — таблиці для окремого веб-кабінету викладачів.
 *
 * Створює:
 *   - teacher_sessions         — сесії викладачів (окремо від `sessions` адмінів)
 *   - teacher_login_attempts   — журнал спроб логіну (для rate limit + аудиту)
 *   - teacher_audit_log        — журнал дій у портaлі викладача
 *
 * Викладач уже існує в `users` (role='teacher') з email + password_hash, тому
 * окрема таблиця credentials НЕ потрібна — переюзаємо існуюче.
 *
 * Адмін керує паролем викладача через звичайну сторінку Викладачі в CRM
 * (POST /api/users/[id]/reset-password).
 *
 * Ізоляція забезпечується окремою Postgres-роллю `crm_teacher` —
 * див. scripts/setup-teacher-role-grants.js.
 *
 * Запуск: npm run db:add-teacher-portal
 *
 * Ідемпотентний.
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
    // -------------------------------------------------------------------
    // 1. teacher_sessions
    // -------------------------------------------------------------------
    if (await tableExists(sql, 'teacher_sessions')) {
      console.log('ℹ️  teacher_sessions вже існує — пропускаємо');
    } else {
      await sql`
        CREATE TABLE teacher_sessions (
          id            TEXT PRIMARY KEY,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at    TIMESTAMPTZ NOT NULL,
          ip            INET,
          user_agent    TEXT
        )
      `;
      await sql`CREATE INDEX idx_teacher_sessions_user ON teacher_sessions(user_id)`;
      await sql`CREATE INDEX idx_teacher_sessions_expires ON teacher_sessions(expires_at)`;
      console.log('✅ teacher_sessions створено');
    }

    // -------------------------------------------------------------------
    // 2. teacher_login_attempts
    // -------------------------------------------------------------------
    if (await tableExists(sql, 'teacher_login_attempts')) {
      console.log('ℹ️  teacher_login_attempts вже існує — пропускаємо');
    } else {
      await sql`
        CREATE TABLE teacher_login_attempts (
          id            BIGSERIAL PRIMARY KEY,
          identifier    TEXT NOT NULL,
          ip            INET NOT NULL,
          success       BOOLEAN NOT NULL,
          attempted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX idx_teacher_login_attempts_ip_time
          ON teacher_login_attempts(ip, attempted_at DESC)
      `;
      await sql`
        CREATE INDEX idx_teacher_login_attempts_identifier_time
          ON teacher_login_attempts(identifier, attempted_at DESC)
      `;
      console.log('✅ teacher_login_attempts створено');
    }

    // -------------------------------------------------------------------
    // 3. teacher_audit_log
    // -------------------------------------------------------------------
    if (await tableExists(sql, 'teacher_audit_log')) {
      console.log('ℹ️  teacher_audit_log вже існує — пропускаємо');
    } else {
      await sql`
        CREATE TABLE teacher_audit_log (
          id          BIGSERIAL PRIMARY KEY,
          user_id     INTEGER NOT NULL,
          action      TEXT NOT NULL,
          meta        JSONB,
          ip          INET,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX idx_teacher_audit_user_time
          ON teacher_audit_log(user_id, created_at DESC)
      `;
      console.log('✅ teacher_audit_log створено');
    }

    console.log('\n🎉 Міграція успішна!');
    console.log('\nНаступні кроки:');
    console.log('  1. node scripts/recreate-teacher-role.js');
    console.log('  2. (скопіювати DATABASE_URL_TEACHER у .env.local)');
    console.log('  3. npm run db:setup-teacher-role');
    console.log('  4. npm run db:test-teacher-isolation');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    if (error.code) console.error('   Код:', error.code);
    process.exit(1);
  }
}

migrate();
