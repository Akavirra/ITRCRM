require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Creating lesson_photo_folders table...');
  await sql`
    CREATE TABLE IF NOT EXISTS lesson_photo_folders (
      lesson_id INTEGER PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
      course_folder_id TEXT NOT NULL,
      group_folder_id TEXT NOT NULL,
      lesson_folder_id TEXT NOT NULL,
      lesson_folder_name TEXT NOT NULL,
      drive_url TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('Creating lesson_photo_files table...');
  await sql`
    CREATE TABLE IF NOT EXISTS lesson_photo_files (
      id SERIAL PRIMARY KEY,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      drive_file_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      uploaded_by_name TEXT,
      uploaded_via VARCHAR(20) NOT NULL DEFAULT 'admin',
      uploaded_by_telegram_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('Creating indexes...');
  await sql`CREATE INDEX IF NOT EXISTS idx_lesson_photo_files_lesson_id ON lesson_photo_files(lesson_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_lesson_photo_files_created_at ON lesson_photo_files(created_at DESC)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_photo_files_drive_file_id ON lesson_photo_files(drive_file_id)`;

  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
