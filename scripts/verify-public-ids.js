/**
 * Verification script to check that all public_ids are populated
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'school.db');

const db = new Database(DB_PATH);

console.log('=== Verifying public_id backfill ===\n');

// Check courses
const coursesNull = db.prepare('SELECT COUNT(*) as cnt FROM courses WHERE public_id IS NULL').get();
const coursesEmpty = db.prepare("SELECT COUNT(*) as cnt FROM courses WHERE public_id = ''").get();
console.log(`Courses with NULL public_id: ${coursesNull.cnt}`);
console.log(`Courses with empty public_id: ${coursesEmpty.cnt}`);

// Check groups
const groupsNull = db.prepare('SELECT COUNT(*) as cnt FROM groups WHERE public_id IS NULL').get();
const groupsEmpty = db.prepare("SELECT COUNT(*) as cnt FROM groups WHERE public_id = ''").get();
console.log(`Groups with NULL public_id: ${groupsNull.cnt}`);
console.log(`Groups with empty public_id: ${groupsEmpty.cnt}`);

// Check students
const studentsNull = db.prepare('SELECT COUNT(*) as cnt FROM students WHERE public_id IS NULL').get();
const studentsEmpty = db.prepare("SELECT COUNT(*) as cnt FROM students WHERE public_id = ''").get();
console.log(`Students with NULL public_id: ${studentsNull.cnt}`);
console.log(`Students with empty public_id: ${studentsEmpty.cnt}`);

console.log('\n=== Sample data ===\n');

console.log('Courses:');
db.prepare('SELECT id, public_id, title FROM courses LIMIT 5').all().forEach(r => {
  console.log(`  id=${r.id}, public_id=${r.public_id}, title=${r.title}`);
});

console.log('\nGroups:');
db.prepare('SELECT id, public_id, title FROM groups LIMIT 5').all().forEach(r => {
  console.log(`  id=${r.id}, public_id=${r.public_id}, title=${r.title}`);
});

console.log('\nStudents:');
db.prepare('SELECT id, public_id, full_name FROM students LIMIT 5').all().forEach(r => {
  console.log(`  id=${r.id}, public_id=${r.public_id}, name=${r.full_name}`);
});

db.close();

console.log('\n=== Verification complete ===');