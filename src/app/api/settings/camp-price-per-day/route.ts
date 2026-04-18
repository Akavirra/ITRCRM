import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest } from '@/lib/api-utils';
import { get, run } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const setting = await get<{ value: string }>(
    `SELECT value FROM system_settings WHERE key = 'camp_price_per_day'`
  );

  return NextResponse.json({ camp_price_per_day: parseInt(setting?.value || '500', 10) });
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  try {
    const body = await request.json();
    const price = parseInt(body.camp_price_per_day, 10);

    if (isNaN(price) || price <= 0) {
      return badRequest('Невірна ціна');
    }

    await run(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('camp_price_per_day', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [price.toString()]
    );

    return NextResponse.json({ camp_price_per_day: price, message: 'Ціну оновлено' });
  } catch (error) {
    console.error('Update camp price error:', error);
    return NextResponse.json({ error: 'Помилка оновлення' }, { status: 500 });
  }
}
