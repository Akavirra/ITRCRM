/**
 * Database Reset Script for Windows
 * 
 * This script deletes the SQLite database file and recreates it with fresh schema.
 * Run with: npm run db:reset
 * 
 * WARNING: This will delete all data! Only use in development.
 */

const fs = require('fs');
const path = require('path');

// Database path
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'school.db');
const DB_DIR = path.dirname(DB_PATH);

console.log('=== Database Reset Script ===');
console.log('Database path:', DB_PATH);
console.log('');

// Check if we're in production
if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: Cannot reset database in production mode!');
  console.error('Set NODE_ENV=development to allow reset.');
  process.exit(1);
}

// Delete database file if it exists
if (fs.existsSync(DB_PATH)) {
  try {
    fs.unlinkSync(DB_PATH);
    console.log('✓ Database file deleted:', DB_PATH);
  } catch (error) {
    console.error('✗ Failed to delete database file:', error.message);
    console.error('  Make sure no other process is using the database.');
    process.exit(1);
  }
} else {
  console.log('✓ No database file to delete (already clean)');
}

// Delete WAL and SHM files if they exist (SQLite journal files)
const walPath = DB_PATH + '-wal';
const shmPath = DB_PATH + '-shm';

if (fs.existsSync(walPath)) {
  fs.unlinkSync(walPath);
  console.log('✓ Deleted WAL file');
}

if (fs.existsSync(shmPath)) {
  fs.unlinkSync(shmPath);
  console.log('✓ Deleted SHM file');
}

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log('✓ Created data directory:', DB_DIR);
}

console.log('');
console.log('=== Reset Complete ===');
console.log('');
console.log('Next steps:');
console.log('1. Run: npm run dev');
console.log('2. Open: http://localhost:3000/login');
console.log('3. Login with: admin@school.ua / admin123');
console.log('');
