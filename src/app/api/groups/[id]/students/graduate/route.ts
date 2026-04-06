import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest, notFound } from '@/lib/api-utils';
import { graduateStudentFromGroup } from '@/lib/groups';
import { run, get, all } from '@/db';
import { addGroupHistoryEntry, formatStudentGraduatedDescription } from '@/lib/group-history';
import { safeAddStudentHistoryEntry, formatGroupGraduatedDescription } from '@/lib/student-history';

export const dynamic = 'force-dynamic';

// POST /api/groups/[id]/students/graduate - Graduate a student from group
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
  const { student_group_id, graduation_date } = body;

  if (!student_group_id) return badRequest("ID запису учня в групі обов'язковий");
  if (!graduation_date) return badRequest("Дата випуску обов'язкова");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(graduation_date)) return badRequest('Невірний формат дати');

  const studentGroupId = parseInt(student_group_id);
  if (isNaN(studentGroupId)) return badRequest('Невірний ID запису');

  // Verify this student_group record exists and is active
  const sgRecord = await get<{ id: number; student_id: number; group_id: number; is_active: boolean }>(
    `SELECT id, student_id, group_id, is_active FROM student_groups WHERE id = $1`,
    [studentGroupId]
  );
  if (!sgRecord) return notFound('Запис учня в групі не знайдено');
  if (!sgRecord.is_active) return badRequest('Учень вже не є активним у цій групі');
  if (sgRecord.group_id !== groupId) return badRequest('Запис не належить до цієї групи');

  const studentId = sgRecord.student_id;

  // Get student and group names for history
  const student = await get<{ full_name: string }>(`SELECT full_name FROM students WHERE id = $1`, [studentId]);
  const group = await get<{ title: string }>(`SELECT title FROM groups WHERE id = $1`, [groupId]);

  if (!student) return notFound('Учня не знайдено');
  if (!group) return notFound('Групу не знайдено');

  try {
    // 1. Graduate the student (set status='graduated', is_active=FALSE, leave_date)
    await graduateStudentFromGroup(studentGroupId, graduation_date);

    // 2. Remove attendance records for future scheduled lessons (after graduation date)
    const futureLessons = await all<{ id: number }>(
      `SELECT id FROM lessons WHERE group_id = $1 AND lesson_date > $2 AND status = 'scheduled'`,
      [groupId, graduation_date]
    );

    if (futureLessons.length > 0) {
      const lessonIds = futureLessons.map(l => l.id);
      // Delete attendance records for this student in future lessons
      for (const lessonId of lessonIds) {
        await run(
          `DELETE FROM attendance WHERE lesson_id = $1 AND student_id = $2`,
          [lessonId, studentId]
        );
      }
    }

    // 3. Log in group history
    await addGroupHistoryEntry(
      groupId,
      'student_graduated',
      formatStudentGraduatedDescription(student.full_name, graduation_date),
      user.id,
      user.name
    );

    // 4. Log in student history
    await safeAddStudentHistoryEntry(
      studentId,
      'group_graduated',
      formatGroupGraduatedDescription(group.title),
      user.id,
      user.name
    );

    return NextResponse.json({
      message: `Учня ${student.full_name} успішно випущено з групи`,
      graduation_date,
      future_lessons_cleaned: futureLessons.length,
    });
  } catch (error) {
    console.error('Graduate student error:', error);
    return NextResponse.json(
      { error: 'Не вдалося випустити учня з групи' },
      { status: 500 }
    );
  }
}
