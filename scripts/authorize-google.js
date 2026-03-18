/**
 * Generates a new Google OAuth refresh token with Drive + Photos scopes.
 * Run: node scripts/authorize-google.js
 */
require('dotenv').config({ path: '.env.local' });
const readline = require('readline');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
].join(' ');

const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth' +
  '?client_id=' + encodeURIComponent(CLIENT_ID) +
  '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
  '&response_type=code' +
  '&scope=' + encodeURIComponent(SCOPES) +
  '&access_type=offline' +
  '&prompt=consent';

console.log('\n=== Google OAuth Token Generator (Drive + Photos) ===\n');
console.log('1. Відкрий це посилання у браузері (увійди під потрібним Google акаунтом):\n');
console.log(authUrl);
console.log('\n2. Дай дозвіл і скопіюй код зі сторінки\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('3. Встав код сюди: ', async (code) => {
  rl.close();
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code.trim(),
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });
    const data = await res.json();
    if (data.refresh_token) {
      console.log('\n✓ Успішно!\n');
      console.log('Додай або заміни в .env.local і Vercel Environment Variables:\n');
      console.log('GOOGLE_OAUTH_REFRESH_TOKEN=' + data.refresh_token);
      console.log('\nЦей токен має доступ до Drive + Google Фото.\n');
    } else {
      console.error('\n✗ Помилка:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('\n✗ Помилка запиту:', err.message);
  }
});
