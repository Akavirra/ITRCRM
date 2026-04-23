import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import {
  getNotificationsForUser, getUnreadCountForUser, markNotificationsAsRead,
  clearNotificationsForUser, hasTodayBirthdays, checkStaleLessonsAndNotify,
} from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// GET /api/notifications?count=true  — unread count only (for polling)
// GET /api/notifications              — full list + unread count
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const countOnly = new URL(request.url).searchParams.get('count') === 'true';

  if (countOnly) {
    await checkStaleLessonsAndNotify();
    const [unreadCount, hasBirthday] = await Promise.all([
      getUnreadCountForUser(user.id),
      hasTodayBirthdays(),
    ]);
    return NextResponse.json({ unreadCount, hasBirthday });
  }

  await checkStaleLessonsAndNotify();
  const notifications = await getNotificationsForUser(user.id, 50);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  return NextResponse.json({ notifications, unreadCount });
}

// POST /api/notifications  — mark as read
// body: { all: true }  or  { ids: [1, 2, 3] }
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const { ids, all: markAll, clear } = body as { ids?: number[]; all?: boolean; clear?: boolean };

  if (clear) {
    await clearNotificationsForUser(user.id);
  } else if (markAll) {
    await markNotificationsAsRead(user.id);
  } else if (Array.isArray(ids) && ids.length > 0) {
    await markNotificationsAsRead(user.id, ids);
  }

  return NextResponse.json({ ok: true });
}
