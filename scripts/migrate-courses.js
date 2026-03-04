/**
 * Migration script to add new columns to courses table
 * Run with: node scripts/migrate-courses.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'school.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('Starting courses table migration...');

// Get current columns
const tableInfo = db.pragma('table_info(courses)');
const columns = tableInfo.map(col => col.name);

console.log('Current columns:', columns);

// Add age_label column if not exists
if (!columns.includes('age_label')) {
  console.log('Adding age_label column...');
  db.exec(`ALTER TABLE courses ADD COLUMN age_label TEXT NOT NULL DEFAULT '6+'`);
  console.log('Added age_label column');
} else {
  console.log('age_label column already exists');
}

// Add duration_months column if not exists
if (!columns.includes('duration_months')) {
  console.log('Adding duration_months column...');
  db.exec(`ALTER TABLE courses ADD COLUMN duration_months INTEGER NOT NULL DEFAULT 1`);
  console.log('Added duration_months column');
} else {
  console.log('duration_months column already exists');
}

// Add program column if not exists
if (!columns.includes('program')) {
  console.log('Adding program column...');
  db.exec(`ALTER TABLE courses ADD COLUMN program TEXT`);
  console.log('Added program column');
} else {
  console.log('program column already exists');
}

// Verify the migration
console.log('\nVerifying migration...');
const newTableInfo = db.pragma('table_info(courses)');
console.log('Updated columns:');
newTableInfo.forEach(col => {
  console.log(`  - ${col.name}: ${col.type} (nullable: ${col.notnull === 0}, default: ${col.dflt_value})`);
});

// Show sample data
console.log('\nSample courses after migration:');
const courses = db.prepare('SELECT * FROM courses LIMIT 3').all();
console.log(courses);

db.close();
console.log('\nMigration completed successfully!');