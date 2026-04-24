/**
 * Перевірка, що поточний OAuth (GOOGLE_OAUTH_REFRESH_TOKEN) може читати/писати
 * у папку Student Works (GOOGLE_DRIVE_STUDENT_WORKS_ROOT_FOLDER_ID).
 *
 * Що робить:
 *   1. Отримує access token через refresh token
 *   2. GET /drive/v3/files/{folderId} — перевіряє існування + права читання
 *   3. POST /drive/v3/files — створює тестову папку «__verify__<timestamp>»
 *   4. DELETE /drive/v3/files/{id} — видаляє її одразу
 *
 * Якщо все гаразд — OK, можна запускати upload.
 *
 * Використання:
 *   GOOGLE_DRIVE_STUDENT_WORKS_ROOT_FOLDER_ID=192pl... node scripts/verify-student-works-folder.js
 *   (або додати в .env.local та просто запустити)
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

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`refresh failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function main() {
  const required = [
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'GOOGLE_OAUTH_REFRESH_TOKEN',
    'GOOGLE_DRIVE_STUDENT_WORKS_ROOT_FOLDER_ID',
  ];
  const missing = required.filter((n) => !process.env[n]);
  if (missing.length) {
    console.error('❌ Відсутні env змінні:', missing.join(', '));
    console.error('   Додай у .env.local:');
    for (const n of missing) console.error(`     ${n}=...`);
    process.exit(1);
  }

  const folderId = process.env.GOOGLE_DRIVE_STUDENT_WORKS_ROOT_FOLDER_ID;
  console.log('🔑 Оновлюємо access_token через refresh_token...');
  const token = await getAccessToken();
  console.log('   ✅ Отримано access_token');

  // 1. Перевірка, що папка існує й доступна на читання
  console.log(`\n📁 Перевіряємо folder ID = ${folderId}...`);
  const getRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,parents,webViewLink&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!getRes.ok) {
    console.error(`   ❌ GET folder failed: ${getRes.status} — ${await getRes.text()}`);
    console.error('   Можливі причини:');
    console.error('     • Папка належить іншому Google-акаунту (не тому, для якого видано OAuth)');
    console.error('     • Неправильний folder ID');
    console.error('     • Папка у Shared Drive, а OAuth без permissions');
    process.exit(1);
  }
  const folder = await getRes.json();
  if (folder.mimeType !== 'application/vnd.google-apps.folder') {
    console.error(`   ❌ Цей ID веде НЕ на папку, а на: ${folder.mimeType}`);
    process.exit(1);
  }
  console.log(`   ✅ Знайдено папку: "${folder.name}"`);
  console.log(`      URL: ${folder.webViewLink}`);

  // 2. Тест запису — створення тимчасової підпапки
  const testName = `__verify__${Date.now()}`;
  console.log(`\n✏️  Тестуємо write: створюємо "${testName}"...`);
  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: testName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId],
      }),
    }
  );
  if (!createRes.ok) {
    console.error(`   ❌ Create failed: ${createRes.status} — ${await createRes.text()}`);
    console.error('   OAuth має право читати, але НЕ писати в цю папку.');
    process.exit(1);
  }
  const created = await createRes.json();
  console.log(`   ✅ Створено тестову підпапку id=${created.id}`);

  // 3. Видаляємо одразу (cleanup)
  console.log('\n🗑️  Видаляємо тестову підпапку...');
  const delRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${created.id}?supportsAllDrives=true`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!delRes.ok && delRes.status !== 404) {
    console.warn(`   ⚠️  Delete failed (${delRes.status}): ${await delRes.text()}`);
    console.warn('   Тестова папка лишилась у Drive — видали руками.');
  } else {
    console.log('   ✅ Cleanup ок');
  }

  console.log('\n🎉 Все гаразд! OAuth може читати й писати в Student Works.');
  console.log('   Можна додавати env на Vercel + Railway та кодити upload-флоу.');
}

main().catch((err) => {
  console.error('\n❌ Помилка:', err.message);
  process.exit(1);
});
