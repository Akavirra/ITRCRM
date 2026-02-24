#!/usr/bin/env node

/**
 * Backfill public_id for existing rows in courses, groups, students, and lessons tables for Neon PostgreSQL.
 * 
 * Format:
 * - courses -> CRS-XXXXXXXX
 * - groups  -> GRP-XXXXXXXX
 * - students-> STU-XXXXXXXX
 * - lessons -> LSN-XXXXXXXX
 * 
 * XXXXXXXX = uppercase alphanumeric (A-Z,0-9), 8-10 chars.
 * 
 * Uses Node crypto to generate codes.
 * Ensures no duplicates using DB UNIQUE constraint + retry (max 10 attempts per row).
 */

require('dotenv').config();
const { Client } = require('pg');

// Character set for generating random alphanumeric strings (uppercase only)
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Prefixes for each entity type
const PREFIXES = {
  courses: 'CRS',
  groups: 'GRP',
  students: 'STU',
  lessons: 'LSN',
};

// Min and max length for the random part
const MIN_RANDOM_LENGTH = 8;
const MAX_RANDOM_LENGTH = 10;

// Maximum retry attempts per row
const MAX_RETRIES = 10;

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

/**
 * Generate a random alphanumeric string of specified length
 * Uses Node.js crypto for cryptographically secure random bytes
 */
function generateRandomString(length) {
  const bytes = require('crypto').randomBytes(length);
  let result = '';
  
  for (let i = 0; i < length; i++) {
    const index = bytes[i] % CHARSET.length;
    result += CHARSET[index];
  }
  
  return result;
}

/**
 * Generate a public ID for a specific entity type
 * Format: PREFIX-XXXXXXXX (e.g., STU-A1B2C3D4)
 * 
 * @param {string} prefix - The prefix for the entity type
 * @returns {string} A unique public ID string
 */
function generatePublicId(prefix) {
  const length = MIN_RANDOM_LENGTH + Math.floor(Math.random() * (MAX_RANDOM_LENGTH - MIN_RANDOM_LENGTH + 1));
  const randomPart = generateRandomString(length);
  return `${prefix}-${randomPart}`;
}

/**
 * Backfill public_id for a specific table
 * 
 * @param {string} tableName - Name of the table
 * @param {string} prefix - Prefix for public IDs
 * @returns {Object} Statistics for this table
 */
async function backfillTable(tableName, prefix) {
  const stats = {
    table: tableName,
    totalRows: 0,
    updatedRows: 0,
    skippedRows: 0,
    failedRows: 0,
    errors: [],
  };

  console.log(`\n=== Processing table: ${tableName} ===`);

  // Find rows with NULL or empty public_id
  try {
    const result = await client.query(`
      SELECT id FROM ${tableName} 
      WHERE public_id IS NULL OR public_id = ''
    `);
    
    stats.totalRows = result.rows.length;
    console.log(`Found ${result.rows.length} rows with missing public_id`);

    if (result.rows.length === 0) {
      console.log('No rows to update');
      return stats;
    }

    // Update each row
    for (const row of result.rows) {
      let retryCount = 0;
      
      while (retryCount < MAX_RETRIES) {
        try {
          const publicId = generatePublicId(prefix);
          
          await client.query(`
            UPDATE ${tableName} 
            SET public_id = $1 
            WHERE id = $2
          `, [publicId, row.id]);
          
          stats.updatedRows++;
          break; // Success, move to next row
          
        } catch (error) {
          if (error.code === '23505') { // Unique violation
            console.log(`Collision for row ${row.id}, retry ${retryCount + 1} of ${MAX_RETRIES}`);
            retryCount++;
          } else {
            console.error(`Error updating row ${row.id}:`, error.message);
            stats.failedRows++;
            stats.errors.push(`Row ${row.id}: ${error.message}`);
            break; // Fatal error, move to next row
          }
        }
      }
      
      if (retryCount === MAX_RETRIES) {
        console.error(`Failed to update row ${row.id} after ${MAX_RETRIES} attempts`);
        stats.failedRows++;
        stats.errors.push(`Row ${row.id}: Failed after ${MAX_RETRIES} attempts`);
      }
    }

    console.log(`Updated ${stats.updatedRows} rows`);
    if (stats.skippedRows > 0) {
      console.log(`Skipped ${stats.skippedRows} rows`);
    }
    if (stats.failedRows > 0) {
      console.log(`Failed to update ${stats.failedRows} rows`);
    }

  } catch (error) {
    console.error(`Error processing table ${tableName}:`, error.message);
    stats.errors.push(error.message);
    stats.failedRows = stats.totalRows;
  }

  return stats;
}

/**
 * Ensure public_id column exists and has unique index
 * 
 * @param {string} tableName - Name of the table
 */
async function ensurePublicIdColumn(tableName) {
  try {
    const result = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = 'public_id'
    `, [tableName]);
    
    if (result.rows.length === 0) {
      console.log(`Adding public_id column to ${tableName}...`);
      await client.query(`
        ALTER TABLE ${tableName} ADD COLUMN public_id TEXT UNIQUE
      `);
      
      console.log(`Created unique index on ${tableName}.public_id`);
    } else {
      console.log(`public_id column already exists in ${tableName}`);
    }
  } catch (error) {
    console.error(`Error checking/adding public_id column for ${tableName}:`, error.message);
  }
}

/**
 * Main function to run the backfill
 */
async function main() {
  console.log('=== Public ID Backfill Script ===');
  console.log(`Database: ${process.env.DATABASE_URL}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  try {
    // Connect to database
    await client.connect();
    console.log('Connected to database');

    const allStats = [];

    // Process tables in order
    const tables = [
      { name: 'courses', prefix: PREFIXES.courses },
      { name: 'groups', prefix: PREFIXES.groups },
      { name: 'students', prefix: PREFIXES.students },
      { name: 'lessons', prefix: PREFIXES.lessons },
    ];

    // Ensure public_id column exists in all tables
    console.log('\n=== Ensuring public_id columns exist ===');
    for (const table of tables) {
      await ensurePublicIdColumn(table.name);
    }

    // Backfill each table
    for (const table of tables) {
      const stats = await backfillTable(table.name, table.prefix);
      allStats.push(stats);
    }

    // Print summary
    console.log('\n=== Summary ===');
    console.log(`Total tables processed: ${allStats.length}`);
    
    let totalUpdated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    
    allStats.forEach(stats => {
      totalUpdated += stats.updatedRows;
      totalFailed += stats.failedRows;
      totalSkipped += stats.skippedRows;
      
      console.log(`\n${stats.table}:`);
      console.log(`  Updated:   ${stats.updatedRows}`);
      console.log(`  Skipped:   ${stats.skippedRows}`);
      console.log(`  Failed:    ${stats.failedRows}`);
      
      if (stats.errors.length > 0) {
        console.log(`  Errors:    ${stats.errors.length}`);
        stats.errors.forEach(err => {
          console.log(`    - ${err}`);
        });
      }
    });
    
    console.log(`\n=== Total ===`);
    console.log(`Updated:   ${totalUpdated}`);
    console.log(`Skipped:   ${totalSkipped}`);
    console.log(`Failed:    ${totalFailed}`);
    
    if (totalFailed === 0) {
      console.log('\n✅ All updates successful');
    } else {
      console.log(`\n⚠️  ${totalFailed} updates failed`);
    }

  } catch (error) {
    console.error('Critical error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log(`\nFinished at: ${new Date().toISOString()}`);
  }
}

// Run
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
