/**
 * Migration script to add new columns to students table
 * Run with: node scripts/migrate-students.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'school.dev.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('Starting students table migration...');

// Get current columns
const tableInfo = db.pragma('table_info(students)');
const columns = tableInfo.map(col => col.name);

console.log('Current columns:', columns);

// Helper function to add column if it doesn't exist
function addColumnIfMissing(name, sql) {
  if (!columns.includes(name)) {
    console.log(`Adding ${name} column...`);
    db.exec(sql);
    console.log(`Added ${name} column`);
  } else {
    console.log(`${name} column already exists`);
  }
}

// Add birth_date column if not exists
addColumnIfMissing('birth_date', `ALTER TABLE students ADD COLUMN birth_date DATE`);

// Add photo column if not exists
addColumnIfMissing('photo', `ALTER TABLE students ADD COLUMN photo TEXT`);

// Add school column if not exists
addColumnIfMissing('school', `ALTER TABLE students ADD COLUMN school TEXT`);

// Add discount column if not exists
addColumnIfMissing('discount', `ALTER TABLE students ADD COLUMN discount INTEGER DEFAULT 0`);

// Add parent_relation column if not exists
addColumnIfMissing('parent_relation', `ALTER TABLE students ADD COLUMN parent_relation TEXT`);

// Add parent2_name column if not exists
addColumnIfMissing('parent2_name', `ALTER TABLE students ADD COLUMN parent2_name TEXT`);

// Add parent2_relation column if not exists
addColumnIfMissing('parent2_relation', `ALTER TABLE students ADD COLUMN parent2_relation TEXT`);

// Add interested_courses column if not exists
addColumnIfMissing('interested_courses', `ALTER TABLE students ADD COLUMN interested_courses TEXT`);

// Add source column if not exists
addColumnIfMissing('source', `ALTER TABLE students ADD COLUMN source TEXT`);

// Verify the migration
console.log('\nVerifying migration...');
const newTableInfo = db.pragma('table_info(students)');
console.log('Updated columns:');
newTableInfo.forEach(col => {
  console.log(`  - ${col.name}: ${col.type} (nullable: ${col.notnull === 0}, default: ${col.dflt_value})`);
});

// Show sample data - only select columns that exist
console.log('\nSample students after migration:');
const columnsToSelect = ['id', 'public_id', 'full_name'];
if (columns.includes('birth_date')) columnsToSelect.push('birth_date');
if (columns.includes('photo')) columnsToSelect.push('photo');
if (columns.includes('school')) columnsToSelect.push('school');
if (columns.includes('discount')) columnsToSelect.push('discount');

try {
  const students = db.prepare(`SELECT ${columnsToSelect.join(', ')} FROM students LIMIT 3`).all();
  console.log(students);
} catch (err) {
  console.log('Could not fetch sample students:', err.message);
}

db.close();
console.log('\nMigration completed successfully!');
