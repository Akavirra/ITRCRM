require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in .env.local');
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log('Ensuring pg_trgm extension...');
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

  console.log('Creating student search indexes...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_students_full_name_trgm
    ON students
    USING gin (full_name gin_trgm_ops)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_students_parent_name_trgm
    ON students
    USING gin (parent_name gin_trgm_ops)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_students_phone_trgm
    ON students
    USING gin (phone gin_trgm_ops)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_students_parent_phone_trgm
    ON students
    USING gin (parent_phone gin_trgm_ops)
  `;

  console.log('Creating student_groups indexes...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_student_groups_student_active
    ON student_groups(student_id, is_active)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_student_groups_group_active
    ON student_groups(group_id, is_active)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_student_groups_student_group_active
    ON student_groups(student_id, group_id, is_active)
  `;

  console.log('Creating lesson indexes...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_lessons_group_status_date
    ON lessons(group_id, status, lesson_date)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_lessons_teacher_date
    ON lessons(teacher_id, lesson_date)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_lessons_group_billable_date
    ON lessons(group_id, lesson_date)
    WHERE status <> 'canceled' AND is_makeup = FALSE AND is_trial = FALSE
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_lessons_scheduled_date
    ON lessons(lesson_date)
    WHERE status = 'scheduled'
  `;

  console.log('Creating payment indexes...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_payments_student_group_month
    ON payments(student_id, group_id, month)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_payments_group_month_student
    ON payments(group_id, month, student_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_payments_paid_at
    ON payments(paid_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_individual_payments_paid_at
    ON individual_payments(paid_at DESC)
  `;

  console.log('Creating group filter indexes...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_groups_teacher_status
    ON groups(teacher_id, status)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_groups_course_active
    ON groups(course_id, is_active)
  `;

  console.log('Core performance indexes are ready.');
}

main().catch((error) => {
  console.error('Failed to add core performance indexes:', error);
  process.exit(1);
});
