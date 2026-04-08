interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink: string;
  size?: string;
}

interface DriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

// Cache access token in module scope — survives across warm Vercel invocations
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, or GOOGLE_OAUTH_REFRESH_TOKEN');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to refresh Google access token: ${err}`);
  }

  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) };
  return data.access_token;
}

export async function getGoogleDriveAccessToken(): Promise<string> {
  return getAccessToken();
}

// Find a folder by name inside a parent folder (returns null if not found)
async function findFolder(name: string, parentId: string): Promise<string | null> {
  const token = await getAccessToken();
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Drive findFolder failed: ${await res.text()}`);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function findFolderWithMetadata(name: string, parentId: string): Promise<DriveFolder | null> {
  const token = await getAccessToken();
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Drive findFolderWithMetadata failed: ${await res.text()}`);

  const data = await res.json();
  return data.files?.[0] ?? null;
}

// Create a folder inside a parent folder
async function createFolder(name: string, parentId: string): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
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
  });

  if (!res.ok) throw new Error(`Drive createFolder failed: ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

async function createFolderWithMetadata(name: string, parentId: string): Promise<DriveFolder> {
  const token = await getAccessToken();
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
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
  });

  if (!res.ok) throw new Error(`Drive createFolderWithMetadata failed: ${await res.text()}`);
  return res.json();
}

// Get existing folder or create it — used for topic folders
export async function getOrCreateTopicFolder(topicName: string): Promise<string> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID is not set');

  const existing = await findFolder(topicName, rootId);
  if (existing) return existing;
  return createFolder(topicName, rootId);
}

export function sanitizeDriveFolderName(name: string, fallback: string = 'Без назви'): string {
  const normalized = name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const finalName = normalized || fallback;
  return finalName.slice(0, 120);
}

export function getDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export async function getOrCreateFolder(parentId: string, folderName: string): Promise<DriveFolder> {
  const sanitizedName = sanitizeDriveFolderName(folderName);
  const existing = await findFolderWithMetadata(sanitizedName, parentId);

  if (existing) {
    return {
      ...existing,
      webViewLink: existing.webViewLink ?? getDriveFolderUrl(existing.id),
    };
  }

  const created = await createFolderWithMetadata(sanitizedName, parentId);
  return {
    ...created,
    webViewLink: created.webViewLink ?? getDriveFolderUrl(created.id),
  };
}

export async function renameDriveFolder(folderId: string, newName: string): Promise<DriveFolder> {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,webViewLink`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: sanitizeDriveFolderName(newName),
    }),
  });

  if (!res.ok) throw new Error(`Drive renameDriveFolder failed: ${await res.text()}`);
  const data = await res.json();
  return {
    ...data,
    webViewLink: data.webViewLink ?? getDriveFolderUrl(data.id),
  };
}

// Upload a file buffer to a Drive folder
export async function uploadFileToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string
): Promise<DriveFile> {
  const token = await getAccessToken();

  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const boundary = '-------314159265358979323846';

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    '',
  ].join('\r\n');

  const bodyStart = Buffer.from(body, 'utf-8');
  const bodyEnd = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
  const fullBody = Buffer.concat([bodyStart, buffer, bodyEnd]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Content-Length': String(fullBody.length),
      },
      body: fullBody,
    }
  );

  if (!res.ok) throw new Error(`Drive upload failed: ${await res.text()}`);
  return res.json();
}

export async function createDriveResumableUploadSession(input: {
  fileName: string;
  mimeType: string;
  folderId: string;
  fileSize?: number | null;
}): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,webViewLink,webContentLink,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': input.mimeType,
        ...(typeof input.fileSize === 'number' ? { 'X-Upload-Content-Length': String(input.fileSize) } : {}),
      },
      body: JSON.stringify({
        name: input.fileName,
        parents: [input.folderId],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Drive create resumable upload session failed: ${await res.text()}`);
  }

  const location = res.headers.get('Location');
  if (!location) {
    throw new Error('Drive resumable upload session did not return Location header');
  }

  return location;
}

export async function getDriveFileMetadata(fileId: string): Promise<DriveFile> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,webViewLink,webContentLink,size`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    throw new Error(`Drive get file metadata failed: ${await res.text()}`);
  }

  return res.json();
}

export async function fetchDriveFileContent(fileId: string, range?: string | null): Promise<Response> {
  const token = await getAccessToken();
  return fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(range ? { Range: range } : {}),
      },
    }
  );
}

// Make a file publicly readable (so anyone with link can view/download)
export async function makeFilePublic(fileId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  if (!res.ok) throw new Error(`Drive makeFilePublic failed: ${await res.text()}`);
}

// Delete a file from Drive
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  // 404 is fine — file already deleted
  if (!res.ok && res.status !== 404) {
    throw new Error(`Drive deleteFile failed: ${await res.text()}`);
  }
}

export function getDriveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function getDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function getDriveThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
}
