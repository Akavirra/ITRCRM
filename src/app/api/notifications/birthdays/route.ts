import { NextRequest, NextResponse } from 'next/server';
import { createBirthdayNotificationsForToday } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// GET /api/notifications/birthdays
// Called by Vercel cron at 06:00 UTC (09:00 Kyiv)
// Authorization: Bearer <CRON_SECRET>
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const count = await createBirthdayNotificationsForToday();
    return NextResponse.json({ ok: true, created: count });
  } catch (error) {
    console.error('[Birthday cron] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
