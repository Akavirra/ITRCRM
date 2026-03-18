require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Adding media_width and media_height columns to media_files...');
  await sql`
    ALTER TABLE media_files
      ADD COLUMN IF NOT EXISTS media_width  INTEGER,
      ADD COLUMN IF NOT EXISTS media_height INTEGER
  `;
  console.log('Done.');
}

migrate().catch(err => { console.error(err); process.exit(1); });
