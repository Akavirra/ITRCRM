import { gunzipSync } from 'node:zlib';

export type BackupTablesPayload = Record<string, Array<Record<string, unknown>>>;

export interface DecodedBackupPayload {
  version: string | null;
  createdAt: string | null;
  category: string | null;
  createdBy: unknown;
  tables: BackupTablesPayload;
}

export const RESTORE_TABLES = [
  'students',
  'student_groups',
  'individual_balances',
  'payments',
  'individual_payments',
  'pricing',
  'attendance',
  'groups',
  'group_teacher_assignments',
  'courses',
  'users',
  'system_settings',
  'user_settings',
] as const;

export const RESTORE_CATEGORY_TABLES: Record<string, string[]> = {
  students: ['students', 'student_groups', 'individual_balances'],
  payments: ['payments', 'individual_payments', 'pricing'],
  attendance: ['attendance'],
  groups: ['groups', 'group_teacher_assignments'],
  courses: ['courses'],
  system: ['users', 'system_settings', 'user_settings'],
};

const RESTORE_TABLE_SET = new Set<string>(RESTORE_TABLES);
const RESTORE_TABLE_CONFLICT_COLUMNS: Record<string, string[]> = {
  system_settings: ['key'],
  user_settings: ['user_id'],
};

export function decodeBackupPayload(fileName: string, buffer: Buffer): DecodedBackupPayload {
  const raw = fileName.endsWith('.gz') ? gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
  const parsed = JSON.parse(raw) as any;

  if (
    parsed &&
    typeof parsed === 'object' &&
    parsed.tables &&
    typeof parsed.tables === 'object'
  ) {
    return {
      version: typeof parsed.version === 'string' ? parsed.version : null,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : null,
      category: typeof parsed.category === 'string' ? parsed.category : null,
      createdBy: parsed.createdBy ?? null,
      tables: parsed.tables as BackupTablesPayload,
    };
  }

  return {
    version: null,
    createdAt: null,
    category: null,
    createdBy: null,
    tables: parsed as BackupTablesPayload,
  };
}

export function validateRestoreTables(tables: BackupTablesPayload): string[] {
  const tableNames = Object.keys(tables);

  for (const table of tableNames) {
    if (!RESTORE_TABLE_SET.has(table)) {
      throw new Error(`Backup містить непідтримувану таблицю: ${table}`);
    }

    if (!Array.isArray(tables[table])) {
      throw new Error(`Некоректні дані таблиці в backup: ${table}`);
    }
  }

  return tableNames;
}

export function getRestoreDeleteOrder(tableNames: string[]): string[] {
  const set = new Set(tableNames);
  return [...RESTORE_TABLES].reverse().filter((table) => set.has(table));
}

export function getRestoreInsertOrder(tableNames: string[]): string[] {
  const set = new Set(tableNames);
  return [...RESTORE_TABLES].filter((table) => set.has(table));
}

export function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function getRestoreConflictColumns(tableName: string, columns: string[]): string[] {
  const configured = RESTORE_TABLE_CONFLICT_COLUMNS[tableName];
  if (configured && configured.every((column) => columns.includes(column))) {
    return configured;
  }

  return columns.includes('id') ? ['id'] : [];
}

export function inferBackupCategory(tableNames: string[], fallback: string | null): string | null {
  if (fallback && RESTORE_CATEGORY_TABLES[fallback]) {
    return fallback;
  }

  const tableSet = new Set(tableNames);
  for (const [category, tables] of Object.entries(RESTORE_CATEGORY_TABLES)) {
    if (tables.some((table) => tableSet.has(table))) {
      return category;
    }
  }

  return null;
}
