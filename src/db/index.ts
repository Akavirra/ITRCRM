import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { generatePublicId } from '@/lib/public-id';

const APP_ENV = process.env.APP_ENV || 'dev'; // 'dev' | 'prod'

const DEFAULT_DB_FILE = APP_ENV === 'prod' ? 'school.prod.db' : 'school.dev.db';

// Use environment variable or default path
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', DEFAULT_DB_FILE);

// Dev/Prod mode flag (safer than NODE_ENV for your case)
const IS_DEV = APP_ENV !== 'prod';
export { DB_PATH, IS_DEV, APP_ENV };

// Debug logs to trace which database is being used (after IS_DEV is defined)
console.log(`[DB] APP_ENV=${APP_ENV} IS_DEV=${IS_DEV}`);
console.log(`[DB] DB_PATH=${DB_PATH}`);

// Schema version for tracking DB compatibility
const SCHEMA_VERSION = 2;

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database connection singleton
let db: Database.Database | null = null;

// Initialization state
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Get or create database connection
export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');
    console.log('Database connection established:', DB_PATH);
  }
  return db;
}

// Check if a table exists
function tableExists(tableName: string): boolean {
  const database = getDb();
  const result = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tableName);
  return !!result;
}

// Check if schema_version table exists and get version
function getSchemaVersion(): number {
  if (!tableExists('schema_version')) {
    return 0;
  }
  const result = getDb().prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
  return result?.version || 0;
}

// Set schema version
function setSchemaVersion(version: number): void {
  const database = getDb();
  if (!tableExists('schema_version')) {
    database.exec(`
      CREATE TABLE schema_version (
        version INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  database.exec(`DELETE FROM schema_version`);
  database.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
}

// Create all tables
function createAllTables(): void {
  const database = getDb();
  
  const createTablesSQL = `
    -- Users table (administrators only - teachers cannot login)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    -- Courses table
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      age_min INTEGER NOT NULL DEFAULT 6,
      duration_months INTEGER NOT NULL DEFAULT 1,
      program TEXT,
      flyer_path TEXT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_public_id ON courses(public_id);

    -- Groups table
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT UNIQUE,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      teacher_id INTEGER NOT NULL,
      weekly_day INTEGER NOT NULL CHECK(weekly_day >= 1 AND weekly_day <= 7),
      start_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 90,
      timezone TEXT DEFAULT 'Europe/Uzhgorod',
      start_date DATE,
      end_date DATE,
      capacity INTEGER,
      monthly_price INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'graduate', 'inactive')),
      note TEXT,
      photos_folder_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_groups_course ON groups(course_id);
    CREATE INDEX IF NOT EXISTS idx_groups_teacher ON groups(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(is_active);
    CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_public_id ON groups(public_id);

    -- Students table
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      parent_name TEXT,
      parent_phone TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_students_active ON students(is_active);
    CREATE INDEX IF NOT EXISTS idx_students_name ON students(full_name);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_students_public_id ON students(public_id);

    -- Student-Groups junction table (many-to-many)
    CREATE TABLE IF NOT EXISTS student_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      join_date DATE NOT NULL DEFAULT CURRENT_DATE,
      leave_date DATE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      UNIQUE(student_id, group_id, join_date)
    );

    CREATE INDEX IF NOT EXISTS idx_student_groups_student ON student_groups(student_id);
    CREATE INDEX IF NOT EXISTS idx_student_groups_group ON student_groups(group_id);
    CREATE INDEX IF NOT EXISTS idx_student_groups_active ON student_groups(is_active);

    -- Lessons table
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      lesson_date DATE NOT NULL,
      start_datetime DATETIME NOT NULL,
      end_datetime DATETIME NOT NULL,
      topic TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'done', 'canceled')),
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_lessons_group_date ON lessons(group_id, lesson_date);
    CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons(lesson_date);
    CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);

    -- Attendance table
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'present' CHECK(status IN ('present', 'absent', 'makeup_planned', 'makeup_done')),
      comment TEXT,
      makeup_lesson_id INTEGER,
      updated_by INTEGER NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (makeup_lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE(lesson_id, student_id)
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_lesson ON attendance(lesson_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

    -- Payments table
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      month DATE NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('cash', 'account')),
      paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      note TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE(student_id, group_id, month, method, paid_at)
    );

    CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
    CREATE INDEX IF NOT EXISTS idx_payments_group ON payments(group_id);
    CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);

    -- Pricing table (optional, for group pricing history)
    CREATE TABLE IF NOT EXISTS pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      monthly_price INTEGER NOT NULL,
      currency TEXT DEFAULT 'UAH',
      effective_from DATE NOT NULL,
      effective_to DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pricing_group ON pricing(group_id, effective_from);

    -- Sessions table (for authentication)
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    -- Error logs table
    CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_message TEXT NOT NULL,
      error_stack TEXT,
      user_id INTEGER,
      request_path TEXT,
      request_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);
  `;
  
  database.exec(createTablesSQL);
  console.log('Database tables created/verified');
}

// Seed demo users (idempotent)
function seedDemoUsers(): void {
  const database = getDb();
  
  try {
    // Check if admin user exists
    const adminExists = database.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?').get('admin@school.ua') as { count: number };
    
    if (adminExists?.count === 0) {
      const adminPasswordHash = bcrypt.hashSync('admin123', 10);
      database.prepare(
        'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)'
      ).run('Admin', 'admin@school.ua', adminPasswordHash, 'admin', 1);
      console.log('Created demo admin user: admin@school.ua');
    }

    // Check if teacher user exists
    const teacherExists = database.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?').get('teacher@school.ua') as { count: number };
    
    if (teacherExists?.count === 0) {
      const teacherPasswordHash = bcrypt.hashSync('teacher123', 10);
      database.prepare(
        'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)'
      ).run('Teacher', 'teacher@school.ua', teacherPasswordHash, 'teacher', 1);
      console.log('Created demo teacher user: teacher@school.ua');
    }
  } catch (error) {
    console.error('Failed to seed demo users:', error);
  }
}

// Run migrations for existing databases
function runMigrations(): void {
  const database = getDb();
  
  try {
    // Check if groups table exists first
    if (!tableExists('groups')) {
      return; // Tables will be created by createAllTables
    }
    
    // Check if status column exists in groups table
    const groupsTableInfo = database.prepare("PRAGMA table_info(groups)").all() as { name: string }[];
    const groupsColumns = groupsTableInfo.map(col => col.name);
    
    if (!groupsColumns.includes('status')) {
      console.log('Adding status column to groups table...');
      database.exec(`ALTER TABLE groups ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'graduate', 'inactive'))`);
      database.exec(`CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status)`);
      console.log('Migration: status column added');
    }
    
    if (!groupsColumns.includes('note')) {
      console.log('Adding note column to groups table...');
      database.exec(`ALTER TABLE groups ADD COLUMN note TEXT`);
      console.log('Migration: note column added');
    }
    
    if (!groupsColumns.includes('photos_folder_url')) {
      console.log('Adding photos_folder_url column to groups table...');
      database.exec(`ALTER TABLE groups ADD COLUMN photos_folder_url TEXT`);
      console.log('Migration: photos_folder_url column added');
    }
    
    // Add public_id column to groups table if it doesn't exist
    if (!groupsColumns.includes('public_id')) {
      console.log('Adding public_id column to groups table...');
      database.exec(`ALTER TABLE groups ADD COLUMN public_id TEXT`);
      database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_public_id ON groups(public_id)`);
      console.log('Migration: public_id column added to groups');
    }
    
    // Add public_id column to students table if it doesn't exist
    if (tableExists('students')) {
      const studentsTableInfo = database.prepare("PRAGMA table_info(students)").all() as { name: string }[];
      const studentsColumns = studentsTableInfo.map(col => col.name);
      
      if (!studentsColumns.includes('public_id')) {
        console.log('Adding public_id column to students table...');
        database.exec(`ALTER TABLE students ADD COLUMN public_id TEXT`);
        database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_students_public_id ON students(public_id)`);
        console.log('Migration: public_id column added to students');
      }
      
      // Add email column to students table if it doesn't exist
      if (!studentsColumns.includes('email')) {
        console.log('Adding email column to students table...');
        database.exec(`ALTER TABLE students ADD COLUMN email TEXT`);
        console.log('Migration: email column added to students');
      }
    }
    
    // Add public_id column to courses table if it doesn't exist
    if (tableExists('courses')) {
      const coursesTableInfo = database.prepare("PRAGMA table_info(courses)").all() as { name: string }[];
      const coursesColumns = coursesTableInfo.map(col => col.name);
      
      if (!coursesColumns.includes('public_id')) {
        console.log('Adding public_id column to courses table...');
        database.exec(`ALTER TABLE courses ADD COLUMN public_id TEXT`);
        database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_public_id ON courses(public_id)`);
        console.log('Migration: public_id column added to courses');
      }
      
      // Migrate from age_label (TEXT) to age_min (INTEGER)
      // Check if age_min column exists
      if (!coursesColumns.includes('age_min')) {
        console.log('Migrating age_label to age_min...');
        // Check if age_label exists and has data
        if (coursesColumns.includes('age_label')) {
          // Extract numeric value from age_label (e.g., "6+" -> 6)
          database.exec(`
            UPDATE courses SET age_label = '6' WHERE age_label IS NULL OR age_label = ''
          `);
          // Add age_min column
          database.exec(`ALTER TABLE courses ADD COLUMN age_min INTEGER NOT NULL DEFAULT 6`);
          // Migrate data: extract number from age_label
          const courses = database.prepare('SELECT id, age_label FROM courses').all() as { id: number; age_label: string }[];
          for (const course of courses) {
            const match = course.age_label.match(/^(\d+)/);
            const ageValue = match ? parseInt(match[1], 10) : 6;
            database.prepare('UPDATE courses SET age_min = ? WHERE id = ?').run(ageValue, course.id);
          }
          console.log('Migration: age_label migrated to age_min');
        } else {
          // No age_label column, just add age_min
          database.exec(`ALTER TABLE courses ADD COLUMN age_min INTEGER NOT NULL DEFAULT 6`);
          console.log('Migration: age_min column added to courses');
        }
      }
      
      // Add duration_months column to courses table if it doesn't exist
      if (!coursesColumns.includes('duration_months')) {
        console.log('Adding duration_months column to courses table...');
        database.exec(`ALTER TABLE courses ADD COLUMN duration_months INTEGER NOT NULL DEFAULT 1`);
        console.log('Migration: duration_months column added to courses');
      }
      
      // Add program column to courses table if it doesn't exist
      if (!coursesColumns.includes('program')) {
        console.log('Adding program column to courses table...');
        database.exec(`ALTER TABLE courses ADD COLUMN program TEXT`);
        console.log('Migration: program column added to courses');
      }
      
      // Add flyer_path column to courses table if it doesn't exist
      if (!coursesColumns.includes('flyer_path')) {
        console.log('Adding flyer_path column to courses table...');
        database.exec(`ALTER TABLE courses ADD COLUMN flyer_path TEXT NULL`);
        console.log('Migration: flyer_path column added to courses');
      }
    }
    
    // Add new columns to users table for teacher management
    if (tableExists('users')) {
      const usersTableInfo = database.prepare("PRAGMA table_info(users)").all() as { name: string }[];
      const usersColumns = usersTableInfo.map(col => col.name);
      
      if (!usersColumns.includes('phone')) {
        console.log('Adding phone column to users table...');
        database.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
        console.log('Migration: phone column added to users');
      }
      
      if (!usersColumns.includes('telegram_id')) {
        console.log('Adding telegram_id column to users table...');
        database.exec(`ALTER TABLE users ADD COLUMN telegram_id TEXT`);
        console.log('Migration: telegram_id column added to users');
      }
      
      if (!usersColumns.includes('photo_url')) {
        console.log('Adding photo_url column to users table...');
        database.exec(`ALTER TABLE users ADD COLUMN photo_url TEXT`);
        console.log('Migration: photo_url column added to users');
      }
      
      if (!usersColumns.includes('notes')) {
        console.log('Adding notes column to users table...');
        database.exec(`ALTER TABLE users ADD COLUMN notes TEXT`);
        console.log('Migration: notes column added to users');
      }
      
      if (!usersColumns.includes('public_id')) {
        console.log('Adding public_id column to users table...');
        database.exec(`ALTER TABLE users ADD COLUMN public_id TEXT`);
        database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id)`);
        console.log('Migration: public_id column added to users');
      }
    }
    
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Reset database (DEV ONLY - deletes all data and recreates schema)
export function resetDatabase(): void {
  if (!IS_DEV) {
    console.error('resetDatabase() can only be called in development mode!');
    return;
  }
  
  console.log('Resetting database (dev mode)...');
  
  // Close existing connection
  if (db) {
    db.close();
    db = null;
  }
  
  // Delete the database file
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('Database file deleted:', DB_PATH);
  }
  
  // Reset initialization state
  isInitialized = false;
  
  // Re-initialize
  initializeDatabase();
  
  console.log('Database reset complete');
}

// Initialize database schema
export function initializeDatabase(): void {
  if (isInitialized) {
    return;
  }
  
  console.log('Initializing database...');
  
  try {
    // Create all tables first
    createAllTables();
    
    // Run migrations for any schema changes
    runMigrations();
    
    // Seed demo users
    seedDemoUsers();
    
    // Update schema version
    setSchemaVersion(SCHEMA_VERSION);
    
    isInitialized = true;
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    
    // In development, try to recover by resetting the database
    if (IS_DEV) {
      console.log('Attempting to recover by resetting database...');
      try {
        resetDatabase();
      } catch (resetError) {
        console.error('Failed to reset database:', resetError);
        throw resetError;
      }
    } else {
      throw error;
    }
  }
}

// Ensure database is initialized before any operation
export function ensureInitialized(): boolean {
  if (!isInitialized) {
    initializeDatabase();
  }
  return isInitialized;
}

// Helper functions for common database operations
// All helpers ensure DB is initialized before executing
export function run(sql: string, params: any[] = []) {
  ensureInitialized();
  const database = getDb();
  const stmt = database.prepare(sql);
  return stmt.run(...params);
}

export function get<T = any>(sql: string, params: any[] = []): T | undefined {
  ensureInitialized();
  const database = getDb();
  const stmt = database.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

export function all<T = any>(sql: string, params: any[] = []): T[] {
  ensureInitialized();
  const database = getDb();
  const stmt = database.prepare(sql);
  return stmt.all(...params) as T[];
}

export function transaction<T>(fn: () => T): T {
  ensureInitialized();
  const database = getDb();
  return database.transaction(fn)();
}

// Log error to database
export function logError(
  errorMessage: string,
  errorStack?: string,
  userId?: number,
  requestPath?: string,
  requestMethod?: string
) {
  try {
    run(
      `INSERT INTO error_logs (error_message, error_stack, user_id, request_path, request_method)
       VALUES (?, ?, ?, ?, ?)`,
      [errorMessage, errorStack || null, userId || null, requestPath || null, requestMethod || null]
    );
  } catch (e) {
    console.error('Failed to log error to database:', e);
  }
}

// Auto-initialize on module import
ensureInitialized();
