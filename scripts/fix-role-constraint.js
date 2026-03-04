/**
 * Скрипт для оновлення CHECK constraint на колонку role в таблиці users.
 * Дозволяє роль 'teacher' на додаток до 'admin'.
 * 
 * Запуск: node scripts/fix-role-constraint.js
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Завантаження .env.local
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  }
}

async function fixRoleConstraint() {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
    console.error('❌ DATABASE_URL не встановлена або є placeholder в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🚀 Підключення до Neon PostgreSQL...');

  try {
    // 1. Перевіримо поточний constraint
    console.log('\n📋 Перевірка поточних constraints на таблиці users...');
    const constraints = await sql`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'users'::regclass AND contype = 'c'
    `;
    
    console.log('Знайдені CHECK constraints:');
    for (const c of constraints) {
      console.log(`  - ${c.conname}: ${c.definition}`);
    }

    // 2. Знайдемо constraint для role
    const roleConstraint = constraints.find(c => c.definition.includes('role'));
    
    if (roleConstraint) {
      console.log(`\n🔧 Видаляємо старий constraint: ${roleConstraint.conname}`);
      await sql.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "${roleConstraint.conname}"`);
      console.log('✅ Старий constraint видалено');
    } else {
      console.log('\n⚠️  Constraint для role не знайдено — можливо вже видалено');
    }

    // 3. Додаємо новий constraint
    console.log('\n🔧 Додаємо новий constraint: role IN (\'admin\', \'teacher\')');
    await sql.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'teacher'))`);
    console.log('✅ Новий constraint додано');

    // 4. Перевіримо результат
    console.log('\n📋 Перевірка оновлених constraints...');
    const updatedConstraints = await sql`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'users'::regclass AND contype = 'c'
    `;
    
    for (const c of updatedConstraints) {
      console.log(`  - ${c.conname}: ${c.definition}`);
    }

    console.log('\n🎉 Готово! Тепер можна створювати вчителів з роллю \'teacher\'.');
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    process.exit(1);
  }
}

fixRoleConstraint();
