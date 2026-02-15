const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'school.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Initialize schema
function initSchema() {
  const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('PRAGMA'));
  
  for (const statement of statements) {
    try {
      db.exec(statement);
    } catch (error) {
      if (!String(error).includes('already exists')) {
        throw error;
      }
    }
  }
  
  console.log('Schema initialized');
}

// Seed data
async function seed() {
  console.log('Starting seed...');
  
  // Clear existing data (in reverse order of dependencies)
  db.exec(`
    DELETE FROM attendance;
    DELETE FROM payments;
    DELETE FROM pricing;
    DELETE FROM lessons;
    DELETE FROM student_groups;
    DELETE FROM students;
    DELETE FROM groups;
    DELETE FROM courses;
    DELETE FROM sessions;
    DELETE FROM users WHERE email IN ('admin@school.ua', 'teacher@school.ua');
  `);
  
  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const adminResult = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, ?)
  `).run('Admin', 'admin@school.ua', adminPasswordHash, 'admin', 1);
  const adminId = adminResult.lastInsertRowid;
  console.log('Created admin user:', adminId);
  
  // Create teacher user
  const teacherPasswordHash = await bcrypt.hash('teacher123', 10);
  const teacherResult = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, ?)
  `).run('Maria Petrenko', 'teacher@school.ua', teacherPasswordHash, 'teacher', 1);
  const teacherId = teacherResult.lastInsertRowid;
  console.log('Created teacher user:', teacherId);
  
  // Create course
  const courseResult = db.prepare(`
    INSERT INTO courses (title, description, is_active)
    VALUES (?, ?, ?)
  `).run('Graphic Design', 'Basics of graphic design and visual communication', 1);
  const courseId = courseResult.lastInsertRowid;
  console.log('Created course:', courseId);
  
  // Create group (Friday 11:30, 90 minutes)
  const groupResult = db.prepare(`
    INSERT INTO groups (course_id, title, teacher_id, weekly_day, start_time, duration_minutes, timezone, start_date, capacity, monthly_price, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    courseId,
    'Fri 11:30 Graphics',
    teacherId,
    5, // Friday (0 = Sunday, 5 = Friday)
    '11:30',
    90,
    'Europe/Uzhgorod',
    '2024-01-12', // Start date
    10,
    2000, // Monthly price in UAH
    1
  );
  const groupId = groupResult.lastInsertRowid;
  console.log('Created group:', groupId);
  
  // Create 5 students
  const students = [
    { name: 'Oleksandr Kovalenko', phone: '+380991234567', parent: 'Ivan Kovalenko', parentPhone: '+380991234568' },
    { name: 'Anna Shevchenko', phone: '+380992345678', parent: 'Petro Shevchenko', parentPhone: '+380992345679' },
    { name: 'Dmytro Bondarenko', phone: '+380993456789', parent: 'Olena Bondarenko', parentPhone: '+380993456780' },
    { name: 'Sofiia Melnyk', phone: '+380994567890', parent: 'Andrii Melnyk', parentPhone: '+380994567891' },
    { name: 'Maksym Tkachenko', phone: '+380995678901', parent: 'Kateryna Tkachenko', parentPhone: '+380995678902' },
  ];
  
  const studentIds = [];
  for (const student of students) {
    const result = db.prepare(`
      INSERT INTO students (full_name, phone, parent_name, parent_phone, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(student.name, student.phone, student.parent, student.parentPhone, 1);
    studentIds.push(result.lastInsertRowid);
    console.log('Created student:', student.name);
  }
  
  // Add students to group
  for (const studentId of studentIds) {
    db.prepare(`
      INSERT INTO student_groups (student_id, group_id, join_date, is_active)
      VALUES (?, ?, ?, ?)
    `).run(studentId, groupId, '2024-01-12', 1);
    console.log('Added student', studentId, 'to group', groupId);
  }
  
  // Generate lessons for 8 weeks ahead
  const startDate = new Date('2024-01-12');
  const dayOfWeek = 5; // Friday
  const startTime = '11:30';
  const durationMinutes = 90;
  
  for (let week = 0; week < 8; week++) {
    const lessonDate = new Date(startDate);
    lessonDate.setDate(startDate.getDate() + (week * 7));
    
    const dateStr = lessonDate.toISOString().split('T')[0];
    const startDateTime = `${dateStr} ${startTime}:00`;
    
    const endTime = new Date(`${dateStr}T${startTime}`);
    endTime.setMinutes(endTime.getMinutes() + durationMinutes);
    const endDateTime = endTime.toISOString().replace('T', ' ').substring(0, 19);
    
    try {
      db.prepare(`
        INSERT INTO lessons (group_id, lesson_date, start_datetime, end_datetime, topic, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        groupId,
        dateStr,
        startDateTime,
        endDateTime,
        null,
        'scheduled',
        adminId
      );
      console.log('Created lesson for:', dateStr);
    } catch (e) {
      console.log('Lesson already exists for:', dateStr);
    }
  }
  
  // Add some payments
  const currentMonth = new Date().toISOString().substring(0, 7) + '-01';
  for (let i = 0; i < 3; i++) {
    db.prepare(`
      INSERT INTO payments (student_id, group_id, month, amount, method, paid_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      studentIds[i],
      groupId,
      currentMonth,
      2000,
      'cash',
      new Date().toISOString().replace('T', ' ').substring(0, 19),
      adminId
    );
    console.log('Created payment for student:', studentIds[i]);
  }
  
  console.log('\n=== Seed completed successfully! ===');
  console.log('\nLogin credentials:');
  console.log('  Admin: admin@school.ua / admin123');
  console.log('  Teacher: teacher@school.ua / teacher123');
  
  db.close();
}

// Run
initSchema();
seed();