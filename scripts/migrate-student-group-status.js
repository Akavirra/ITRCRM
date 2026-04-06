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
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🚀 Міграція: додавання status до student_groups...');

  try {
    // Add status column to student_groups (active/graduated/removed)
    // Default 'active' for all existing active records
    await sql`
      ALTER TABLE student_groups
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
      CHECK(status IN ('active', 'graduated', 'removed'))
    `;
    console.log('✅ Колонка status додана до student_groups');

    // Update existing inactive records to 'removed' status
    await sql`
      UPDATE student_groups
      SET status = 'removed'
      WHERE is_active = FALSE AND status = 'active'
    `;
    console.log('✅ Існуючі неактивні записи оновлені зі статусом removed');

    // Add index on status
    await sql`CREATE INDEX IF NOT EXISTS idx_student_groups_status ON student_groups(status)`;
    console.log('✅ Індекс idx_student_groups_status створено');

    console.log('\n✅ Міграція завершена успішно!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error.message);
    process.exit(1);
  }
}

migrate();
