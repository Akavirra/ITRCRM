require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('Creating completion_certificates table...');

  await sql`
    CREATE TABLE IF NOT EXISTS completion_certificates (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      issue_date DATE NOT NULL,
      gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
      template_url TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_completion_certificates_student_id ON completion_certificates(student_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_completion_certificates_course_id ON completion_certificates(course_id)`;

  console.log('completion_certificates table created successfully.');
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
