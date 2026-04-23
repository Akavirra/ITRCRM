import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/db/neon';
import { badRequest, getAuthUser, unauthorized } from '@/lib/api-utils';
import {
  decodeBackupPayload,
  getRestoreConflictColumns,
  getRestoreInsertOrder,
  inferBackupCategory,
  quoteIdentifier,
  validateRestoreTables,
} from '@/lib/backup-restore';
import { createBackupServiceToken, getBackupServiceUrl } from '@/lib/backup-service';
import { fetchDriveFileContent, getDriveFileMetadata } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

async function saveSystemSetting(key: string, value: unknown) {
  await query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

async function createEmergencyBackup(input: {
  category: string;
  user: { id?: number | null; name?: string | null; role?: string | null };
}) {
  const token = createBackupServiceToken({
    userId: typeof input.user.id === 'number' ? input.user.id : null,
    userName: typeof input.user.name === 'string' ? input.user.name : null,
    role: typeof input.user.role === 'string' ? input.user.role : null,
  });

  const response = await fetch(`${getBackupServiceUrl()}/backup/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      categories: [input.category],
      includeExcel: false,
    }),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || 'Не вдалося створити emergency backup перед restore');
  }

  return data?.backup ?? null;
}

async function restoreRow(table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row);
  if (columns.length === 0) return { restored: false, reason: 'empty-row' };

  const conflictColumns = getRestoreConflictColumns(table, columns);
  if (conflictColumns.length === 0) {
    return { restored: false, reason: 'missing-conflict-column' };
  }

  const values = Object.values(row);
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const columnNames = columns.map(quoteIdentifier).join(', ');
  const conflictTarget = conflictColumns.map(quoteIdentifier).join(', ');
  const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
  const updateClause = updateColumns.length > 0
    ? `DO UPDATE SET ${updateColumns
        .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
        .join(', ')}`
    : 'DO NOTHING';

  await run(
    `INSERT INTO ${quoteIdentifier(table)} (${columnNames})
     VALUES (${placeholders})
     ON CONFLICT (${conflictTarget}) ${updateClause}`,
    values
  );

  return { restored: true, reason: null };
}

async function syncSerialSequence(table: string) {
  try {
    await run(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX("id") FROM ${quoteIdentifier(table)}), 1), true)`,
      [table]
    );
  } catch {
    // Some restored tables use non-serial primary keys. Sequence sync is best-effort.
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return unauthorized();

  try {
    const { fileId, confirmation } = await request.json();
    if (!fileId) return badRequest('ID файлу не вказано');
    if (confirmation !== 'RESTORE') {
      return badRequest('Для відновлення потрібно підтвердження RESTORE');
    }

    const metadata = await getDriveFileMetadata(fileId);
    if (!metadata.name.endsWith('.json') && !metadata.name.endsWith('.json.gz')) {
      return badRequest('Для відновлення підтримується лише JSON backup');
    }

    const response = await fetchDriveFileContent(fileId);
    if (!response.ok) {
      throw new Error('Не вдалося завантажити файл з Google Drive');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const decoded = decodeBackupPayload(metadata.name, buffer);
    const tables = validateRestoreTables(decoded.tables);
    const category = inferBackupCategory(tables, decoded.category);

    if (!category) {
      return badRequest('Не вдалося визначити категорію backup для безпечного emergency backup');
    }

    const emergencyBackup = await createEmergencyBackup({
      category,
      user,
    });

    const restoredTables: Array<{ table: string; rows: number; skipped: number }> = [];

    for (const table of getRestoreInsertOrder(tables)) {
      const rows = decoded.tables[table];
      if (!Array.isArray(rows)) continue;

      let restored = 0;
      let skipped = 0;
      for (const row of rows) {
        const result = await restoreRow(table, row);
        if (result.restored) {
          restored += 1;
        } else {
          skipped += 1;
        }
      }

      if (rows.some((row) => Object.prototype.hasOwnProperty.call(row, 'id'))) {
        await syncSerialSequence(table);
      }

      restoredTables.push({ table, rows: restored, skipped });
    }

    const restoreStatus = {
      timestamp: new Date().toISOString(),
      user: user.name,
      sourceFileId: fileId,
      sourceFileName: metadata.name,
      sourceCreatedAt: decoded.createdAt,
      category,
      mode: 'merge',
      restoredTables,
      emergencyBackup,
    };

    await saveSystemSetting('last_restore_status', restoreStatus);

    return NextResponse.json({
      success: true,
      mode: 'merge',
      restoredTables,
      emergencyBackup,
    });
  } catch (error: any) {
    console.error('Restore API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Помилка при відновленні даних' },
      { status: 500 }
    );
  }
}
