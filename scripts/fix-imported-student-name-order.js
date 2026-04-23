const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) return;
    process.env[match[1].trim()] = match[2].trim();
  });
}

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL не знайдено в .env.local');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

function parseArgs(argv) {
  const options = {
    commit: false,
    source: 'excel_import_2026',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--commit') {
      options.commit = true;
    } else if (arg === '--source') {
      options.source = argv[i + 1];
      i += 1;
    }
  }

  return options;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function reorderSurnameFirstFullName(fullName) {
  const cleaned = cleanText(fullName);
  if (!cleaned) return cleaned;

  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length < 2) return cleaned;

  return [...parts.slice(1), parts[0]].join(' ');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await sql`
    SELECT id, full_name
    FROM students
    WHERE source = ${options.source}
    ORDER BY id
  `;

  if (rows.length === 0) {
    console.log(`Не знайдено учнів для source = ${options.source}`);
    return;
  }

  let changed = 0;
  const preview = [];

  for (const row of rows) {
    const nextName = reorderSurnameFirstFullName(row.full_name);
    if (!nextName || nextName === row.full_name) continue;

    changed += 1;
    if (preview.length < 20) {
      preview.push({ id: row.id, before: row.full_name, after: nextName });
    }

    if (options.commit) {
      await sql`
        UPDATE students
        SET full_name = ${nextName},
            updated_at = NOW()
        WHERE id = ${row.id}
      `;
    }
  }

  console.log(`Режим: ${options.commit ? 'COMMIT' : 'DRY-RUN'}`);
  console.log(`Source: ${options.source}`);
  console.log(`Знайдено записів: ${rows.length}`);
  console.log(`Буде/оновлено ПІБ: ${changed}`);
  console.log('\nПриклади:');
  preview.forEach((item) => {
    console.log(`- #${item.id}: ${item.before} -> ${item.after}`);
  });
}

main().catch((error) => {
  console.error('Помилка виправлення ПІБ:', error);
  process.exit(1);
});
