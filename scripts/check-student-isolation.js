#!/usr/bin/env node
/**
 * Статичний перевіряч ізоляції student-портального коду.
 *
 * Сканує файли student-side (src/app/s/**, src/app/api/student/**, src/lib/student-*.ts,
 * src/components/student/**) на заборонені імпорти, які дали б їм доступ до admin-
 * функціоналу:
 *   - @/db (admin DB client — потрібен @/db/neon-student)
 *   - @/lib/auth (admin auth — потрібен @/lib/student-auth)
 *   - getAuthUser (adm-guard)
 *   - @/lib/telegram, @/lib/cloudinary (admin-only)
 *
 * Окремо сканує admin-side (src/app/(app)/**, src/app/api/** крім student/) на
 * зворотний витік: імпорти student-модулів не фатальні, але сигнал для перевірки.
 *
 * Запуск: node scripts/check-student-isolation.js
 * Exit code 0 якщо чисто, 1 якщо знайдено порушення.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// Патерни файлів student-side коду
const STUDENT_GLOBS = [
  'src/app/s',
  'src/app/api/student',
  'src/components/student',
];

// ВАЖЛИВО: student-credentials.ts НЕ входить у цей список — він admin-side
// (викликається лише з /api/students/[id]/pin-card і використовує admin @/db).
// Student-side за визначенням НЕ має права видавати/відкликати PIN-картки.
const STUDENT_LIBS = [
  'src/lib/student-auth.ts',
  'src/db/neon-student.ts',
];

// Імпорти заборонені всередині student-коду
const FORBIDDEN_IN_STUDENT = [
  { pattern: /from\s+['"]@\/db['"]/, label: "@/db (use @/db/neon-student)" },
  { pattern: /from\s+['"]@\/db\/(?!neon-student)/, label: "@/db/* (крім neon-student)" },
  { pattern: /from\s+['"]@\/lib\/auth['"]/, label: "@/lib/auth (use @/lib/student-auth)" },
  { pattern: /from\s+['"]@\/lib\/api-utils['"]/, label: "@/lib/api-utils (має admin getAuthUser)" },
  { pattern: /from\s+['"]@\/lib\/telegram['"]/, label: "@/lib/telegram (admin-only)" },
  { pattern: /from\s+['"]@\/lib\/cloudinary['"]/, label: "@/lib/cloudinary (admin-only)" },
  { pattern: /\bgetAuthUser\s*\(/, label: "getAuthUser() — admin-only, use getStudentFromRequest" },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function relative(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

let issues = 0;

/** Швидкий skip рядків, які — тільки коментар (line comment або тіло блочного). */
function isCommentLine(line) {
  const trimmed = line.trimStart();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

function checkFile(filePath, rules) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;
    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        console.error(`❌ ${relative(filePath)}:${i + 1}`);
        console.error(`   ${line.trim()}`);
        console.error(`   → ${rule.label}`);
        issues++;
      }
    }
  }
}

console.log('🔎 Перевіряю student-side код на заборонені імпорти...\n');

// 1. Папки з student-кодом
for (const glob of STUDENT_GLOBS) {
  const dir = path.join(ROOT, glob);
  const files = walk(dir);
  for (const f of files) {
    checkFile(f, FORBIDDEN_IN_STUDENT);
  }
}

// 2. Окремі файли-бібліотеки
for (const lib of STUDENT_LIBS) {
  const full = path.join(ROOT, lib);
  if (fs.existsSync(full)) {
    checkFile(full, FORBIDDEN_IN_STUDENT);
  }
}

if (issues === 0) {
  console.log('✅ Жодних заборонених імпортів в student-коді не знайдено.');
  console.log('   Student-side використовує лише @/db/neon-student і @/lib/student-auth — OK.');
  process.exit(0);
} else {
  console.error(`\n❌ Знайдено ${issues} порушень ізоляції student-коду.`);
  console.error('   Виправте імпорти перед деплоєм — інакше учень матиме доступ до admin-даних.');
  process.exit(1);
}
