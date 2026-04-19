/**
 * Міграція: замінити UNIQUE constraint на student_codes.code на partial unique index
 * (унікальний лише серед активних).
 *
 * Причина: issuePinCard використовує soft-delete (is_active=FALSE, revoked_at=NOW()),
 * але UNIQUE на колонці не враховує це і падає з "duplicate key" при перегенерації
 * картки (бо код детермінований з students.id — R0042 той самий).
 *
 * Після міграції:
 *   - Учень може мати багато історичних record'ів у student_codes, але лише один
 *     активний (гарантовано існуючим uniq_active_code_per_student + новим на code).
 *   - Активні коди все ще глобально унікальні — на рівні сесії/login нічого не міняється.
 *
 * Ідемпотентна.
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL не встановлена');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  console.log('🚀 Міграція student_codes.code: UNIQUE → partial unique на is_active=TRUE...');

  try {
    // 1. Глобальний UNIQUE constraint (створений через UNIQUE в CREATE TABLE)
    // Neon/Postgres створює його з ім'ям <table>_<column>_key
    const [{ exists: hasOldConstraint }] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'student_codes_code_key'
      ) AS exists
    `;
    if (hasOldConstraint) {
      await sql`ALTER TABLE student_codes DROP CONSTRAINT student_codes_code_key`;
      console.log('   ✅ Старий UNIQUE constraint student_codes_code_key видалено');
    } else {
      console.log('   ℹ️  Старого UNIQUE constraint не знайдено — вже видалено');
    }

    // 2. Новий partial unique index
    const [{ exists: hasNewIndex }] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'uniq_active_student_code_value'
      ) AS exists
    `;
    if (!hasNewIndex) {
      await sql`
        CREATE UNIQUE INDEX uniq_active_student_code_value
          ON student_codes(code) WHERE is_active = TRUE
      `;
      console.log('   ✅ Partial unique index uniq_active_student_code_value створено');
    } else {
      console.log('   ℹ️  Partial unique index уже існує');
    }

    // 3. Звичайний індекс на code (для швидкого пошуку під час login) — уже є з основної міграції
    console.log('\n🎉 Міграція виконана.');
    console.log('   Тепер issuePinCard може перегенеровувати картку — старі записи лишаться');
    console.log('   з is_active=FALSE, новий запис проходить через partial unique.');
  } catch (e) {
    console.error('❌ Помилка:', e.message);
    if (e.code) console.error('   Код:', e.code);
    process.exit(1);
  }
}

run();
