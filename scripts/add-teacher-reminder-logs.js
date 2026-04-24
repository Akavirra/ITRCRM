/**
 * Migration: add teacher_reminder_logs table
 * Used for deduplication of automated teacher notifications
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function run() {
  const client = await pool.connect();

  try {
    // Check if table already exists
    const checkResult = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'teacher_reminder_logs'
    `);

    if (checkResult.rowCount > 0) {
      console.log('Table teacher_reminder_logs already exists');
      return;
    }

    await client.query(`
      CREATE TABLE teacher_reminder_logs (
        id SERIAL PRIMARY KEY,
        lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reminder_type VARCHAR(50) NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        telegram_id TEXT,
        success BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        UNIQUE(lesson_id, teacher_id, reminder_type)
      );

      CREATE INDEX idx_teacher_reminder_logs_lesson ON teacher_reminder_logs(lesson_id);
      CREATE INDEX idx_teacher_reminder_logs_teacher ON teacher_reminder_logs(teacher_id);
      CREATE INDEX idx_teacher_reminder_logs_type ON teacher_reminder_logs(reminder_type);
      CREATE INDEX idx_teacher_reminder_logs_sent_at ON teacher_reminder_logs(sent_at DESC);
    `);

    console.log('Table teacher_reminder_logs created successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
