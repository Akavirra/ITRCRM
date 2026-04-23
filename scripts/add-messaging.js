/**
 * Migration: Add messaging campaigns, templates and delivery tracking.
 *
 * Run with: node scripts/add-messaging.js
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
    console.error('DATABASE_URL не встановлена в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Підключення до Neon PostgreSQL...');

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS message_templates (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'telegram', 'viber')),
        subject TEXT,
        body TEXT NOT NULL,
        variables JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_message_templates_channel_active ON message_templates(channel, is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_message_templates_updated_at ON message_templates(updated_at DESC)`;
    console.log('Таблиця message_templates готова');

    await sql`
      CREATE TABLE IF NOT EXISTS message_campaigns (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name TEXT NOT NULL,
        channel TEXT NOT NULL CHECK (channel IN ('email', 'telegram', 'viber')),
        provider TEXT,
        template_id INTEGER REFERENCES message_templates(id) ON DELETE SET NULL,
        subject TEXT,
        body TEXT NOT NULL,
        audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
        total_count INTEGER NOT NULL DEFAULT 0,
        sent_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_message_campaigns_created_at ON message_campaigns(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_message_campaigns_status ON message_campaigns(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_message_campaigns_channel ON message_campaigns(channel)`;
    console.log('Таблиця message_campaigns готова');

    await sql`
      CREATE TABLE IF NOT EXISTS message_recipients (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        campaign_id INTEGER NOT NULL REFERENCES message_campaigns(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
        channel TEXT NOT NULL CHECK (channel IN ('email', 'telegram', 'viber')),
        address TEXT,
        recipient_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
        provider_message_id TEXT,
        error TEXT,
        rendered_subject TEXT,
        rendered_body TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_message_recipients_campaign ON message_recipients(campaign_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_message_recipients_student ON message_recipients(student_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_message_recipients_status ON message_recipients(status)`;
    console.log('Таблиця message_recipients готова');

    await sql`
      CREATE TABLE IF NOT EXISTS message_suppression_list (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        channel TEXT NOT NULL CHECK (channel IN ('email', 'telegram', 'viber')),
        address TEXT NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (channel, address)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_message_suppression_channel ON message_suppression_list(channel)`;
    console.log('Таблиця message_suppression_list готова');

    await sql`
      INSERT INTO message_templates (name, channel, subject, body, variables)
      SELECT
        'Оголошення для батьків',
        'email',
        'Важлива інформація від ITRobotics',
        'Вітаємо, {{parentName}}!\n\nПовідомляємо важливу інформацію щодо навчання {{studentName}}.\n\nГрупи: {{groups}}\n\nЗ повагою,\nITRobotics',
        '["studentName","parentName","studentEmail","school","groups","courses"]'::jsonb
      WHERE NOT EXISTS (
        SELECT 1 FROM message_templates
        WHERE channel = 'email' AND name = 'Оголошення для батьків'
      )
    `;

    await sql`
      INSERT INTO message_templates (name, channel, subject, body, variables)
      SELECT
        'Нагадування про оплату',
        'email',
        'Нагадування про оплату навчання',
        'Вітаємо, {{parentName}}!\n\nНагадуємо про оплату навчання для {{studentName}}.\n\nГрупи: {{groups}}\n\nЯкщо оплату вже здійснено, дякуємо і просимо не зважати на це повідомлення.',
        '["studentName","parentName","studentEmail","school","groups","courses"]'::jsonb
      WHERE NOT EXISTS (
        SELECT 1 FROM message_templates
        WHERE channel = 'email' AND name = 'Нагадування про оплату'
      )
    `;
    console.log('Базові шаблони готові');

    console.log('Міграція messaging успішна');
  } catch (error) {
    console.error('Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
