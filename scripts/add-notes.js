require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       TEXT NOT NULL DEFAULT 'note',
        title      TEXT NOT NULL DEFAULT '',
        content    TEXT NOT NULL DEFAULT '',
        tasks      JSONB NOT NULL DEFAULT '[]',
        color      TEXT DEFAULT NULL,
        is_pinned  BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
    `);
    console.log('✓ notes table created');
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
