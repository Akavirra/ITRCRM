import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { get, run } from '@/db';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const setting = await get<{ value: string }>(
    `SELECT value FROM system_settings WHERE key = 'lesson_price'`
  );

  return NextResponse.json({ lesson_price: parseInt(setting?.value || '300', 10) });
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  try {
    const body = await request.json();
    const price = parseInt(body.lesson_price, 10);

    if (isNaN(price) || price <= 0) {
      return NextResponse.json({ error: 'Невірна ціна' }, { status: 400 });
    }

    const previous = await get<{ value: string }>(
      `SELECT value FROM system_settings WHERE key = 'lesson_price'`
    );

    await run(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('lesson_price', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [price.toString()]
    );

    await safeAddAuditEvent({
      entityType: 'system',
      entityTitle: 'Системні налаштування',
      eventType: 'lesson_price_updated',
      eventBadge: toAuditBadge('lesson_price_updated'),
      description: `Оновлено базову ціну заняття до ${price} грн`,
      userId: user.id,
      userName: user.name,
      metadata: {
        previousValue: previous?.value ?? null,
        nextValue: price,
      },
    });

    return NextResponse.json({ lesson_price: price, message: 'Ціну оновлено' });
  } catch (error) {
    console.error('Update lesson price error:', error);
    return NextResponse.json({ error: 'Помилка оновлення' }, { status: 500 });
  }
}
