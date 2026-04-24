/**
 * Показує, для якого Google-акаунту видано OAuth refresh token.
 * Важливо: саме цей акаунт МАЄ мати доступ до папки Student Works.
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

(async () => {
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
  const token = (await r.json()).access_token;

  const about = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,permissionId),storageQuota',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await about.json();
  console.log('OAuth акаунт:');
  console.log('  Email:', data.user?.emailAddress);
  console.log('  Імʼя: ', data.user?.displayName);
  console.log('  Storage used:', Number(data.storageQuota?.usage || 0) / 1024 / 1024 / 1024, 'GB');
  console.log('  Storage total:', Number(data.storageQuota?.limit || 0) / 1024 / 1024 / 1024, 'GB');
  console.log('\n👉 Саме цей акаунт має мати доступ до папки Student Works.');
  console.log('   Або поділись папкою з цим email, або створи папку в цьому акаунті.');

  // Also show where the existing admin root folder is — щоб зрозуміти, де інші папки
  if (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID) {
    const rootRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID}?fields=id,name,parents,webViewLink,driveId&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (rootRes.ok) {
      const root = await rootRes.json();
      console.log('\n📁 Для порівняння, адмінська root-папка (GOOGLE_DRIVE_ROOT_FOLDER_ID):');
      console.log('   Name:', root.name);
      console.log('   URL: ', root.webViewLink);
      console.log('   driveId:', root.driveId || '(My Drive, не Shared Drive)');
    }
  }
})();
