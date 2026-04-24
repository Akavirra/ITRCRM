/**
 * Створює структуру папок для студентського порталу всередині адмінської
 * root-папки CRM (GOOGLE_DRIVE_ROOT_FOLDER_ID = ITR Cloud Storage):
 *
 *   ITR Cloud Storage/
 *     └── ITR_Students Workspace/      ← wrapper для всього студентського
 *           └── Student Works/         ← куди підуть роботи учнів
 *
 * Ідемпотентний: якщо папки вже є — повертає їх ID, нових не створює.
 * Якщо знайде стару плоску "Student Works" в root (без wrapper-а) — видалить її,
 * щоб не було дублів (папка точно порожня після попереднього запуску скрипта).
 *
 * Виводить:
 *   GOOGLE_DRIVE_STUDENT_WORKSPACE_FOLDER_ID=<id wrapper>
 *   GOOGLE_DRIVE_STUDENT_WORKS_ROOT_FOLDER_ID=<id student works>
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

const WORKSPACE_NAME = 'ITR_Students Workspace';
const WORKS_NAME = 'Student Works';

async function getToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) throw new Error(`refresh failed: ${await r.text()}`);
  return (await r.json()).access_token;
}

async function findFolder(token, name, parentId) {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.files?.[0] || null;
}

async function createFolder(token, name, parentId) {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    }
  );
  if (!res.ok) throw new Error(`create "${name}" failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function deleteFolder(token, id) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete ${id} failed: ${res.status} ${await res.text()}`);
  }
}

async function ensureFolder(token, name, parentId) {
  const existing = await findFolder(token, name, parentId);
  if (existing) {
    console.log(`ℹ️  "${name}" вже існує (id=${existing.id})`);
    return existing;
  }
  const created = await createFolder(token, name, parentId);
  console.log(`✅ Створено "${name}" (id=${created.id})`);
  return created;
}

(async () => {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) {
    console.error('❌ GOOGLE_DRIVE_ROOT_FOLDER_ID не задано');
    process.exit(1);
  }

  const token = await getToken();

  // Cleanup: видалити стару плоску "Student Works" в root (якщо лишилась після попереднього запуску)
  const flatOld = await findFolder(token, WORKS_NAME, rootId);
  if (flatOld) {
    console.log(`🗑️  Видаляю стару плоску "${WORKS_NAME}" (id=${flatOld.id}) — тепер буде всередині wrapper-а...`);
    await deleteFolder(token, flatOld.id);
  }

  // 1. Wrapper
  const workspace = await ensureFolder(token, WORKSPACE_NAME, rootId);

  // 2. Student Works всередині wrapper-а
  const works = await ensureFolder(token, WORKS_NAME, workspace.id);

  console.log('\n📁 Структура:');
  console.log(`   ${WORKSPACE_NAME}/`);
  console.log(`     └── ${WORKS_NAME}/`);
  console.log(`\n   Wrapper:      ${workspace.webViewLink}`);
  console.log(`   Student Works: ${works.webViewLink}`);

  console.log('\n📋 Додай у Vercel + Railway env vars (All Environments, Sensitive):');
  console.log(`   GOOGLE_DRIVE_STUDENT_WORKSPACE_FOLDER_ID=${workspace.id}`);
  console.log(`   GOOGLE_DRIVE_STUDENT_WORKS_ROOT_FOLDER_ID=${works.id}`);
  console.log('\n   (WORKSPACE_FOLDER_ID поки що не обов\'язковий — знадобиться,');
  console.log('    коли додамо Certificates/Reports/тощо всередину того самого wrapper-а.)');
})().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
