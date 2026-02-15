/**
 * Backfill public_id for existing rows in courses, groups, and students tables.
 * 
 * Format:
 * - courses -> CRS-XXXXXXXX
 * - groups  -> GRP-XXXXXXXX
 * - students-> STU-XXXXXXXX
 * 
 * XXXXXXXX = uppercase alphanumeric (A-Z,0-9), 8-10 chars.
 * 
 * Uses Node crypto to generate codes.
 * Ensures no duplicates using DB UNIQUE constraint + retry (max 10 attempts per row).
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'school.db');

// Character set for generating random alphanumeric strings (uppercase only)
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Prefixes for each entity type
const PREFIXES = {
  courses: 'CRS',
  groups: 'GRP',
  students: 'STU',
};

// Min and max length for the random part
const MIN_RANDOM_LENGTH = 8;
const MAX_RANDOM_LENGTH = 10;

// Maximum retry attempts per row
const MAX_RETRIES = 10;

/**
 * Generate a random alphanumeric string of specified length
 * Uses Node.js crypto for cryptographically secure random bytes
 */
function generateRandomString(length) {
  const bytes = crypto.randomBytes(length);
  let result = '';
  
  for (let i = 0; i < length; i++) {
    // Use modulo to map byte value to charset index
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
  // Random length between 8 and 10
  const length = MIN_RANDOM_LENGTH + Math.floor(Math.random() * (MAX_RANDOM_LENGTH - MIN_RANDOM_LENGTH + 1));
  const randomPart = generateRandomString(length);
  return `${prefix}-${randomPart}`;
}

/**
 * Backfill public_id for a specific table
 * 
 * @param {Database} db - Database connection
 * @param {string} tableName - Name of the table
 * @param {string} prefix - Prefix for public IDs
 * @returns {Object} Statistics for this table
 */
function backfillTable(db, tableName, prefix) {
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
  const rows = db.prepare(`
    SELECT id FROM ${tableName} 
    WHERE public_id IS NULL OR public_id = ''
  `).all();

  stats.totalRows = rows.length;
  console.log(`Found ${rows.length} rows with missing public_id`);

  if (rows.length === 0) {
    console.log('No rows to update');
    return stats;
  }

  // Prepare update statement
  const updateStmt = db.prepare(`UPDATE ${tableName} SET public_id = ? WHERE id = ?`);

  // Process each row
  for (const row of rows) {
    let success = false;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES && !success; attempt++) {
      const publicId = generatePublicId(prefix);

      try {
        updateStmt.run(publicId, row.id);
        success = true;
        stats.updatedRows++;
        console.log(`  Row ${row.id}: ${publicId} (attempt ${attempt})`);
      } catch (error) {
        lastError = error;
        // Check if it's a unique constraint violation
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || 
            error.message.includes('UNIQUE constraint failed') ||
            error.message.includes('unique')) {
          console.log(`  Row ${row.id}: Duplicate detected on attempt ${attempt}, retrying...`);
        } else {
          console.log(`  Row ${row.id}: Error on attempt ${attempt}: ${error.message}`);
          break; // Non-unique error, don't retry
        }
      }
    }

    if (!success) {
      stats.failedRows++;
      stats.errors.push({
        rowId: row.id,
        error: lastError?.message || 'Unknown error after max retries',
      });
      console.log(`  Row ${row.id}: FAILED after ${MAX_RETRIES} attempts`);
    }
  }

  return stats;
}

/**
 * Add public_id column to a table if it doesn't exist
 * 
 * @param {Database} db - Database connection
 * @param {string} tableName - Name of the table
 */
function ensurePublicIdColumn(db, tableName) {
  const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const columns = tableInfo.map(col => col.name);
  
  if (!columns.includes('public_id')) {
    console.log(`Adding public_id column to ${tableName}...`);
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN public_id TEXT`);
    
    // Create unique index
    try {
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${tableName}_public_id ON ${tableName}(public_id)`);
      console.log(`Created unique index on ${tableName}.public_id`);
    } catch (error) {
      console.log(`Index creation note for ${tableName}: ${error.message}`);
    }
  } else {
    console.log(`public_id column already exists in ${tableName}`);
  }
}

/**
 * Main function to run the backfill
 */
function main() {
  console.log('=== Public ID Backfill Script ===');
  console.log(`Database: ${DB_PATH}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  const allStats = [];

  try {
    // Process tables in order
    // Courses first (groups depend on courses)
    // Groups second (student_groups depend on groups)
    // Students last
    const tables = [
      { name: 'courses', prefix: PREFIXES.courses },
      { name: 'groups', prefix: PREFIXES.groups },
      { name: 'students', prefix: PREFIXES.students },
    ];

    // Ensure public_id column exists in all tables
    console.log('\n=== Ensuring public_id columns exist ===');
    for (const table of tables) {
      ensurePublicIdColumn(db, table.name);
    }

    for (const table of tables) {
      const stats = backfillTable(db, table.name, table.prefix);
      allStats.push(stats);
    }

    // Summary
    console.log('\n=== Summary ===');
    let totalUpdated = 0;
    let totalFailed = 0;

    for (const stats of allStats) {
      console.log(`${stats.table}: ${stats.updatedRows}/${stats.totalRows} updated, ${stats.failedRows} failed`);
      totalUpdated += stats.updatedRows;
      totalFailed += stats.failedRows;

      if (stats.errors.length > 0) {
        console.log(`  Errors:`);
        for (const err of stats.errors) {
          console.log(`    Row ${err.rowId}: ${err.error}`);
        }
      }
    }

    console.log(`\nTotal: ${totalUpdated} rows updated, ${totalFailed} rows failed`);
    console.log(`Finished at: ${new Date().toISOString()}`);

    if (totalFailed > 0) {
      console.log('\nWARNING: Some rows failed to update. Check errors above.');
      process.exitCode = 1;
    }

  } finally {
    db.close();
  }
}

// Run the script
main();