require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Creating media_topics table...');
  await sql`
    CREATE TABLE IF NOT EXISTS media_topics (
      id SERIAL PRIMARY KEY,
      thread_id BIGINT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      drive_folder_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('Creating media_files table...');
  await sql`
    CREATE TABLE IF NOT EXISTS media_files (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES media_topics(id) ON DELETE SET NULL,
      telegram_file_id TEXT NOT NULL,
      telegram_message_id BIGINT,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      drive_file_id TEXT NOT NULL,
      drive_view_url TEXT,
      drive_download_url TEXT,
      uploaded_by_telegram_id BIGINT,
      uploaded_by_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
