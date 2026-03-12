import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest, notFound } from '@/lib/api-utils';
import { run, get, all } from '@/db';
import { addGroupHistoryEntry } from '@/lib/group-history';

export const dynamic = 'force-dynamic';

// POST /api/groups/[id]/graduate - Graduate a group
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const groupId = parseInt(params.id, 10);
  if (isNaN(groupId)) return badRequest('Невірний ID групи');

  const body = await request.json();
  const { graduation_date } = body;

  if (!graduation_date) return badRequest('Дата випуску обов\'язкова');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(graduation_date)) return badRequest('Невірний формат дати');

  const group = await get<{ id: number; title: string; status: string }>(
    'SELECT id, title, status FROM groups WHERE id = $1',
    [groupId]
  );
  if (!group) return notFound('Групу не знайдено');
  if (group.status === 'graduate') return badRequest('Група вже випущена');

  // 1. Set group status to graduate and deactivate
  await run(
    `UPDATE groups SET status = 'graduate', is_active = FALSE, updated_at = NOW() WHERE id = $1`,
    [groupId]
  );

  // 2. Deactivate all students in the group
  await run(
    `UPDATE student_groups SET is_active = FALSE, leave_date = $1, updated_at = NOW()
     WHERE group_id = $2 AND is_active = TRUE`,
    [graduation_date, groupId]
  );

  // 3. Count and delete all future lessons (after graduation date)
  const futureLessons = await all<{ id: number }>(
    `SELECT id FROM lessons WHERE group_id = $1 AND lesson_date > $2`,
    [groupId, graduation_date]
  );
  if (futureLessons.length > 0) {
    await run(
      `DELETE FROM lessons WHERE group_id = $1 AND lesson_date > $2`,
      [groupId, graduation_date]
    );
  }

  // 4. History entry
  await addGroupHistoryEntry(
    groupId,
    'status_changed',
    `Група випущена ${graduation_date}. Видалено майбутніх занять: ${futureLessons.length}`,
    user.id,
    user.name,
    group.status,
    'graduate'
  );

  return NextResponse.json({
    message: 'Групу успішно випущено',
    graduation_date,
  });
}
