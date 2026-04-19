import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import { all, run } from '@/db';
import { clearServerCache, getOrSetServerCache } from '@/lib/server-cache';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

const DEFAULTS: Record<string, string> = {
  teacher_salary_group: '75',
  teacher_salary_individual: '100',
  lesson_price: '300',
  individual_lesson_price: '300',
  assistant_widget_enabled: '1',
  camp_price_per_day: '500',
};

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const rows = await getOrSetServerCache(
      'system-settings:all',
      60 * 1000,
      () => all<{ key: string; value: string }>(`SELECT key, value FROM system_settings`)
    );
    const settings: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) settings[row.key] = row.value;
    if (!settings.individual_lesson_price) {
      settings.individual_lesson_price = settings.lesson_price;
    }
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ settings: DEFAULTS });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Невірний формат' }, { status: 400 });
  }

  const allowed = [
    'teacher_salary_group',
    'teacher_salary_individual',
    'lesson_price',
    'individual_lesson_price',
    'assistant_widget_enabled',
    'camp_price_per_day',
  ];

  const beforeRows = await all<{ key: string; value: string }>(
    `SELECT key, value FROM system_settings WHERE key = ANY($1::text[])`,
    [allowed]
  );
  const before = Object.fromEntries(beforeRows.map((row) => [row.key, row.value]));

  for (const key of allowed) {
    if (key in body) {
      if (key === 'assistant_widget_enabled') {
        const rawValue = String(body[key]);
        if (rawValue !== '0' && rawValue !== '1') {
          return NextResponse.json({ error: `Невірне значення для ${key}` }, { status: 400 });
        }
        await run(
          `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, rawValue]
        );
        continue;
      }

      const val = parseFloat(body[key]);
      if (isNaN(val) || val < 0) {
        return NextResponse.json({ error: `Невірне значення для ${key}` }, { status: 400 });
      }
      await run(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, String(val)]
      );
    }
  }

  clearServerCache('system-settings:');
  await safeAddAuditEvent({
    entityType: 'system',
    entityTitle: 'Системні налаштування',
    eventType: 'system_settings_updated',
    eventBadge: toAuditBadge('system_settings_updated'),
    description: 'Оновлено системні налаштування',
    userId: user.id,
    userName: user.name,
    metadata: {
      before,
      changed: Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key))),
    },
  });

  return NextResponse.json({ success: true });
}
