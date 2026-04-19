/**
 * End-to-end smoke-test автентифікації учнів.
 *
 * Викликає функції @/lib/student-credentials (admin-side) і @/lib/student-auth
 * (student-side) безпосередньо — не через HTTP. Перевіряє повний цикл:
 *   1. issuePinCard → отримано code + pin
 *   2. loginStudent з правильним PIN → сесія створена
 *   3. getStudentFromRequest → той самий учень
 *   4. loginStudent з неправильним PIN → StudentAuthError invalid_credentials
 *   5. revokePinCard → login з правильним PIN тепер падає
 *
 * ⚠️ Тестує на РЕАЛЬНОМУ учневі з БД. За замовчуванням — перший активний учень
 * з students (ORDER BY id). PIN-картка для нього буде перегенерована у процесі —
 * якщо була активна до запуску, доведеться згенерувати нову.
 *
 * Запуск: node scripts/smoke-test-student-auth.js
 */

const fs = require('fs');
const path = require('path');

// Завантажуємо .env.local
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  }
}

// Щоб обійти stale Neon pooler cache (як у test-student-isolation.js)
if (process.env.DATABASE_URL_STUDENT) {
  process.env.DATABASE_URL_STUDENT = process.env.DATABASE_URL_STUDENT.replace('-pooler.', '.');
}

// Shim 'server-only' — Next.js-пакет, який падає у Node-скриптах. Для тесту пусто.
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === 'server-only') return require.resolve('./noop-server-only.js');
  // Аліас @/* → src/*
  if (req.startsWith('@/')) {
    return origResolve.call(this, path.resolve(process.cwd(), 'src', req.slice(2)), ...rest);
  }
  return origResolve.call(this, req, ...rest);
};

// Реєструємо ts-node щоб Node виконував TypeScript з src/
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    moduleResolution: 'node',
    esModuleInterop: true,
    resolveJsonModule: true,
    jsx: 'preserve',
  },
});

let passed = 0;
let failed = 0;

function ok(name) {
  console.log(`   ✅ ${name}`);
  passed++;
}
function fail(name, err) {
  console.log(`   ❌ ${name}`);
  if (err) console.log(`      ${err.message || err}`);
  failed++;
}

async function main() {
  const { neon } = require('@neondatabase/serverless');
  const adminSql = neon(process.env.DATABASE_URL);

  console.log('🔍 Знаходимо активного учня для тесту...');
  const [student] = await adminSql`
    SELECT id, full_name FROM students WHERE is_active = TRUE ORDER BY id LIMIT 1
  `;
  if (!student) {
    console.error('❌ У БД немає активних учнів. Додайте хоча б одного і повторіть.');
    process.exit(1);
  }
  console.log(`   → учень id=${student.id}, ${student.full_name}`);

  console.log('\n1️⃣  Генерація PIN-картки (admin side)');
  const { issuePinCard, revokePinCard, getPinCardStatus } = require('../src/lib/student-credentials.ts');
  let card;
  try {
    card = await issuePinCard(student.id, /*adminUserId=*/ 1);
    ok(`видано картку: code=${card.code}, pin=${card.pin.replace(/\d/g, '•')}`);
    if (card.code !== `R${String(student.id).padStart(4, '0')}`) {
      fail(`код не узгоджений з id: очікував R0***${student.id}, отримав ${card.code}`);
    } else ok('формат коду R0XXX коректний');
    if (!/^\d{6}$/.test(card.pin)) fail('PIN не 6 цифр');
    else ok('PIN — 6 цифр');
  } catch (e) {
    fail('issuePinCard', e);
    return;
  }

  const status = await getPinCardStatus(student.id);
  if (status.hasActivePin && status.pinLast2 === card.pin.slice(-2)) {
    ok(`статус: активна картка, останні 2 цифри PIN = ${status.pinLast2}`);
  } else {
    fail('getPinCardStatus: очікував активну картку з last2');
  }

  console.log('\n2️⃣  Логін з правильним PIN (student side)');
  const {
    loginStudent,
    StudentAuthError,
    getStudentSession,
    deleteStudentSession,
  } = require('../src/lib/student-auth.ts');

  let session;
  try {
    const result = await loginStudent(card.code, card.pin, '127.0.0.1', 'smoke-test/1.0');
    if (result.studentId === student.id) ok(`login OK, sessionId=${result.sessionId.slice(0, 8)}…`);
    else fail(`studentId mismatch: got ${result.studentId}, expected ${student.id}`);
    session = result.sessionId;
  } catch (e) {
    fail('loginStudent з правильним PIN', e);
    return;
  }

  console.log('\n3️⃣  getStudentSession для щойно створеної сесії');
  const sess = await getStudentSession(session);
  if (sess && sess.student_id === student.id) ok('сесія знайдена, student_id збігається');
  else fail('сесію не знайдено або student_id інший');

  console.log('\n4️⃣  Логін з неправильним PIN');
  const wrongPin = card.pin === '000000' ? '999999' : '000000';
  try {
    await loginStudent(card.code, wrongPin, '127.0.0.2', 'smoke-test/1.0');
    fail('login з неправильним PIN пройшов (мав кинути StudentAuthError)');
  } catch (e) {
    if (e instanceof StudentAuthError && e.code === 'invalid_credentials') {
      ok('login з неправильним PIN заблокований (invalid_credentials)');
    } else {
      fail(`неочікувана помилка: ${e.message}`);
    }
  }

  console.log('\n5️⃣  Логін з неіснуючим кодом');
  try {
    await loginStudent('R9999999', card.pin, '127.0.0.3', 'smoke-test/1.0');
    fail('login з неіснуючим кодом пройшов');
  } catch (e) {
    if (e instanceof StudentAuthError && e.code === 'invalid_credentials') {
      ok('login з неіснуючим кодом заблокований');
    } else {
      fail(`неочікувана помилка: ${e.message}`);
    }
  }

  console.log('\n6️⃣  Logout (видалення сесії)');
  await deleteStudentSession(session);
  const afterLogout = await getStudentSession(session);
  if (!afterLogout) ok('сесія видалена');
  else fail('сесія все ще існує після deleteStudentSession');

  console.log('\n7️⃣  Revoke PIN-картки');
  await revokePinCard(student.id);
  try {
    await loginStudent(card.code, card.pin, '127.0.0.4', 'smoke-test/1.0');
    fail('login пройшов після revoke (не мав!)');
  } catch (e) {
    if (e instanceof StudentAuthError && e.code === 'invalid_credentials') {
      ok('login після revoke заблокований');
    } else {
      fail(`неочікувана помилка: ${e.message}`);
    }
  }

  console.log('\n8️⃣  Cleanup: видалення тестових login attempts і audit-логів');
  // Видаляємо тестові записи з admin-ролі (crm_student не має DELETE на audit_log? має — він у FULL_ACCESS)
  await adminSql`
    DELETE FROM student_login_attempts WHERE ip IN ('127.0.0.1', '127.0.0.2', '127.0.0.3', '127.0.0.4')
  `;
  await adminSql`
    DELETE FROM student_audit_log WHERE student_id = ${student.id} AND ip IN ('127.0.0.1', '127.0.0.2', '127.0.0.3', '127.0.0.4')
  `;
  ok('тестові записи очищено');

  console.log(`\n📊 Результати: ${passed} пройдено, ${failed} провалено`);
  if (failed > 0) {
    console.log('❌ Auth flow зламаний — перевірте src/lib/student-auth.ts + student-credentials.ts');
    process.exit(1);
  } else {
    console.log('🎉 Auth flow працює коректно!');
    console.log('\n⚠️  УВАГА: PIN-картка для учня id=' + student.id + ' ВІДКЛИКАНА тестом.');
    console.log('   Якщо ви вже роздали йому картку — згенеруйте нову в адмінці.');
  }
}

main().catch((e) => {
  console.error('\n❌ Фатальна помилка:', e);
  process.exit(1);
});
