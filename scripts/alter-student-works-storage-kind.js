/**
 * Додає 'gdrive' у CHECK constraint student_works.storage_kind.
 * Ідемпотентний: якщо 'gdrive' вже є — нічого не робить.
 */
const fs = require('fs');
const path = require('path');
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}

const { neon } = require('@neondatabase/serverless');

(async () => {
  const sql = neon(process.env.DATABASE_URL);

  // Перевіряємо поточний constraint
  const rows = await sql`
    SELECT pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'student_works'
      AND c.conname = 'student_works_storage_kind_check'
  `;

  if (rows.length === 0) {
    console.log('⚠️  Constraint student_works_storage_kind_check не знайдено. Пропускаю.');
    return;
  }

  const def = rows[0].def;
  console.log('ℹ️  Поточний constraint:', def);

  if (def.includes("'gdrive'")) {
    console.log('✅ gdrive вже є в constraint. Нічого не роблю.');
    return;
  }

  console.log('🔧 Оновлюю constraint — додаю gdrive...');
  await sql`ALTER TABLE student_works DROP CONSTRAINT student_works_storage_kind_check`;
  await sql`
    ALTER TABLE student_works
    ADD CONSTRAINT student_works_storage_kind_check
    CHECK (storage_kind IN ('nextcloud', 'cloudinary', 'external', 'gdrive'))
  `;
  console.log('✅ Готово. Тепер storage_kind може бути gdrive.');
})().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
