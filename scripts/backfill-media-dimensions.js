require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

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
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get token: ' + JSON.stringify(data));
  return data.access_token;
}

async function getFileDimensions(token, driveFileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=imageMediaMetadata,videoMediaMetadata`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const meta = data.videoMediaMetadata || data.imageMediaMetadata;
  if (meta?.width && meta?.height) return { width: meta.width, height: meta.height };
  return null;
}

async function run() {
  const files = await sql`
    SELECT id, drive_file_id, file_type, file_name
    FROM media_files
    WHERE media_width IS NULL
      AND file_type IN ('photo', 'video', 'animation')
    ORDER BY id
  `;

  console.log(`Found ${files.length} files without dimensions`);
  if (files.length === 0) return;

  const token = await getAccessToken();
  let updated = 0;

  for (const file of files) {
    const dims = await getFileDimensions(token, file.drive_file_id);
    if (dims) {
      await sql`
        UPDATE media_files SET media_width = ${dims.width}, media_height = ${dims.height}
        WHERE id = ${file.id}
      `;
      console.log(`✓ ${file.file_name}: ${dims.width}×${dims.height}`);
      updated++;
    } else {
      console.log(`✗ ${file.file_name}: no dimensions found`);
    }
  }

  console.log(`\nUpdated ${updated}/${files.length} files`);
}

run().catch(err => { console.error(err); process.exit(1); });
