import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/neon';
import { getAuthUser, unauthorized, badRequest } from '@/lib/api-utils';
import {
  decodeBackupPayload,
  getRestoreConflictColumns,
  inferBackupCategory,
  quoteIdentifier,
  validateRestoreTables,
} from '@/lib/backup-restore';
import { fetchDriveFileContent, getDriveFileMetadata } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

async function rowExists(table: string, conflictColumns: string[], row: Record<string, unknown>) {
  const values = conflictColumns.map((column) => row[column]);
  if (values.some((value) => value === null || value === undefined)) {
    return false;
  }

  const where = conflictColumns
    .map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`)
    .join(' AND ');
  const result = await query(
    `SELECT 1 FROM ${quoteIdentifier(table)} WHERE ${where} LIMIT 1`,
    values
  );

  return result.length > 0;
}

async function buildRestoreDryRun(tables: Record<string, Array<Record<string, unknown>>>, tableNames: string[]) {
  const perTable = [];
  let inserts = 0;
  let updates = 0;
  let skipped = 0;

  for (const table of tableNames) {
    const rows = tables[table] ?? [];
    let tableInserts = 0;
    let tableUpdates = 0;
    let tableSkipped = 0;

    for (const row of rows) {
      const columns = Object.keys(row);
      const conflictColumns = getRestoreConflictColumns(table, columns);

      if (columns.length === 0 || conflictColumns.length === 0) {
        tableSkipped += 1;
        continue;
      }

      const exists = await rowExists(table, conflictColumns, row);
      if (exists) {
        tableUpdates += 1;
      } else {
        tableInserts += 1;
      }
    }

    inserts += tableInserts;
    updates += tableUpdates;
    skipped += tableSkipped;
    perTable.push({
      name: table,
      inserts: tableInserts,
      updates: tableUpdates,
      skipped: tableSkipped,
    });
  }

  return {
    mode: 'merge',
    inserts,
    updates,
    skipped,
    tables: perTable,
  };
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return unauthorized();

  try {
    const { fileId } = await request.json();
    if (!fileId) return badRequest('ID файлу не вказано');

    const metadata = await getDriveFileMetadata(fileId);
    if (!metadata.name.endsWith('.json') && !metadata.name.endsWith('.json.gz')) {
      return badRequest('Preview підтримує лише JSON backup');
    }

    const response = await fetchDriveFileContent(fileId);
    if (!response.ok) {
      throw new Error('Не вдалося завантажити файл з Google Drive');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const decoded = decodeBackupPayload(metadata.name, buffer);
    const tableNames = validateRestoreTables(decoded.tables);
    const category = inferBackupCategory(tableNames, decoded.category);
    const dryRun = await buildRestoreDryRun(decoded.tables, tableNames);

    return NextResponse.json({
      file: {
        id: metadata.id,
        name: metadata.name,
        size: metadata.size ? Number(metadata.size) : null,
        url: metadata.webViewLink,
      },
      backup: {
        version: decoded.version,
        createdAt: decoded.createdAt,
        category,
        createdBy: decoded.createdBy,
        tables: tableNames.map((table) => ({
          name: table,
          rows: decoded.tables[table]?.length ?? 0,
        })),
        totalRows: tableNames.reduce((sum, table) => sum + (decoded.tables[table]?.length ?? 0), 0),
      },
      dryRun,
    });
  } catch (error: any) {
    console.error('Backup preview API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Помилка при читанні backup preview' },
      { status: 500 }
    );
  }
}
