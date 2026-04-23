import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getDriveViewUrl, listDriveChildren } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const BACKUP_FILE_PATTERN = /^(.+?)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json(?:\.gz)?$/;

function parseBackupTimestamp(fileName: string): string | null {
  const match = fileName.match(BACKUP_FILE_PATTERN);
  if (!match) return null;

  const raw = match[2];
  return raw.replace(
    /T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    'T$1:$2:$3.$4Z'
  );
}

function parseBackupCategory(fileName: string): string | null {
  return fileName.match(BACKUP_FILE_PATTERN)?.[1] || null;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return unauthorized();

  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_BACKUPS_FOLDER_ID;
    if (!rootFolderId) {
      throw new Error('GOOGLE_DRIVE_BACKUPS_FOLDER_ID is not set');
    }

    const backups = [];
    const dateFolders = await listDriveChildren(rootFolderId);

    for (const dateFolder of dateFolders) {
      if (dateFolder.mimeType !== DRIVE_FOLDER_MIME_TYPE) continue;

      const categoryFolders = await listDriveChildren(dateFolder.id);
      for (const categoryFolder of categoryFolders) {
        if (categoryFolder.mimeType !== DRIVE_FOLDER_MIME_TYPE) continue;

        const files = await listDriveChildren(categoryFolder.id);
        for (const file of files) {
          if (!file.name.endsWith('.json') && !file.name.endsWith('.json.gz')) continue;

          backups.push({
            fileId: file.id,
            fileName: file.name,
            category: parseBackupCategory(file.name) || categoryFolder.name,
            dateFolder: dateFolder.name,
            categoryFolder: categoryFolder.name,
            createdAt: parseBackupTimestamp(file.name) || file.createdTime || file.modifiedTime || null,
            size: file.size ? Number(file.size) : null,
            url: file.webViewLink || getDriveViewUrl(file.id),
          });
        }
      }
    }

    backups.sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return right - left;
    });

    return NextResponse.json({ backups });
  } catch (error: any) {
    console.error('Backup files API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Помилка при завантаженні списку бекапів' },
      { status: 500 }
    );
  }
}
