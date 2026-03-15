import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest, notFound } from '@/lib/api-utils';
import { run, get, all } from '@/db';
import { addGroupHistoryEntry } from '@/lib/group-history';
import { safeAddStudentHistoryEntry } from '@/lib/student-history';

export const dynamic = 'force-dynamic';

// POST /api/groups/[id]/archive - Archive a group (status -> inactive)
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
  const { archive_date } = body;

  if (!archive_date) return badRequest('Дата архівації обовязкова');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(archive_date)) return badRequest('Невірний формат дати');

  const group = await get<{ id: number; title: string; status: string }>(
    'SELECT id, title, status FROM groups WHERE id = $1',
    [groupId]
  );
  if (!group) return notFound('Групу не знайдено');
  if (group.status === 'inactive') return badRequest('Група вже в архіві');

  // 1. Get active students before deactivating (for history logging)
  const activeStudents = await all<{ student_id: number }>(
    `SELECT student_id FROM student_groups WHERE group_id = $1 AND is_active = TRUE`,
    [groupId]
  );

  // 2. Set group status to inactive and deactivate
  await run(
    `UPDATE groups SET status = 'inactive', is_active = FALSE, updated_at = NOW() WHERE id = $1`,
    [groupId]
  );

  // 3. Deactivate all students in the group
  await run(
    `UPDATE student_groups SET is_active = FALSE, leave_date = $1, updated_at = NOW()
     WHERE group_id = $2 AND is_active = TRUE`,
    [archive_date, groupId]
  );

  // 4. Count and delete all future lessons (after archive date)
  const futureLessons = await all<{ id: number }>(
    `SELECT id FROM lessons WHERE group_id = $1 AND lesson_date > $2`,
    [groupId, archive_date]
  );
  if (futureLessons.length > 0) {
    await run(
      `DELETE FROM lessons WHERE group_id = $1 AND lesson_date > $2`,
      [groupId, archive_date]
    );
  }

  // 5. Group history entry
  await addGroupHistoryEntry(
    groupId,
    'status_changed',
    'Група архівована ' + archive_date + '. Видалено майбутніх занять: ' + futureLessons.length,
    user.id,
    user.name,
    group.status,
    'inactive'
  );

  // 6. Student history entries (non-fatal)
  for (const { student_id } of activeStudents) {
    await safeAddStudentHistoryEntry(
      student_id,
      'group_left',
      'Вийшов з групи «' + group.title + '» (архівація групи)',
      user.id,
      user.name,
      group.title,
      null
    );
  }

  return NextResponse.json({
    message: 'Групу успішно архівовано',
    archive_date,
  });
}
