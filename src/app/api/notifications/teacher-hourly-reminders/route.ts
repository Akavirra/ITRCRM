import { NextRequest, NextResponse } from 'next/server';
import { sendHourlyReminders } from '@/lib/teacher-notifications';

export const dynamic = 'force-dynamic';

// GET /api/notifications/teacher-hourly-reminders
// Called by GitHub Actions every 10 minutes
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
    const result = await sendHourlyReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[Teacher hourly reminders] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
