/**
 * Context-Aware helper для student portal.
 *
 * Обчислює на сервері:
 *   - active lesson (зараз триває або почнеться протягом 15 хв / щойно закінчилось < 1 год тому)
 *   - список груп учня (кожна з "next lesson" для швидкого огляду)
 *   - індивідуальні заняття як окрема псевдо-група
 *
 * ВАЖЛИВО: експортуємо чистих функцій-утиліт (без HTTP/cookies) — це просто data layer.
 * Cookie/session читається у сторінці, потім student_id передається сюди.
 */

import 'server-only';
import { studentAll } from '@/db/neon-student';

export const ACTIVE_BEFORE_MS = 15 * 60 * 1000; // 15 хв до старту
export const ACTIVE_AFTER_MS = 60 * 60 * 1000; // 1 год після кінця (upload window)

export interface StudentLessonDTO {
  id: number;
  group_id: number | null;
  course_id: number | null;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  status: string | null;
  is_makeup: boolean | null;
  is_trial: boolean | null;
  group_title: string | null;
  course_title: string | null;
  attendance_status: string | null;
}

export interface StudentGroupSummary {
  id: number | 'individual';
  title: string;
  course_title: string | null;
  weekly_day: number | null;
  start_time: string | null;
  duration_minutes: number | null;
  next_lesson: StudentLessonDTO | null;
  isIndividual: boolean;
}

export interface StudentLessonContext {
  /** Активне заняття (зараз триває або почнеться < 15 хв, або щойно закінчилось < 1 год) */
  activeLesson: StudentLessonDTO | null;
  /** Куди редіректити для активного заняття: group id або 'individual' */
  activeGroupKey: string | null;
  /** Усі активні групи учня + псевдо-група "individual" якщо є індивідуальні заняття */
  groups: StudentGroupSummary[];
  /** Найближче майбутнє заняття серед усіх груп (для fallback-карточки) */
  overallNext: StudentLessonDTO | null;
}

/**
 * Головна функція: одним проходом по БД отримує всі потрібні дані.
 */
export async function getStudentLessonContext(studentId: number): Promise<StudentLessonContext> {
  const now = Date.now();
  const windowFromIso = new Date(now - ACTIVE_AFTER_MS).toISOString();
  const windowToIso = new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString(); // +60 днів вперед

  // 1) Активні групи учня
  const groupRows = await studentAll<{
    group_id: number;
    title: string | null;
    course_title: string | null;
    weekly_day: number | null;
    start_time: string | null;
    duration_minutes: number | null;
  }>(
    `SELECT
       sg.group_id,
       g.title,
       c.title AS course_title,
       g.weekly_day,
       g.start_time,
       g.duration_minutes
     FROM student_groups sg
     JOIN groups g ON g.id = sg.group_id
     LEFT JOIN courses c ON c.id = g.course_id
     WHERE sg.student_id = $1 AND sg.is_active = TRUE
     ORDER BY g.title ASC`,
    [studentId]
  );

  // 2) Усі релевантні заняття для цього учня (у вікні [-1h; +60d])
  //    Беремо і групові (через sg), і індивідуальні (через attendance).
  const lessons = await studentAll<StudentLessonDTO>(
    `SELECT
       l.id, l.group_id, l.course_id,
       l.lesson_date, l.start_datetime, l.end_datetime,
       l.topic, l.status, l.is_makeup, l.is_trial,
       g.title AS group_title,
       c.title AS course_title,
       a.status AS attendance_status
     FROM lessons l
     LEFT JOIN groups g ON g.id = l.group_id
     LEFT JOIN courses c ON c.id = l.course_id
     LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = $1
     WHERE l.end_datetime >= $2
       AND l.end_datetime <= $3
       AND (
         EXISTS (
           SELECT 1 FROM student_groups sg
           WHERE sg.student_id = $1 AND sg.group_id = l.group_id AND sg.is_active = TRUE
         )
         OR a.student_id IS NOT NULL
       )
     ORDER BY l.start_datetime ASC`,
    [studentId, windowFromIso, windowToIso]
  );

  // 3) Знаходимо active lesson (start-15m ≤ now ≤ end+1h)
  const activeLesson = lessons.find((l) => isLessonActive(l, now)) ?? null;
  const activeGroupKey = activeLesson
    ? activeLesson.group_id
      ? String(activeLesson.group_id)
      : 'individual'
    : null;

  // 4) Обчислюємо next_lesson для кожної групи
  const groups: StudentGroupSummary[] = groupRows.map((g) => {
    const nextLesson =
      lessons.find(
        (l) => l.group_id === g.group_id && new Date(l.start_datetime).getTime() >= now,
      ) ?? null;

    return {
      id: g.group_id,
      title: g.title ?? 'Група',
      course_title: g.course_title,
      weekly_day: g.weekly_day,
      start_time: g.start_time,
      duration_minutes: g.duration_minutes,
      next_lesson: nextLesson,
      isIndividual: false,
    };
  });

  // 5) Псевдо-група "individual" — якщо є заняття не прив'язані до жодної активної групи
  const hasIndividual = lessons.some(
    (l) =>
      l.group_id === null ||
      !groupRows.some((g) => g.group_id === l.group_id),
  );
  if (hasIndividual) {
    const nextIndividual =
      lessons.find(
        (l) =>
          (l.group_id === null ||
            !groupRows.some((g) => g.group_id === l.group_id)) &&
          new Date(l.start_datetime).getTime() >= now,
      ) ?? null;

    groups.push({
      id: 'individual',
      title: 'Індивідуальні заняття',
      course_title: null,
      weekly_day: null,
      start_time: null,
      duration_minutes: null,
      next_lesson: nextIndividual,
      isIndividual: true,
    });
  }

  // 6) Overall next
  const overallNext = lessons.find((l) => new Date(l.start_datetime).getTime() >= now) ?? null;

  return { activeLesson, activeGroupKey, groups, overallNext };
}

/** Заняття "активне" якщо now у [start-15min; end+1h]. */
export function isLessonActive(
  lesson: Pick<StudentLessonDTO, 'start_datetime' | 'end_datetime'>,
  now: number = Date.now(),
): boolean {
  const start = new Date(lesson.start_datetime).getTime();
  const end = new Date(lesson.end_datetime).getTime();
  return now >= start - ACTIVE_BEFORE_MS && now <= end + ACTIVE_AFTER_MS;
}

/** Заняття зараз реально триває (для "pulse" badge). */
export function isLessonLive(
  lesson: Pick<StudentLessonDTO, 'start_datetime' | 'end_datetime'>,
  now: number = Date.now(),
): boolean {
  const start = new Date(lesson.start_datetime).getTime();
  const end = new Date(lesson.end_datetime).getTime();
  return now >= start && now <= end;
}

/**
 * Вікно завантаження робіт: відкривається в момент початку заняття,
 * закривається рівно через 1 годину після його завершення (ТЗ п.4).
 */
export const UPLOAD_WINDOW_AFTER_MS = 60 * 60 * 1000; // 1 година

export interface UploadWindow {
  opensAt: string;
  closesAt: string;
  isOpen: boolean;
  isBeforeOpen: boolean;
  isAfterClose: boolean;
}

export function getUploadWindow(
  lesson: Pick<StudentLessonDTO, 'start_datetime' | 'end_datetime'>,
  now: number = Date.now(),
): UploadWindow {
  const opensAtMs = new Date(lesson.start_datetime).getTime();
  const closesAtMs = new Date(lesson.end_datetime).getTime() + UPLOAD_WINDOW_AFTER_MS;
  return {
    opensAt: new Date(opensAtMs).toISOString(),
    closesAt: new Date(closesAtMs).toISOString(),
    isOpen: now >= opensAtMs && now <= closesAtMs,
    isBeforeOpen: now < opensAtMs,
    isAfterClose: now > closesAtMs,
  };
}

export function isUploadWindowOpen(
  lesson: Pick<StudentLessonDTO, 'start_datetime' | 'end_datetime'>,
  now: number = Date.now(),
): boolean {
  return getUploadWindow(lesson, now).isOpen;
}
