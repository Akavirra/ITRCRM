-- School Admin Panel Database Schema
-- SQLite (better-sqlite3) compatible

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table (administrators only - teachers cannot login)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin')),
  phone TEXT,
  telegram_id TEXT,
  photo_url TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE UNIQUE INDEX idx_users_public_id ON users(public_id);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
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

CREATE INDEX idx_courses_active ON courses(is_active);
CREATE UNIQUE INDEX idx_courses_public_id ON courses(public_id);

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

CREATE INDEX idx_groups_course ON groups(course_id);
CREATE INDEX idx_groups_teacher ON groups(teacher_id);
CREATE INDEX idx_groups_active ON groups(is_active);
CREATE INDEX idx_groups_status ON groups(status);
CREATE UNIQUE INDEX idx_groups_public_id ON groups(public_id);

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
  birth_date DATE,
  photo TEXT,
  school TEXT,
  discount TEXT,
  parent_relation TEXT,
  parent2_name TEXT,
  parent2_relation TEXT,
  interested_courses TEXT,
  source TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_active ON students(is_active);
CREATE INDEX idx_students_name ON students(full_name);
CREATE UNIQUE INDEX idx_students_public_id ON students(public_id);

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

CREATE INDEX idx_student_groups_student ON student_groups(student_id);
CREATE INDEX idx_student_groups_group ON student_groups(group_id);
CREATE INDEX idx_student_groups_active ON student_groups(is_active);

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

CREATE INDEX idx_lessons_group_date ON lessons(group_id, lesson_date);
CREATE INDEX idx_lessons_date ON lessons(lesson_date);
CREATE INDEX idx_lessons_status ON lessons(status);

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

CREATE INDEX idx_attendance_lesson ON attendance(lesson_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_status ON attendance(status);

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

CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_group ON payments(group_id);
CREATE INDEX idx_payments_month ON payments(month);

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

CREATE INDEX idx_pricing_group ON pricing(group_id, effective_from);

-- Sessions table (for authentication)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

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

CREATE INDEX idx_error_logs_created ON error_logs(created_at);