/**
 * Migration: Add notifications system tables
 *
 * Run with: node scripts/add-notifications.js
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

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL не встановлена в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🚀 Підключення до Neon PostgreSQL...');

  try {
    // notifications table
    const notifExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'notifications' AND column_name = 'id'
    `;

    if (notifExists.length > 0) {
      console.log('ℹ️  Таблиця notifications вже існує — пропускаємо.');
    } else {
      await sql`
        CREATE TABLE notifications (
          id          SERIAL PRIMARY KEY,
          type        VARCHAR(50)  NOT NULL,
          title       TEXT         NOT NULL,
          body        TEXT         NOT NULL,
          link        TEXT,
          data        JSONB,
          is_global   BOOLEAN      NOT NULL DEFAULT TRUE,
          target_user_id INTEGER   REFERENCES users(id) ON DELETE CASCADE,
          created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX idx_notifications_created_at    ON notifications(created_at DESC)`;
      await sql`CREATE INDEX idx_notifications_type          ON notifications(type)`;
      await sql`CREATE INDEX idx_notifications_target_user   ON notifications(target_user_id)`;
      console.log('✅ Таблиця notifications створена');
    }

    // notification_reads table
    const readsExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'notification_reads' AND column_name = 'notification_id'
    `;

    if (readsExists.length > 0) {
      console.log('ℹ️  Таблиця notification_reads вже існує — пропускаємо.');
    } else {
      await sql`
        CREATE TABLE notification_reads (
          notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
          user_id         INTEGER NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
          read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (notification_id, user_id)
        )
      `;
      await sql`CREATE INDEX idx_notif_reads_user ON notification_reads(user_id)`;
      console.log('✅ Таблиця notification_reads створена');
    }

    console.log('\n🎉 Міграція успішна!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
