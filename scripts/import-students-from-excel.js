const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const XLSX = require('xlsx');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    return;
  }

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
    file: null,
    sheet: null,
    commit: false,
    limit: null,
    surnameFirst: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--file') {
      options.file = argv[i + 1];
      i += 1;
    } else if (arg === '--sheet') {
      options.sheet = argv[i + 1];
      i += 1;
    } else if (arg === '--limit') {
      options.limit = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === '--commit') {
      options.commit = true;
    } else if (arg === '--keep-name-order') {
      options.surnameFirst = false;
    }
  }

  return options;
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function findHeaderRow(rows) {
  return rows.findIndex((row) => row.some((cell) => {
    const header = normalizeHeader(cell);
    return header.includes("ім'я та прізвище учня") || header.includes('контакти батьків');
  }));
}

function mapColumns(headerRow) {
  const columns = {};

  headerRow.forEach((cell, index) => {
    const header = normalizeHeader(cell);
    if (header.includes("ім'я та прізвище учня")) columns.fullName = index;
    if (header.includes('дата народження')) columns.birthDate = index;
    if (header.includes('навчальний заклад')) columns.school = index;
    if (header.includes('контакти батьків')) columns.phones = index;
    if (header.includes('додаткова інформація')) columns.contacts = index;
    if (header.includes('час відвідування')) columns.schedule = index;
    if (header.includes('обраний курс')) columns.course = index;
    if (header.includes('статус навчання')) columns.status = index;
    if (header.includes('дата випуска')) columns.graduationDate = index;
  });

  return columns;
}

function excelDateToIso(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const month = String(parsed.m).padStart(2, '0');
    const day = String(parsed.d).padStart(2, '0');
    return `${parsed.y}-${month}-${day}`;
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  return null;
}

function cleanText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

function reorderSurnameFirstFullName(fullName) {
  const cleaned = cleanText(fullName);
  if (!cleaned) return cleaned;

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return cleaned;

  return [...parts.slice(1), parts[0]].join(' ');
}

function splitStructuredCell(value) {
  const text = String(value || '')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .trim();

  if (!text) return [];

  return text
    .split(/\n| {2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;

  if (digits.length === 12 && digits.startsWith('38')) {
    digits = digits.slice(2);
  }

  if (digits.length === 9) {
    digits = `0${digits}`;
  }

  if (digits.length !== 10) {
    return null;
  }

  return digits;
}

function extractPhones(value) {
  const text = String(value || '');
  const matches = text.match(/(?:\+?38\s*)?\d{3}\s*\d{3}\s*\d{4}/g) || [];
  const result = [];

  for (const match of matches) {
    const phone = normalizePhone(match);
    if (phone && !result.includes(phone)) {
      result.push(phone);
    }
  }

  if (result.length === 0) {
    const compact = normalizePhone(text);
    if (compact) {
      result.push(compact);
    }
  }

  return result.slice(0, 2);
}

function normalizeRelation(rawRole) {
  const role = cleanText(rawRole).toLowerCase();
  if (!role) return null;
  if (role.includes('мама')) return 'mother';
  if (role.includes('батько') || role.includes('тато')) return 'father';
  if (role.includes('бабу')) return 'grandmother';
  if (role.includes('діду')) return 'grandfather';
  return 'other';
}

function parseContactEntry(value) {
  const text = cleanText(value);
  if (!text) {
    return { name: null, relation: null, raw: '' };
  }

  const dashMatch = text.match(/^(.*?)[-–—]\s*(.+)$/);
  if (dashMatch) {
    const name = cleanText(dashMatch[1]) || null;
    const rawRole = cleanText(dashMatch[2]) || null;
    return {
      name,
      relation: normalizeRelation(rawRole),
      raw: text,
    };
  }

  if (/(мама|батько|тато|бабу|діду)/i.test(text)) {
    return {
      name: null,
      relation: normalizeRelation(text),
      raw: text,
    };
  }

  return {
    name: text,
    relation: null,
    raw: text,
  };
}

function buildNotes(row, columns, parsedContacts, rawPhones) {
  const notes = [];

  const schedule = cleanText(row[columns.schedule]);
  const status = cleanText(row[columns.status]);
  const graduationDate = excelDateToIso(row[columns.graduationDate]);

  if (schedule) notes.push(`Час відвідування: ${schedule}`);
  if (status) notes.push(`Статус у файлі: ${status}`);
  if (graduationDate) notes.push(`Дата випуску у файлі: ${graduationDate}`);

  const unresolvedContacts = parsedContacts
    .filter((contact) => !contact.name || !contact.relation)
    .map((contact) => contact.raw)
    .filter(Boolean);

  if (unresolvedContacts.length > 0) {
    notes.push(`Контакти потребують перевірки: ${unresolvedContacts.join(' | ')}`);
  }

  if (rawPhones.length === 0) {
    notes.push('У файлі не вдалося розібрати жодного номера телефону');
  }

  return notes.join('\n') || null;
}

function makePublicId() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  const bytes = crypto.randomBytes(8);

  for (let i = 0; i < bytes.length; i += 1) {
    randomPart += alphabet[bytes[i] % alphabet.length];
  }

  return `STU-${randomPart}`;
}

async function generateUniqueStudentPublicId() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const publicId = makePublicId();
    const existing = await sql`SELECT id FROM students WHERE public_id = ${publicId} LIMIT 1`;
    if (existing.length === 0) {
      return publicId;
    }
  }

  throw new Error('Не вдалося згенерувати унікальний public_id');
}

async function studentExists(fullName, birthDate, parentPhone) {
  if (birthDate) {
    const rows = await sql`
      SELECT id
      FROM students
      WHERE lower(full_name) = lower(${fullName})
        AND birth_date = ${birthDate}
      LIMIT 1
    `;
    if (rows.length > 0) return true;
  }

  if (parentPhone) {
    const rows = await sql`
      SELECT id
      FROM students
      WHERE lower(full_name) = lower(${fullName})
        AND regexp_replace(coalesce(parent_phone, ''), '[^0-9]', '', 'g') = ${parentPhone}
      LIMIT 1
    `;
    if (rows.length > 0) return true;
  }

  return false;
}

function parseStudentRow(row, columns, options) {
  const rawFullName = cleanText(row[columns.fullName]);
  const fullName = options.surnameFirst ? reorderSurnameFirstFullName(rawFullName) : rawFullName;
  if (!fullName) return null;

  const birthDate = excelDateToIso(row[columns.birthDate]);
  const school = cleanText(row[columns.school]) || null;
  const phones = extractPhones(row[columns.phones]);
  const contactEntries = splitStructuredCell(row[columns.contacts]).map(parseContactEntry);

  const primaryContact = contactEntries[0] || { name: null, relation: null, raw: '' };
  const secondaryContact = contactEntries[1] || { name: null, relation: null, raw: '' };

  const interestedCourses = cleanText(row[columns.course]) || null;
  const notes = buildNotes(row, columns, contactEntries, phones);

  return {
    fullName,
    birthDate,
    school,
    parentName: primaryContact.name,
    parentRelation: primaryContact.relation,
    parentPhone: phones[0] || null,
    parent2Name: secondaryContact.name,
    parent2Relation: secondaryContact.relation,
    parent2Phone: phones[1] || null,
    interestedCourses,
    source: 'excel_import_2026',
    notes,
    rawContactParts: contactEntries.map((item) => item.raw).filter(Boolean),
    phones,
  };
}

async function importStudents() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.file) {
    console.error('Вкажіть файл: node scripts/import-students-from-excel.js --file "D:\\Школа\\База учні.xlsx"');
    process.exit(1);
  }

  const workbook = XLSX.readFile(options.file, { cellDates: false, raw: true });
  const sheetName = options.sheet || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    console.error(`Аркуш "${sheetName}" не знайдено`);
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) {
    console.error('Не вдалося знайти рядок заголовків у файлі');
    process.exit(1);
  }

  const columns = mapColumns(rows[headerRowIndex]);
  if (columns.fullName == null || columns.phones == null) {
    console.error('Не вдалося визначити ключові колонки файлу');
    process.exit(1);
  }

  const sourceRows = rows.slice(headerRowIndex + 1)
    .map((row) => parseStudentRow(row, columns, options))
    .filter(Boolean);

  const selectedRows = Number.isInteger(options.limit)
    ? sourceRows.slice(0, options.limit)
    : sourceRows;

  let created = 0;
  let skipped = 0;
  let duplicates = 0;
  const warnings = [];

  for (const student of selectedRows) {
    const exists = await studentExists(student.fullName, student.birthDate, student.parentPhone);
    if (exists) {
      duplicates += 1;
      skipped += 1;
      continue;
    }

    if (!options.commit) {
      created += 1;
      if (!student.parentPhone) {
        warnings.push(`[dry-run] ${student.fullName}: немає основного телефону`);
      }
      continue;
    }

    const publicId = await generateUniqueStudentPublicId();

    await sql`
      INSERT INTO students (
        public_id,
        full_name,
        email,
        parent_name,
        parent_phone,
        notes,
        birth_date,
        photo,
        school,
        discount,
        parent_relation,
        parent2_name,
        parent2_phone,
        parent2_relation,
        interested_courses,
        source,
        gender
      ) VALUES (
        ${publicId},
        ${student.fullName},
        ${null},
        ${student.parentName},
        ${student.parentPhone},
        ${student.notes},
        ${student.birthDate},
        ${null},
        ${student.school},
        ${null},
        ${student.parentRelation},
        ${student.parent2Name},
        ${student.parent2Phone},
        ${student.parent2Relation},
        ${student.interestedCourses},
        ${student.source},
        ${null}
      )
    `;

    created += 1;
    if (!student.parentPhone) {
      warnings.push(`${student.fullName}: немає основного телефону`);
    }
  }

  console.log(`Режим: ${options.commit ? 'COMMIT' : 'DRY-RUN'}`);
  console.log(`Аркуш: ${sheetName}`);
  console.log(`Рядків до обробки: ${selectedRows.length}`);
  console.log(`Буде/створено записів: ${created}`);
  console.log(`Пропущено дублікатів: ${duplicates}`);
  console.log(`Інші пропуски: ${skipped - duplicates}`);

  if (warnings.length > 0) {
    console.log('\nПопередження:');
    warnings.slice(0, 30).forEach((warning) => console.log(`- ${warning}`));
    if (warnings.length > 30) {
      console.log(`- ... ще ${warnings.length - 30}`);
    }
  }

  console.log('\nПриклад розбору перших 5 учнів:');
  selectedRows.slice(0, 5).forEach((student) => {
    console.log(JSON.stringify({
      fullName: student.fullName,
      birthDate: student.birthDate,
      school: student.school,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      parentRelation: student.parentRelation,
      parent2Name: student.parent2Name,
      parent2Phone: student.parent2Phone,
      parent2Relation: student.parent2Relation,
      interestedCourses: student.interestedCourses,
      notes: student.notes,
    }, null, 2));
  });
}

importStudents().catch((error) => {
  console.error('Помилка імпорту:', error);
  process.exit(1);
});
