import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getGroupWithDetailsById, rescheduleGroup, DAY_SHORT_NAMES_UA, validateTime } from '@/lib/groups';
import { addGroupHistoryEntry, formatScheduleChangedDescription } from '@/lib/group-history';
import { sendMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const groupId = parseInt(params.id, 10);
  if (isNaN(groupId)) {
    return NextResponse.json({ error: 'Невірний ID групи' }, { status: 400 });
  }

  const group = await getGroupWithDetailsById(groupId);
  if (!group) return notFound('Групу не знайдено');

  if (group.status !== 'active') {
    return NextResponse.json({ error: 'Змінити розклад можна лише для активної групи' }, { status: 400 });
  }

  let body: { newWeeklyDay?: unknown; newStartTime?: unknown; newDurationMinutes?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Невірний формат запиту' }, { status: 400 });
  }

  const newWeeklyDay = Number(body.newWeeklyDay);
  if (!Number.isInteger(newWeeklyDay) || newWeeklyDay < 1 || newWeeklyDay > 7) {
    return NextResponse.json({ error: 'Оберіть день тижня' }, { status: 400 });
  }

  const newStartTime = typeof body.newStartTime === 'string' ? body.newStartTime.trim() : '';
  if (!validateTime(newStartTime)) {
    return NextResponse.json({ error: 'Невірний формат часу (HH:MM)' }, { status: 400 });
  }

  const newDurationMinutes = Number(body.newDurationMinutes);
  if (!Number.isInteger(newDurationMinutes) || newDurationMinutes < 15 || newDurationMinutes > 480) {
    return NextResponse.json({ error: 'Тривалість має бути від 15 до 480 хвилин' }, { status: 400 });
  }

  // Ensure at least one field actually changed
  if (
    newWeeklyDay === group.weekly_day &&
    newStartTime === group.start_time &&
    newDurationMinutes === group.duration_minutes
  ) {
    return NextResponse.json({ error: 'Нові параметри збігаються з поточними' }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : null;

  try {
    await rescheduleGroup(groupId, newWeeklyDay, newStartTime, newDurationMinutes, group.course_title, user.id, reason);
  } catch (e) {
    console.error('rescheduleGroup failed:', e);
    return NextResponse.json({ error: 'Не вдалося перенести групу. Спробуйте ще раз.' }, { status: 500 });
  }

  // History entry
  try {
    const oldDayName = DAY_SHORT_NAMES_UA[group.weekly_day] ?? String(group.weekly_day);
    const newDayName = DAY_SHORT_NAMES_UA[newWeeklyDay] ?? String(newWeeklyDay);
    await addGroupHistoryEntry(
      groupId,
      'schedule_changed',
      formatScheduleChangedDescription(oldDayName, group.start_time, newDayName, newStartTime, group.duration_minutes, newDurationMinutes),
      user.id,
      user.name,
      `${oldDayName} ${group.start_time}`,
      `${newDayName} ${newStartTime}`,
    );
  } catch (e) {
    console.error('Failed to add group history:', e);
  }

  // Telegram notification to teacher (non-fatal)
  try {
    const teacherRow = await (await import('@/db')).get<{ telegram_id: string | null }>(
      `SELECT telegram_id FROM users WHERE id = $1`,
      [group.teacher_id]
    );
    if (teacherRow?.telegram_id) {
      const oldDayName = DAY_SHORT_NAMES_UA[group.weekly_day];
      const newDayName = DAY_SHORT_NAMES_UA[newWeeklyDay];
      const reasonLine = reason ? `\n📝 Причина: ${reason}` : '';
      const text =
        `📅 <b>Зміна розкладу групи</b>\n\n` +
        `Група <b>${group.title}</b> перенесена на новий час.${reasonLine}\n\n` +
        `Було: ${oldDayName} о ${group.start_time}\n` +
        `Стало: <b>${newDayName} о ${newStartTime}</b>`;
      sendMessage(teacherRow.telegram_id, text).catch(() => {});
    }
  } catch { /* non-fatal */ }

  const updatedGroup = await getGroupWithDetailsById(groupId);
  return NextResponse.json({
    message: 'Розклад групи оновлено',
    group: updatedGroup,
  });
}
