const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('Connecting to Neon PostgreSQL...');
    await client.connect();

    console.log('Running migration: Create lesson_change_logs table');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lesson_change_logs (
        id SERIAL PRIMARY KEY,
        lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        field_name VARCHAR(50) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by INTEGER REFERENCES users(id),
        changed_by_name VARCHAR(255),
        changed_by_telegram_id VARCHAR(50),
        changed_via VARCHAR(20) NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('Created lesson_change_logs table');

    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lesson_change_logs_lesson_id ON lesson_change_logs(lesson_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lesson_change_logs_created_at ON lesson_change_logs(created_at DESC)
    `);
    console.log('Indexes created');

    console.log('Migration successful!');

  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await client.end();
  }
}

runMigration();
