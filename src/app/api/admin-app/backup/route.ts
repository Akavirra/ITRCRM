import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/neon';
import { badRequest, getAuthUser, unauthorized } from '@/lib/api-utils';
import { createBackupServiceToken, getBackupServiceUrl } from '@/lib/backup-service';

export const dynamic = 'force-dynamic';

type BackupCategory =
  | 'students'
  | 'payments'
  | 'attendance'
  | 'groups'
  | 'courses'
  | 'system';

const DEFAULT_CATEGORIES: BackupCategory[] = [
  'students',
  'payments',
  'attendance',
  'groups',
  'courses',
  'system',
];

async function saveSystemSetting(key: string, value: unknown) {
  await query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json().catch(() => null);
    const categories = Array.isArray(body?.categories)
      ? body.categories.filter((value: unknown): value is BackupCategory => typeof value === 'string')
      : [];
    const format = body?.format === 'excel' ? 'excel' : 'json';

    if (categories.length === 0) {
      return badRequest('Категорії для бекапу не вибрані');
    }

    const token = createBackupServiceToken({
      userId: typeof user.id === 'number' ? user.id : null,
      userName: typeof user.name === 'string' ? user.name : null,
      role: typeof user.role === 'string' ? user.role : null,
    });

    const response = await fetch(`${getBackupServiceUrl()}/backup/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories,
        includeExcel: format === 'excel',
      }),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || 'Сервіс резервного копіювання не відповів');
    }

    const backup = data?.backup;
    const statusPayload = {
      timestamp: backup?.timestamp ?? new Date().toISOString(),
      user: user.name,
      includeExcel: format === 'excel',
      results: Array.isArray(backup?.results) ? backup.results : [],
    };

    await saveSystemSetting('last_backup_status', statusPayload);
    await saveSystemSetting('backup_settings', {
      categories,
      format,
    });

    return NextResponse.json({
      success: true,
      backup: statusPayload,
      date: backup?.date ?? statusPayload.timestamp.slice(0, 10),
    });
  } catch (error: any) {
    console.error('Backup API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Помилка при створенні бекапу' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const lastStatus = await query(`SELECT value FROM system_settings WHERE key = 'last_backup_status'`);
  const settings = await query(`SELECT value FROM system_settings WHERE key = 'backup_settings'`);

  return NextResponse.json({
    lastBackup: lastStatus[0]?.value ? JSON.parse(lastStatus[0].value) : null,
    settings: settings[0]?.value
      ? JSON.parse(settings[0].value)
      : {
          categories: DEFAULT_CATEGORIES,
          format: 'json',
        },
  });
}
