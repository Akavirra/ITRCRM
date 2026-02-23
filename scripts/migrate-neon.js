const { neon } = require('@neondatabase/serverless');

// Завантаження .env.local
const fs = require('fs');
const path = require('path');
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  }
}

async function migrate() {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
    console.error('❌ DATABASE_URL не встановлена або є placeholder в .env.local');
    console.error('   Отримай DATABASE_URL на https://neon.tech і додай в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🚀 Підключення до Neon PostgreSQL...');

  try {
    // 1. Users table (адміністратори)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        public_id TEXT UNIQUE,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'teacher')),
        phone TEXT,
        telegram_id TEXT,
        photo_url TEXT,
        notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця users готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id)`;

    // 2. Courses table
    await sql`
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        public_id TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        age_min INTEGER NOT NULL DEFAULT 6,
        duration_months INTEGER NOT NULL DEFAULT 1,
        program TEXT,
        flyer_path TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця courses готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_public_id ON courses(public_id)`;

    // 3. Groups table (після courses та users)
    await sql`
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        public_id TEXT UNIQUE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
        title TEXT NOT NULL,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
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
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця groups готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_groups_course ON groups(course_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_groups_teacher ON groups(teacher_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_public_id ON groups(public_id)`;

    // 4. Students table
    await sql`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
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
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця students готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_students_active ON students(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_students_name ON students(full_name)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_students_public_id ON students(public_id)`;

    // 5. Sessions table (після users)
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця sessions готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`;

    // 6. Lessons table (після groups та users)
    await sql`
      CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        lesson_date DATE NOT NULL,
        start_datetime TIMESTAMPTZ NOT NULL,
        end_datetime TIMESTAMPTZ NOT NULL,
        topic TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'done', 'canceled')),
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця lessons готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_lessons_group_date ON lessons(group_id, lesson_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons(lesson_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status)`;

    // Додаємо колонку teacher_id для заміни викладача
    try {
      await sql`ALTER TABLE lessons ADD COLUMN teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL`;
      console.log('✅ Колонка teacher_id додана до lessons');
    } catch (e) {
      // Колонка вже існує - це нормально при повторному запуску
      if (e.message && e.message.includes('already exists')) {
        console.log('ℹ️ Колонка teacher_id вже існує в lessons');
      } else {
        throw e;
      }
    }

    // 7. Attendance table (після lessons, students, users)
    await sql`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'present' CHECK(status IN ('present', 'absent', 'makeup_planned', 'makeup_done')),
        comment TEXT,
        makeup_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
        updated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(lesson_id, student_id)
      )
    `;
    console.log('✅ Таблиця attendance готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_attendance_lesson ON attendance(lesson_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status)`;

    // 8. Payments table (після students, groups, users)
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        month DATE NOT NULL,
        amount INTEGER NOT NULL,
        method TEXT NOT NULL CHECK(method IN ('cash', 'account')),
        paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        note TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(student_id, group_id, month, method, paid_at)
      )
    `;
    console.log('✅ Таблиця payments готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_group ON payments(group_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month)`;

    // 9. Student-Groups junction table (після students та groups)
    await sql`
      CREATE TABLE IF NOT EXISTS student_groups (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        join_date DATE NOT NULL DEFAULT CURRENT_DATE,
        leave_date DATE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(student_id, group_id, join_date)
      )
    `;
    console.log('✅ Таблиця student_groups готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_student_groups_student ON student_groups(student_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_student_groups_group ON student_groups(group_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_student_groups_active ON student_groups(is_active)`;

    // 10. Pricing table (після groups)
    await sql`
      CREATE TABLE IF NOT EXISTS pricing (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        monthly_price INTEGER NOT NULL,
        currency TEXT DEFAULT 'UAH',
        effective_from DATE NOT NULL,
        effective_to DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця pricing готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_pricing_group ON pricing(group_id, effective_from)`;

    // 11. Group history table (після groups та users)
    await sql`
      CREATE TABLE IF NOT EXISTS group_history (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        action_type TEXT NOT NULL,
        action_description TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        user_name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця group_history готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_group_history_group ON group_history(group_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_group_history_created ON group_history(created_at)`;

    // 12. Error logs table (після users)
    await sql`
      CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        error_message TEXT NOT NULL,
        error_stack TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        request_path TEXT,
        request_method TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця error_logs готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at)`;

    // 13. Lesson teacher replacements table (після lessons та users)
    await sql`
      CREATE TABLE IF NOT EXISTS lesson_teacher_replacements (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        original_teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        replacement_teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        replaced_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Таблиця lesson_teacher_replacements готова');

    await sql`CREATE INDEX IF NOT EXISTS idx_lesson_teacher_replacements_lesson ON lesson_teacher_replacements(lesson_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lesson_teacher_replacements_replacement_teacher ON lesson_teacher_replacements(replacement_teacher_id)`;

    console.log('\n🎉 Міграція успішна! Всі таблиці створені.');
    console.log('Наступний крок: npm run db:seed:neon — для тестових даних');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
