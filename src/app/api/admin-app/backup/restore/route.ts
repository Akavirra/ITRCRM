import { gunzipSync } from 'node:zlib';
import { NextRequest, NextResponse } from 'next/server';
import { run } from '@/db/neon';
import { badRequest, getAuthUser, unauthorized } from '@/lib/api-utils';
import { fetchDriveFileContent, getDriveFileMetadata } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

type BackupTablesPayload = Record<string, Array<Record<string, unknown>>>;

function decodeBackupJson(fileName: string, buffer: Buffer): BackupTablesPayload {
  const raw = fileName.endsWith('.gz') ? gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (
    parsed &&
    typeof parsed === 'object' &&
    'tables' in parsed &&
    parsed.tables &&
    typeof parsed.tables === 'object'
  ) {
    return parsed.tables as BackupTablesPayload;
  }

  return parsed as BackupTablesPayload;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return unauthorized();

  try {
    const { fileId } = await request.json();
    if (!fileId) return badRequest('ID файлу не вказано');

    const metadata = await getDriveFileMetadata(fileId);
    if (!metadata.name.endsWith('.json') && !metadata.name.endsWith('.json.gz')) {
      return badRequest('Для відновлення підтримується лише JSON backup');
    }

    const response = await fetchDriveFileContent(fileId);
    if (!response.ok) throw new Error('Не вдалося завантажити файл з Google Drive');

    const buffer = Buffer.from(await response.arrayBuffer());
    const data = decodeBackupJson(metadata.name, buffer);
    const tables = Object.keys(data);

    for (const table of tables) {
      const rows = data[table];
      if (!Array.isArray(rows)) continue;

      await run(`DELETE FROM ${table}`);

      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const columnNames = columns.join(', ');

        await run(`INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`, values);
      }
    }

    return NextResponse.json({ success: true, restoredTables: tables });
  } catch (error: any) {
    console.error('Restore API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Помилка при відновленні даних' },
      { status: 500 }
    );
  }
}
