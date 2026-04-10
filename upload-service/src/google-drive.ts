import { google, drive_v3 } from 'googleapis';
import { PassThrough, type Readable } from 'node:stream';
import { config } from './config.js';
import type { LessonMediaContext } from './types.js';

const LESSON_PHOTOS_FALLBACK_TOPIC = 'Без теми';

function getOauthClient() {
  const client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret
  );

  client.setCredentials({
    refresh_token: config.googleRefreshToken,
  });

  return client;
}

function getDriveClient() {
  return google.drive({
    version: 'v3',
    auth: getOauthClient(),
  });
}

function sanitizeDriveName(input: string | null | undefined, fallback: string): string {
  const cleaned = (input || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.slice(0, 120) || fallback;
}

function formatLessonFolderDate(value: string | null): string {
  if (!value) {
    return '00.00.00';
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}.${match[2]}.${match[1].slice(-2)}`;
    }

    return '00.00.00';
  }

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

function buildLessonFolderName(context: LessonMediaContext): string {
  const topic = sanitizeDriveName(context.topic, LESSON_PHOTOS_FALLBACK_TOPIC);
  return `${formatLessonFolderDate(context.lessonDate)} ${topic}`;
}

async function findFolderByName(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<drive_v3.Schema$File | null> {
  const escapedName = name.replace(/'/g, "\\'");
  const response = await drive.files.list({
    q: [
      `'${parentId}' in parents`,
      `name = '${escapedName}'`,
      "mimeType = 'application/vnd.google-apps.folder'",
      'trashed = false',
    ].join(' and '),
    fields: 'files(id,name,webViewLink)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return response.data.files?.[0] || null;
}

async function createFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<drive_v3.Schema$File> {
  const response = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id,name,webViewLink',
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error(`Failed to create folder: ${name}`);
  }

  return response.data;
}

async function getOrCreateFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<drive_v3.Schema$File> {
  const existing = await findFolderByName(drive, parentId, name);
  if (existing?.id) {
    return existing;
  }

  return createFolder(drive, parentId, name);
}

export async function ensureLessonFolder(context: LessonMediaContext) {
  const drive = getDriveClient();
  const rootFolder = await getOrCreateFolder(drive, config.driveRootFolderId, config.lessonPhotosRootName);
  const courseFolder = await getOrCreateFolder(
    drive,
    rootFolder.id!,
    sanitizeDriveName(context.courseTitle, 'Без курсу')
  );
  const groupFolder = await getOrCreateFolder(
    drive,
    courseFolder.id!,
    sanitizeDriveName(context.groupTitle, `Група ${context.lessonId}`)
  );
  const lessonFolder = await getOrCreateFolder(
    drive,
    groupFolder.id!,
    buildLessonFolderName(context)
  );

  return {
    id: lessonFolder.id!,
    name: lessonFolder.name || buildLessonFolderName(context),
    url: lessonFolder.webViewLink || `https://drive.google.com/drive/folders/${lessonFolder.id}`,
    exists: true,
  };
}

export async function uploadStreamToDrive(input: {
  stream: Readable;
  folderId: string;
  fileName: string;
  mimeType: string;
}): Promise<{ id: string; name: string; mimeType: string; size: number }> {
  const drive = getDriveClient();
  const proxyStream = new PassThrough();
  let size = 0;

  input.stream.on('data', (chunk: Buffer | string) => {
    size += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
  });
  input.stream.pipe(proxyStream);

  const response = await drive.files.create({
    requestBody: {
      name: sanitizeDriveName(input.fileName, 'lesson-media'),
      parents: [input.folderId],
    },
    media: {
      mimeType: input.mimeType,
      body: proxyStream,
    },
    fields: 'id,name,mimeType',
    supportsAllDrives: true,
  });

  if (!response.data.id || !response.data.name || !response.data.mimeType) {
    throw new Error('Google Drive did not return uploaded file metadata');
  }

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    size,
  };
}

export async function makeFilePublic(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
  });
}
