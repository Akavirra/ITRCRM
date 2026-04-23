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

const DEFAULT_RETENTION = {
  excelRetentionDays: 14,
  jsonKeepAllDays: 14,
  jsonKeepDailyDays: 90,
  jsonKeepWeeklyDays: 180,
};

const DEFAULT_SCHEDULE = {
  enabled: false,
  frequency: 'daily',
  time: '03:00',
  weekdays: [1, 2, 3, 4, 5],
};

function normalizeRetention(input: unknown) {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const toDays = (key: keyof typeof DEFAULT_RETENTION) => {
    const raw = source[key];
    const numeric = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(numeric)) return DEFAULT_RETENTION[key];
    return Math.max(0, Math.floor(numeric));
  };

  const excelRetentionDays = toDays('excelRetentionDays');
  const jsonKeepAllDays = toDays('jsonKeepAllDays');
  const jsonKeepDailyDays = Math.max(jsonKeepAllDays, toDays('jsonKeepDailyDays'));
  const jsonKeepWeeklyDays = Math.max(jsonKeepDailyDays, toDays('jsonKeepWeeklyDays'));

  return {
    excelRetentionDays,
    jsonKeepAllDays,
    jsonKeepDailyDays,
    jsonKeepWeeklyDays,
  };
}

function normalizeSchedule(input: unknown) {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const time = typeof source.time === 'string' && /^\d{2}:\d{2}$/.test(source.time)
    ? source.time
    : DEFAULT_SCHEDULE.time;
  const [hour, minute] = time.split(':').map(Number);
  const safeTime = hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
    ? time
    : DEFAULT_SCHEDULE.time;
  const weekdays = Array.isArray(source.weekdays)
    ? source.weekdays
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    : DEFAULT_SCHEDULE.weekdays;

  return {
    enabled: source.enabled === true,
    frequency: source.frequency === 'weekly' ? 'weekly' : 'daily',
    time: safeTime,
    weekdays: weekdays.length > 0 ? Array.from(new Set(weekdays)) : DEFAULT_SCHEDULE.weekdays,
  };
}

async function saveSystemSetting(key: string, value: unknown) {
  await query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

function normalizeBackupSettings(body: any) {
  const categories = Array.isArray(body?.categories)
    ? body.categories.filter((value: unknown): value is BackupCategory => typeof value === 'string')
    : [];

  return {
    categories,
    format: body?.format === 'excel' ? 'excel' : 'json',
    retention: normalizeRetention(body?.retention),
    schedule: normalizeSchedule(body?.schedule),
  };
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json().catch(() => null);
    const { categories, format, retention, schedule } = normalizeBackupSettings(body);

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
        retention,
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
      retention,
      schedule,
      retentionResult: backup?.retention ?? null,
      results: Array.isArray(backup?.results) ? backup.results : [],
    };

    await saveSystemSetting('last_backup_status', statusPayload);
    await saveSystemSetting('backup_settings', {
      categories,
      format,
      retention,
      schedule,
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

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json().catch(() => null);
    const settings = normalizeBackupSettings(body);

    if (settings.categories.length === 0) {
      return badRequest('Категорії для бекапу не вибрані');
    }

    await saveSystemSetting('backup_settings', settings);

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('Backup Settings API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Помилка при збереженні налаштувань бекапу' },
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
          retention: DEFAULT_RETENTION,
          schedule: DEFAULT_SCHEDULE,
        },
  });
}
