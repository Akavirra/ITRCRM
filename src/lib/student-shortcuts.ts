/**
 * Phase D.1: read-only ярлики заняття для порталу учня.
 *
 * Окремий модуль (не імпортує `@/db` чи `@/lib/lesson-shortcuts`!), бо
 * портал учня використовує роль `crm_student` з обмеженими GRANT-ами.
 *
 * Доступ перевіряємо через існуючий `getLessonForStudent` (груповий або
 * індивідуальний урок).
 */

import 'server-only';
import { studentAll } from '@/db/neon-student';
import { getLessonForStudent } from '@/lib/student-works';
import type { ShortcutKind } from '@/lib/lesson-shortcuts';

export interface StudentShortcutItem {
  id: number;
  kind: ShortcutKind;
  label: string;
  target: string;
  icon: string | null;
  sortOrder: number;
  /** Хто додав (для tooltip-а в UI). Якщо null — не показуємо. */
  createdByName: string | null;
}

interface RawRow {
  id: number;
  kind: ShortcutKind;
  label: string;
  target: string;
  icon: string | null;
  sort_order: number;
  created_by_name: string | null;
  created_at: string;
}

function mapRow(r: RawRow): StudentShortcutItem {
  return {
    id: Number(r.id),
    kind: r.kind,
    label: r.label,
    target: r.target,
    icon: r.icon ?? null,
    sortOrder: Number(r.sort_order),
    createdByName: r.created_by_name ?? null,
  };
}

/**
 * Повертає ярлики заняття або null, якщо учень не має доступу.
 */
export async function listStudentShortcuts(
  studentId: number,
  lessonId: number,
): Promise<StudentShortcutItem[] | null> {
  const lesson = await getLessonForStudent(studentId, lessonId);
  if (!lesson) return null;

  const rows = await studentAll<RawRow>(
    `SELECT id, kind, label, target, icon, sort_order, created_by_name, created_at
     FROM lesson_shortcuts
     WHERE lesson_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [lessonId],
  );

  return rows.map(mapRow);
}

/**
 * Повертає мапу { lesson_id: count } для пакету занять — щоб на сторінці
 * групи показувати маленький значок "🔗 5" поруч з уроком.
 *
 * Аналогічно getStudentGalleryCounts — один SQL з EXISTS-перевіркою доступу,
 * без N+1.
 */
export async function getStudentShortcutsCounts(
  studentId: number,
  lessonIds: number[],
): Promise<Record<number, number>> {
  if (lessonIds.length === 0) return {};
  const safeIds = lessonIds.filter((id) => Number.isInteger(id) && id > 0);
  if (safeIds.length === 0) return {};

  const rows = await studentAll<{ lesson_id: number; cnt: number }>(
    `SELECT s.lesson_id, COUNT(*)::int AS cnt
     FROM lesson_shortcuts s
     JOIN lessons l ON l.id = s.lesson_id
     WHERE s.lesson_id = ANY($2::int[])
       AND (
         EXISTS (
           SELECT 1 FROM student_groups sg
           WHERE sg.student_id = $1 AND sg.group_id = l.group_id AND sg.is_active = TRUE
         )
         OR EXISTS (
           SELECT 1 FROM attendance a
           WHERE a.student_id = $1 AND a.lesson_id = s.lesson_id
         )
       )
     GROUP BY s.lesson_id`,
    [studentId, safeIds],
  );

  const out: Record<number, number> = {};
  for (const r of rows) {
    out[Number(r.lesson_id)] = Number(r.cnt);
  }
  return out;
}
