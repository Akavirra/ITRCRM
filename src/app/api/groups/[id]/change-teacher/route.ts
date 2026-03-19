import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getGroupWithDetailsById, changeGroupTeacher } from '@/lib/groups';
import { get } from '@/db';
import { addGroupHistoryEntry, formatTeacherChangedDescription } from '@/lib/group-history';
import { sendMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const MONTHS_UK = [
  'січня','лютого','березня','квітня','травня','червня',
  'липня','серпня','вересня','жовтня','листопада','грудня',
];

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

  let body: { newTeacherId?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Невірний формат запиту' }, { status: 400 });
  }

  const newTeacherIdInt = Number(body.newTeacherId);
  if (!Number.isInteger(newTeacherIdInt) || newTeacherIdInt <= 0) {
    return NextResponse.json({ error: 'Оберіть нового викладача' }, { status: 400 });
  }

  if (newTeacherIdInt === group.teacher_id) {
    return NextResponse.json({ error: 'Новий викладач збігається з поточним' }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : null;

  // Validate new teacher: must exist, be active, and have role='teacher'
  const newTeacher = await get<{ id: number; name: string; telegram_id: string | null; role: string }>(
    `SELECT id, name, telegram_id, role FROM users WHERE id = $1 AND is_active = TRUE`,
    [newTeacherIdInt]
  );
  if (!newTeacher) {
    return NextResponse.json({ error: 'Викладача не знайдено' }, { status: 404 });
  }
  if (newTeacher.role !== 'teacher') {
    return NextResponse.json({ error: 'Обраний користувач не є викладачем' }, { status: 400 });
  }

  // Get old teacher info (for notification + history)
  const oldTeacher = await get<{ name: string; telegram_id: string | null }>(
    `SELECT name, telegram_id FROM users WHERE id = $1`,
    [group.teacher_id]
  );

  // Get next scheduled lesson for the new teacher notification message
  const nextLesson = await get<{ lesson_date: string }>(
    `SELECT lesson_date FROM lessons
     WHERE group_id = $1 AND status = 'scheduled' AND lesson_date >= CURRENT_DATE
     ORDER BY lesson_date ASC LIMIT 1`,
    [groupId]
  );

  // ── Core change (3 atomic DB writes) ──────────────────────────────────────
  await changeGroupTeacher(groupId, newTeacherIdInt, user.id, reason || null);

  // ── History entry ──────────────────────────────────────────────────────────
  try {
    await addGroupHistoryEntry(
      groupId,
      'teacher_changed',
      formatTeacherChangedDescription(oldTeacher?.name ?? '(невідомо)', newTeacher.name),
      user.id,
      user.name,
      String(group.teacher_id),
      String(newTeacherIdInt)
    );
  } catch (e) {
    console.error('Failed to add group history:', e);
  }

  // ── Telegram notifications (non-fatal) ────────────────────────────────────
  const reasonLine = reason ? `\n📝 Причина: ${reason}` : '';

  if (oldTeacher?.telegram_id) {
    const text =
      `📋 <b>Зміна викладача у групі</b>\n\n` +
      `Вас переведено з групи <b>${group.title}</b>.${reasonLine}\n\n` +
      `Новий викладач: <b>${newTeacher.name}</b>`;
    sendMessage(oldTeacher.telegram_id, text).catch(() => {});
  }

  if (newTeacher.telegram_id) {
    let nextLine = '';
    if (nextLesson) {
      const d = new Date(nextLesson.lesson_date);
      nextLine = `\n📅 Найближче заняття: ${d.getUTCDate()} ${MONTHS_UK[d.getUTCMonth()]}`;
    }
    const text =
      `📋 <b>Призначення до групи</b>\n\n` +
      `Вас призначено викладачем групи <b>${group.title}</b>.${reasonLine}\n\n` +
      `📚 Курс: ${group.course_title}${nextLine}`;
    sendMessage(newTeacher.telegram_id, text).catch(() => {});
  }

  const updatedGroup = await getGroupWithDetailsById(groupId);

  return NextResponse.json({
    message: `Викладача змінено: ${oldTeacher?.name ?? '?'} → ${newTeacher.name}`,
    group: updatedGroup,
  });
}
