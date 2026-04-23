import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/neon';
import { createBackupServiceToken, getBackupServiceUrl } from '@/lib/backup-service';

export const dynamic = 'force-dynamic';

const DEFAULT_BACKUP_SETTINGS = {
  categories: ['students', 'payments', 'attendance', 'groups', 'courses', 'system'],
  format: 'json',
  retention: {
    excelRetentionDays: 14,
    jsonKeepAllDays: 14,
    jsonKeepDailyDays: 90,
    jsonKeepWeeklyDays: 180,
  },
  schedule: {
    enabled: false,
    frequency: 'daily',
    time: '03:00',
    weekdays: [1, 2, 3, 4, 5],
  },
};

type BackupSettings = typeof DEFAULT_BACKUP_SETTINGS;

async function saveSystemSetting(key: string, value: unknown) {
  await query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

async function readSystemSetting<T>(key: string, fallback: T): Promise<T> {
  const rows = await query(`SELECT value FROM system_settings WHERE key = $1`, [key]);
  if (!rows[0]?.value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rows[0].value);
    if (
      fallback &&
      typeof fallback === 'object' &&
      !Array.isArray(fallback) &&
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return {
        ...(fallback as Record<string, unknown>),
        ...parsed,
      } as T;
    }

    return parsed as T;
  } catch {
    return fallback;
  }
}

function mergeBackupSettings(input: BackupSettings): BackupSettings {
  return {
    ...DEFAULT_BACKUP_SETTINGS,
    ...input,
    retention: {
      ...DEFAULT_BACKUP_SETTINGS.retention,
      ...(input.retention || {}),
    },
    schedule: {
      ...DEFAULT_BACKUP_SETTINGS.schedule,
      ...(input.schedule || {}),
    },
  };
}

function getKyivNowParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value])
  );
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdayMap[parts.weekday] || 1,
    minutesOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function parseTimeToMinutes(time: string): number {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return 3 * 60;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return 3 * 60;
  }

  return hour * 60 + minute;
}

function shouldRunScheduledBackup(settings: BackupSettings, lastSlot: string | null) {
  const schedule = settings.schedule || DEFAULT_BACKUP_SETTINGS.schedule;
  if (!schedule.enabled) {
    return { due: false, reason: 'disabled', slot: null };
  }

  const now = getKyivNowParts();
  const targetMinutes = parseTimeToMinutes(schedule.time);
  const isInRunWindow =
    now.minutesOfDay >= targetMinutes &&
    now.minutesOfDay < targetMinutes + 60;

  if (!isInRunWindow) {
    return { due: false, reason: 'outside_window', slot: null };
  }

  if (schedule.frequency === 'weekly' && !schedule.weekdays.includes(now.weekday)) {
    return { due: false, reason: 'weekday_not_selected', slot: null };
  }

  const slot = `${now.date}:${schedule.time}`;
  if (lastSlot === slot) {
    return { due: false, reason: 'already_ran', slot };
  }

  return { due: true, reason: 'due', slot };
}

async function runScheduledBackup(settings: BackupSettings) {
  const token = createBackupServiceToken({
    userId: null,
    userName: 'Автоматичний backup',
    role: 'system',
  });

  const response = await fetch(`${getBackupServiceUrl()}/backup/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      categories: settings.categories,
      includeExcel: settings.format === 'excel',
      retention: settings.retention,
    }),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || 'Backup service did not respond');
  }

  return data?.backup;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const settings = mergeBackupSettings(
      await readSystemSetting<BackupSettings>('backup_settings', DEFAULT_BACKUP_SETTINGS)
    );
    const lastSlot = await readSystemSetting<string | null>('last_auto_backup_slot', null);
    const decision = shouldRunScheduledBackup(settings, lastSlot);

    if (!decision.due || !decision.slot) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: decision.reason,
      });
    }

    await saveSystemSetting('last_auto_backup_slot', decision.slot);
    const backup = await runScheduledBackup(settings);
    const statusPayload = {
      timestamp: backup?.timestamp ?? new Date().toISOString(),
      user: 'Автоматичний backup',
      includeExcel: settings.format === 'excel',
      retention: settings.retention,
      retentionResult: backup?.retention ?? null,
      schedule: settings.schedule,
      results: Array.isArray(backup?.results) ? backup.results : [],
    };

    await saveSystemSetting('last_backup_status', statusPayload);
    await saveSystemSetting('last_auto_backup_status', statusPayload);

    return NextResponse.json({
      ok: true,
      skipped: false,
      slot: decision.slot,
      backup: statusPayload,
    });
  } catch (error) {
    console.error('[Backup cron] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backup cron failed' },
      { status: 500 }
    );
  }
}
