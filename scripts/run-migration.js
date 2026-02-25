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

    console.log('Running migration: ALTER TABLE attendance ALTER COLUMN updated_by DROP NOT NULL');
    await client.query('ALTER TABLE attendance ALTER COLUMN updated_by DROP NOT NULL');
    console.log('Migration successful!');

  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await client.end();
  }
}

runMigration();
