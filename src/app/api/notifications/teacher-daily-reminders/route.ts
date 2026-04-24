import { NextRequest, NextResponse } from 'next/server';
import { sendDailyReminders, getTeacherNotificationSettings } from '@/lib/teacher-notifications';
import { nowKyiv } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

// GET /api/notifications/teacher-daily-reminders
// Called by GitHub Actions at 05:00, 06:00, 07:00 UTC
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
    const sysSettings = await getTeacherNotificationSettings();
    if (sysSettings.teacher_daily_reminders_enabled === '0') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Disabled in settings' });
    }

    // Check if current Kyiv time matches configured time (±15 min window)
    const configuredTime = sysSettings.teacher_daily_reminders_time || '09:00';
    const [configHour, configMin] = configuredTime.split(':').map(Number);
    const now = nowKyiv();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const configMinutes = configHour * 60 + configMin;
    const diff = Math.abs(currentMinutes - configMinutes);

    // Allow 15 minute window; also handle day boundary (not needed for daily)
    if (diff > 15) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'Outside time window',
        configuredTime,
        currentKyivTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      });
    }

    const result = await sendDailyReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[Teacher daily reminders] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
