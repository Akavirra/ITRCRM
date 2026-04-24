/**
 * Migration: add teacher notification settings to system_settings
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const DEFAULTS = [
  { key: 'teacher_daily_reminders_enabled', value: '1' },
  { key: 'teacher_daily_reminders_time', value: '09:00' },
  { key: 'teacher_hourly_reminders_enabled', value: '1' },
  { key: 'teacher_hourly_reminders_before_minutes', value: '60' },
  { key: 'teacher_new_lesson_notify_enabled', value: '1' },
];

async function run() {
  const client = await pool.connect();

  try {
    for (const item of DEFAULTS) {
      await client.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO NOTHING`,
        [item.key, item.value]
      );
      console.log(`Setting ${item.key} = ${item.value}`);
    }

    console.log('Teacher notification settings migrated successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
