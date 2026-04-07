require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in .env.local');
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log('Ensuring pg_trgm extension...');
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

  console.log('Creating indexes for media_files...');
  await sql`CREATE INDEX IF NOT EXISTS idx_media_files_topic_id ON media_files(topic_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_media_files_topic_created_at ON media_files(topic_id, created_at DESC)`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_media_files_file_name_trgm
    ON media_files
    USING gin (file_name gin_trgm_ops)
  `;

  console.log('Media file indexes are ready.');
}

main().catch((error) => {
  console.error('Failed to add media indexes:', error);
  process.exit(1);
});
