require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE notes
        ADD COLUMN IF NOT EXISTS linked_student_id INTEGER DEFAULT NULL REFERENCES students(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS linked_group_id   INTEGER DEFAULT NULL REFERENCES groups(id)   ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS notes_linked_student_idx ON notes(linked_student_id) WHERE linked_student_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS notes_linked_group_idx   ON notes(linked_group_id)   WHERE linked_group_id   IS NOT NULL;
    `);
    console.log('✓ linked_student_id, linked_group_id added to notes');
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
