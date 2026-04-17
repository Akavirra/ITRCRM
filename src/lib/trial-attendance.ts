import { all, get, run } from '@/db';
import {
  safeAddStudentHistoryEntry,
  formatTrialScheduledDescription,
  formatTrialRemovedDescription,
} from '@/lib/student-history';
import {
  addGroupHistoryEntry,
  formatTrialStudentAddedDescription,
  formatTrialStudentRemovedDescription,
} from '@/lib/group-history';
import type { AttendanceStatus } from '@/lib/attendance';

export interface TrialAdditionResult {
  added: number[];
  skipped: Array<{ student_id: number; reason: string }>;
}

export async function addTrialStudentsToLesson(
  lessonId: number,
  studentIds: number[],
  addedBy: number
): Promise<TrialAdditionResult> {
  const result: TrialAdditionResult = { added: [], skipped: [] };

  if (studentIds.length === 0) return result;

  const lesson = await get<{ id: number; group_id: number | null; status: string; lesson_date: string }>(
    `SELECT id, group_id, status, lesson_date::text as lesson_date FROM lessons WHERE id = $1`,
    [lessonId]
  );

  if (!lesson) {
    for (const id of studentIds) result.skipped.push({ student_id: id, reason: 'lesson_not_found' });
    return result;
  }

  if (lesson.status === 'canceled') {
    for (const id of studentIds) result.skipped.push({ student_id: id, reason: 'lesson_canceled' });
    return result;
  }

  const uniqueIds = Array.from(new Set(
    studentIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  ));

  if (uniqueIds.length === 0) return result;

  const existingStudents = await all<{ id: number; is_active: boolean }>(
    `SELECT id, is_active FROM students WHERE id = ANY($1::int[])`,
    [uniqueIds]
  );
  const activeStudentIds = new Set(existingStudents.filter((s) => s.is_active).map((s) => s.id));

  for (const id of uniqueIds) {
    if (!activeStudentIds.has(id)) {
      result.skipped.push({ student_id: id, reason: 'student_inactive_or_missing' });
    }
  }

  let rosterIds = new Set<number>();
  let groupTitle: string | null = null;
  if (lesson.group_id) {
    const roster = await all<{ student_id: number }>(
      `SELECT student_id FROM student_groups
       WHERE group_id = $1 AND is_active = TRUE`,
      [lesson.group_id]
    );
    rosterIds = new Set(roster.map((r) => r.student_id));

    const group = await get<{ title: string }>(
      `SELECT title FROM groups WHERE id = $1`,
      [lesson.group_id]
    );
    groupTitle = group?.title ?? null;
  }

  const existingAttendance = await all<{ student_id: number }>(
    `SELECT student_id FROM attendance WHERE lesson_id = $1`,
    [lessonId]
  );
  const existingAttendanceIds = new Set(existingAttendance.map((a) => a.student_id));

  for (const studentId of uniqueIds) {
    if (!activeStudentIds.has(studentId)) continue;

    if (rosterIds.has(studentId)) {
      result.skipped.push({ student_id: studentId, reason: 'already_in_group' });
      continue;
    }

    if (existingAttendanceIds.has(studentId)) {
      result.skipped.push({ student_id: studentId, reason: 'already_in_lesson' });
      continue;
    }

    await run(
      `INSERT INTO attendance (lesson_id, student_id, status, is_trial, added_by, updated_by)
       VALUES ($1, $2, NULL, TRUE, $3, $3)`,
      [lessonId, studentId, addedBy]
    );
    result.added.push(studentId);

    const student = await get<{ full_name: string }>(
      `SELECT full_name FROM students WHERE id = $1`,
      [studentId]
    );
    const actor = await get<{ name: string }>(
      `SELECT name FROM users WHERE id = $1`,
      [addedBy]
    );
    const actorName = actor?.name ?? 'Система';

    await safeAddStudentHistoryEntry(
      studentId,
      'trial_lesson_scheduled',
      formatTrialScheduledDescription(lesson.lesson_date, groupTitle, null),
      addedBy,
      actorName
    );

    if (lesson.group_id && student?.full_name) {
      await addGroupHistoryEntry(
        lesson.group_id,
        'trial_student_added',
        formatTrialStudentAddedDescription(student.full_name, lesson.lesson_date),
        addedBy,
        actorName
      );
    }
  }

  return result;
}

export async function removeTrialStudentFromLesson(
  lessonId: number,
  studentId: number
): Promise<{ removed: boolean; reason?: string }> {
  const row = await get<{ is_trial: boolean; status: AttendanceStatus | null; added_by: number | null }>(
    `SELECT is_trial, status, added_by FROM attendance
     WHERE lesson_id = $1 AND student_id = $2`,
    [lessonId, studentId]
  );

  if (!row) return { removed: false, reason: 'not_found' };
  if (!row.is_trial) return { removed: false, reason: 'not_trial' };

  const lesson = await get<{ lesson_date: string; group_id: number | null }>(
    `SELECT lesson_date::text as lesson_date, group_id FROM lessons WHERE id = $1`,
    [lessonId]
  );

  await run(
    `DELETE FROM attendance WHERE lesson_id = $1 AND student_id = $2 AND is_trial = TRUE`,
    [lessonId, studentId]
  );

  if (lesson) {
    try {
      const student = await get<{ full_name: string }>(
        `SELECT full_name FROM students WHERE id = $1`,
        [studentId]
      );

      let groupTitle: string | null = null;
      if (lesson.group_id) {
        const group = await get<{ title: string }>(
          `SELECT title FROM groups WHERE id = $1`,
          [lesson.group_id]
        );
        groupTitle = group?.title ?? null;
      }

      const actor = row.added_by
        ? await get<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [row.added_by])
        : null;
      const actorName = actor?.name ?? 'Система';
      const actorId = row.added_by ?? 0;

      await safeAddStudentHistoryEntry(
        studentId,
        'trial_lesson_removed',
        formatTrialRemovedDescription(lesson.lesson_date, groupTitle),
        actorId,
        actorName
      );

      if (lesson.group_id && student?.full_name) {
        await addGroupHistoryEntry(
          lesson.group_id,
          'trial_student_removed',
          formatTrialStudentRemovedDescription(student.full_name, lesson.lesson_date),
          actorId,
          actorName
        );
      }
    } catch (err) {
      console.error('[trial-attendance] Failed to log trial removal history:', err);
    }
  }

  return { removed: true };
}

export async function listTrialStudentsForLesson(
  lessonId: number
): Promise<Array<{
  student_id: number;
  full_name: string;
  public_id: string | null;
  status: AttendanceStatus | null;
  added_by: number | null;
  added_by_name: string | null;
}>> {
  return await all(
    `SELECT
       a.student_id,
       s.full_name,
       s.public_id,
       a.status,
       a.added_by,
       u.name as added_by_name
     FROM attendance a
     JOIN students s ON a.student_id = s.id
     LEFT JOIN users u ON a.added_by = u.id
     WHERE a.lesson_id = $1 AND COALESCE(a.is_trial, FALSE) = TRUE
     ORDER BY s.full_name`,
    [lessonId]
  );
}
