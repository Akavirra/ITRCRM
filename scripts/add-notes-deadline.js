require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS deadline DATE DEFAULT NULL;
    `);
    console.log('✓ deadline column added to notes');
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
