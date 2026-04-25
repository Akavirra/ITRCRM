/**
 * Phase D.1: Lesson Shortcuts.
 *
 * Викладач/адмін додає до заняття "ярлики" — посилання чи локальні програми,
 * які учні тапають на сторінці заняття.
 *
 * Формат:
 *   - kind = 'url'  → target = "https://scratch.mit.edu" (відкривається в браузері/WebView)
 *   - kind = 'app'  → target = "scratch" або "ide:python:hello.py"
 *                     (запускається тільки агентом на ноуті — на планшеті/PWA рендер прихований)
 *
 * created_by_user / created_by_telegram_id — хто додав (адмін з CRM або викладач через бот).
 *
 * Ідемпотентний: запускати багато раз безпечно.
 *
 * Запуск:
 *   node scripts/add-lesson-shortcuts.js
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Creating lesson_shortcuts table...');
  await sql`
    CREATE TABLE IF NOT EXISTS lesson_shortcuts (
      id SERIAL PRIMARY KEY,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      kind VARCHAR(20) NOT NULL CHECK (kind IN ('url', 'app')),
      label TEXT NOT NULL,
      target TEXT NOT NULL,
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by_name TEXT,
      created_by_telegram_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('Creating indexes...');
  await sql`CREATE INDEX IF NOT EXISTS idx_lesson_shortcuts_lesson_id ON lesson_shortcuts(lesson_id)`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_lesson_shortcuts_lesson_sort
    ON lesson_shortcuts(lesson_id, sort_order, id)
  `;

  console.log('✅ Migration complete.');
  console.log('   Далі виконати: npm run db:add-student-shortcuts-grant');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
