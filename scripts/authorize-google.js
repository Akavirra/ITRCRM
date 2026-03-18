/**
 * Generates a new Google OAuth refresh token with Drive + Photos scopes.
 * Uses a localhost callback server (no OOB — deprecated by Google).
 *
 * Before running, add http://localhost:3001 to your OAuth Client's
 * "Authorized redirect URIs" in Google Cloud Console.
 *
 * Run: node scripts/authorize-google.js
 */
require('dotenv').config({ path: '.env.local' });
const http = require('http');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

const PORT = 3001;
const REDIRECT_URI = `http://localhost:${PORT}`;

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
].join(' ');

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth' +
  '?client_id=' + encodeURIComponent(CLIENT_ID) +
  '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
  '&response_type=code' +
  '&scope=' + encodeURIComponent(SCOPES) +
  '&access_type=offline' +
  '&prompt=consent';

// Start a one-shot localhost server to receive the OAuth callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>Помилка: ${error}</h2><p>Можна закрити це вікно.</p>`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Код не знайдено</h2><p>Можна закрити це вікно.</p>');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h2>✓ Авторизація успішна!</h2><p>Можна закрити це вікно та повернутись до терміналу.</p>');
  server.close();

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = await tokenRes.json();

    if (data.refresh_token) {
      console.log('\n✓ Успішно!\n');
      console.log('Додай або заміни в .env.local і Vercel Environment Variables:\n');
      console.log('GOOGLE_OAUTH_REFRESH_TOKEN=' + data.refresh_token);
      console.log('\nЦей токен має доступ до Google Drive + Google Фото.\n');
    } else {
      console.error('\n✗ Токен не отримано:', JSON.stringify(data, null, 2));
      console.error('\nПереконайся що http://localhost:3001 додано в Authorized redirect URIs у Google Cloud Console.\n');
    }
  } catch (err) {
    console.error('\n✗ Помилка обміну коду:', err.message);
  }
});

server.listen(PORT, () => {
  console.log('\n=== Google OAuth Token Generator (Drive + Photos) ===\n');
  console.log('Відкрий це посилання у браузері (увійди під потрібним Google акаунтом):\n');
  console.log(authUrl);
  console.log(`\nОчікую callback на http://localhost:${PORT} ...\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✗ Порт ${PORT} вже зайнятий. Зупини інший процес на цьому порту і спробуй знову.\n`);
  } else {
    console.error('\n✗ Помилка сервера:', err.message);
  }
  process.exit(1);
});
