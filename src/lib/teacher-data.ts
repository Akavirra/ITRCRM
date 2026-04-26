/**
 * Teacher Portal — централізований Data Access Layer.
 *
 * ⚠️ ОБОВ'ЯЗКОВЕ ПРАВИЛО ⚠️
 *   Усі teacher API/page імпортують ТІЛЬКИ функції з цього модуля.
 *   Жодних прямих `teacherAll('SELECT...')` з API/page'ів teacher-портала.
 *
 * НАВІЩО:
 *   GRANT-и (scripts/setup-teacher-role-grants.js) обмежують лише КОЛОНКИ.
 *   Postgres не вміє через GRANT обмежити "тільки свої заняття" — це WHERE.
 *   Тому фільтр teacher_id робимо у коді, але централізовано в одному файлі —
 *   щоб неможливо було випадково написати `SELECT * FROM lessons` без фільтра.
 *
 *   Той самий патерн, що в /api/teacher-app/* (Telegram WebApp), але без
 *   копіпасту WHERE-блока в кожен файл.
 *
 * ДОСТУП ВИКЛАДАЧА:
 *   Заняття — "моє" якщо ОДНА з умов:
 *     1) `groups.teacher_id = $teacher`  (пряма прив'язка через групу)
 *     2) `lesson_teacher_replacements.replacement_teacher_id = $teacher`
 *        (викладач — заміна на цьому конкретному занятті)
 *     3) `lessons.group_id IS NULL AND lessons.teacher_id = $teacher`
 *        (індивідуальне заняття без групи)
 *
 *   Група — "моя" якщо `groups.teacher_id = $teacher` (поточна пряма прив'язка).
 *   group_teacher_assignments (історія) — НЕ враховуємо: якщо викладач більше
 *   не веде групу, вона зникає з його порталу. Заняття-заміни лишаються
 *   видимими через WHERE на занятті.
 *
 *   Учень — "мій" якщо є активний `student_groups (is_active=TRUE)` в моїй групі.
 */

import 'server-only';
import {
  teacherAll,
  teacherGet,
  teacherRun,
} from '@/db/neon-teacher';

// ===========================================================================
//  Спільний WHERE-блок для "моїх занять"
// ===========================================================================

/**
 * SQL-фрагмент для фільтра "моє заняття" — параметр $1 = teacher_id.
 * Очікує JOIN-и на groups g та lesson_teacher_replacements ltr.
 *
 * Фрагмент усюди той самий, тому виносимо в константу. Якщо коли-небудь
 * правила доступу зміняться — змінюємо в одному місці.
 */
const MY_LESSON_WHERE = `(
  g.teacher_id = $1
  OR ltr.replacement_teacher_id = $1
  OR (l.group_id IS NULL AND l.teacher_id = $1)
)`;

// ===========================================================================
//  Типи
// ===========================================================================

export interface TeacherLessonRow {
  id: number;
  public_id: string | null;
  group_id: number | null;
  course_id: number | null;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  status: string | null;
  notes: string | null;
  is_makeup: boolean;
  is_trial: boolean;
  group_title: string | null;
  course_title: string | null;
  /** id викладача-заміни (NULL якщо це його пряме заняття) */
  replacement_teacher_id: number | null;
  /** Чи викладач — НЕ власник групи, а тільки замінник на цьому уроці */
  is_replacement_for_me: boolean;
}

export interface TeacherGroupRow {
  id: number;
  public_id: string | null;
  course_id: number;
  course_title: string | null;
  title: string;
  weekly_day: number;
  start_time: string;
  duration_minutes: number;
  timezone: string | null;
  start_date: string | null;
  end_date: string | null;
  capacity: number | null;
  status: string;
  is_active: boolean;
  /** Активна кількість учнів */
  active_student_count: number;
}

export interface TeacherStudentRow {
  id: number;
  public_id: string | null;
  full_name: string;
  photo: string | null;
  birth_date: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  is_active: boolean;
  /** Тільки в межах getStudentsInMyGroup — якщо учень з нашої поточної групи */
  group_id?: number | null;
}

export interface TeacherAttendanceRow {
  id: number;
  lesson_id: number;
  student_id: number;
  student_full_name: string;
  status: string | null;
  comment: string | null;
  is_trial: boolean;
  makeup_lesson_id: number | null;
}

export interface TeacherShortcutRow {
  id: number;
  lesson_id: number;
  kind: 'url' | 'app';
  label: string;
  target: string;
  icon: string | null;
  sort_order: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherLessonPhotoRow {
  id: number;
  lesson_id: number;
  drive_file_id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by_name: string | null;
  uploaded_via: string;
  created_at: string;
}

export interface TeacherStudentWorkRow {
  id: number;
  student_id: number;
  student_full_name: string;
  course_id: number | null;
  lesson_id: number | null;
  title: string;
  description: string | null;
  storage_url: string;
  storage_kind: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: string;
  created_at: string;
}

// ===========================================================================
//  Класи помилок
// ===========================================================================

export class TeacherAccessError extends Error {
  constructor(
    public code: 'lesson_not_yours' | 'group_not_yours' | 'student_not_yours' | 'invalid_input',
    message: string,
  ) {
    super(message);
    this.name = 'TeacherAccessError';
  }
}

// ===========================================================================
//  ASSERTIONS — кидають TeacherAccessError, якщо ресурс не належить викладачу
// ===========================================================================

/** Кидає, якщо заняття не належить викладачу (ні пряме, ні заміна). */
export async function assertOwnsLesson(teacherId: number, lessonId: number): Promise<void> {
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    throw new TeacherAccessError('invalid_input', 'Невалідний teacherId');
  }
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    throw new TeacherAccessError('invalid_input', 'Невалідний lessonId');
  }
  const row = await teacherGet<{ ok: number }>(
    `SELECT 1 AS ok
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
     WHERE l.id = $2 AND ${MY_LESSON_WHERE}
     LIMIT 1`,
    [teacherId, lessonId],
  );
  if (!row) {
    throw new TeacherAccessError('lesson_not_yours', 'Це заняття не вашe');
  }
}

/** Кидає, якщо група не належить викладачу. */
export async function assertOwnsGroup(teacherId: number, groupId: number): Promise<void> {
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    throw new TeacherAccessError('invalid_input', 'Невалідний teacherId');
  }
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new TeacherAccessError('invalid_input', 'Невалідний groupId');
  }
  const row = await teacherGet<{ ok: number }>(
    `SELECT 1 AS ok FROM groups WHERE id = $1 AND teacher_id = $2 LIMIT 1`,
    [groupId, teacherId],
  );
  if (!row) {
    throw new TeacherAccessError('group_not_yours', 'Ця група не ваша');
  }
}

/** Кидає, якщо учень не у жодній з активних груп викладача. */
export async function assertOwnsStudent(teacherId: number, studentId: number): Promise<void> {
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    throw new TeacherAccessError('invalid_input', 'Невалідний teacherId');
  }
  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new TeacherAccessError('invalid_input', 'Невалідний studentId');
  }
  const row = await teacherGet<{ ok: number }>(
    `SELECT 1 AS ok
     FROM student_groups sg
     JOIN groups g ON g.id = sg.group_id
     WHERE sg.student_id = $1
       AND sg.is_active = TRUE
       AND g.teacher_id = $2
     LIMIT 1`,
    [studentId, teacherId],
  );
  if (!row) {
    throw new TeacherAccessError('student_not_yours', 'Учень не у вашій групі');
  }
}

// ===========================================================================
//  ЗАНЯТТЯ
// ===========================================================================

interface LessonsListOpts {
  /** YYYY-MM-DD inclusive */
  fromDate?: string;
  /** YYYY-MM-DD inclusive */
  toDate?: string;
  limit?: number;
}

/**
 * Список занять викладача (свої + заміни + індивідуальні), сортування —
 * за start_datetime ASC. Без обмеження за датою — повертає максимум `limit` (300 за замовч).
 */
export async function listMyLessons(
  teacherId: number,
  opts: LessonsListOpts = {},
): Promise<TeacherLessonRow[]> {
  const params: unknown[] = [teacherId];
  const filters: string[] = [MY_LESSON_WHERE];

  if (opts.fromDate) {
    params.push(opts.fromDate);
    filters.push(`l.lesson_date >= $${params.length}`);
  }
  if (opts.toDate) {
    params.push(opts.toDate);
    filters.push(`l.lesson_date <= $${params.length}`);
  }

  const limit = Math.min(Math.max(1, opts.limit ?? 300), 1000);

  const rows = await teacherAll<any>(
    `SELECT
       l.id, l.public_id, l.group_id, l.course_id,
       TO_CHAR(l.lesson_date, 'YYYY-MM-DD') AS lesson_date,
       l.start_datetime, l.end_datetime,
       l.topic, l.status, l.notes,
       COALESCE(l.is_makeup, FALSE) AS is_makeup,
       COALESCE(l.is_trial, FALSE) AS is_trial,
       g.title AS group_title,
       c.title AS course_title,
       ltr.replacement_teacher_id,
       (g.teacher_id IS NULL OR g.teacher_id <> $1) AND ltr.replacement_teacher_id = $1
         AS is_replacement_for_me
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
     WHERE ${filters.join(' AND ')}
     ORDER BY l.start_datetime ASC, l.id ASC
     LIMIT ${limit}`,
    params,
  );

  return rows.map((r: any) => ({
    id: Number(r.id),
    public_id: r.public_id ?? null,
    group_id: r.group_id ?? null,
    course_id: r.course_id ?? null,
    lesson_date: String(r.lesson_date),
    start_datetime: String(r.start_datetime),
    end_datetime: String(r.end_datetime),
    topic: r.topic ?? null,
    status: r.status ?? null,
    notes: r.notes ?? null,
    is_makeup: Boolean(r.is_makeup),
    is_trial: Boolean(r.is_trial),
    group_title: r.group_title ?? null,
    course_title: r.course_title ?? null,
    replacement_teacher_id: r.replacement_teacher_id ?? null,
    is_replacement_for_me: Boolean(r.is_replacement_for_me),
  }));
}

/** Повертає null, якщо заняття не належить викладачу. */
export async function getMyLesson(
  teacherId: number,
  lessonId: number,
): Promise<TeacherLessonRow | null> {
  if (!Number.isInteger(lessonId) || lessonId <= 0) return null;
  const rows = await teacherAll<any>(
    `SELECT
       l.id, l.public_id, l.group_id, l.course_id,
       TO_CHAR(l.lesson_date, 'YYYY-MM-DD') AS lesson_date,
       l.start_datetime, l.end_datetime,
       l.topic, l.status, l.notes,
       COALESCE(l.is_makeup, FALSE) AS is_makeup,
       COALESCE(l.is_trial, FALSE) AS is_trial,
       g.title AS group_title,
       c.title AS course_title,
       ltr.replacement_teacher_id,
       (g.teacher_id IS NULL OR g.teacher_id <> $1) AND ltr.replacement_teacher_id = $1
         AS is_replacement_for_me
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
     WHERE l.id = $2 AND ${MY_LESSON_WHERE}
     LIMIT 1`,
    [teacherId, lessonId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    public_id: r.public_id ?? null,
    group_id: r.group_id ?? null,
    course_id: r.course_id ?? null,
    lesson_date: String(r.lesson_date),
    start_datetime: String(r.start_datetime),
    end_datetime: String(r.end_datetime),
    topic: r.topic ?? null,
    status: r.status ?? null,
    notes: r.notes ?? null,
    is_makeup: Boolean(r.is_makeup),
    is_trial: Boolean(r.is_trial),
    group_title: r.group_title ?? null,
    course_title: r.course_title ?? null,
    replacement_teacher_id: r.replacement_teacher_id ?? null,
    is_replacement_for_me: Boolean(r.is_replacement_for_me),
  };
}

/** Оновити topic/notes свого заняття. Тільки безпечні поля. */
export async function updateMyLessonContent(
  teacherId: number,
  lessonId: number,
  patch: { topic?: string | null; notes?: string | null },
): Promise<void> {
  await assertOwnsLesson(teacherId, lessonId);

  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (patch.topic !== undefined) {
    params.push(patch.topic ?? null);
    setClauses.push(`topic = $${params.length}`);
    params.push(teacherId);
    setClauses.push(`topic_set_by = $${params.length}`);
    setClauses.push(`topic_set_at = NOW()`);
  }
  if (patch.notes !== undefined) {
    params.push(patch.notes ?? null);
    setClauses.push(`notes = $${params.length}`);
    params.push(teacherId);
    setClauses.push(`notes_set_by = $${params.length}`);
    setClauses.push(`notes_set_at = NOW()`);
  }
  if (setClauses.length === 1) return; // нічого змінювати

  params.push(lessonId);
  await teacherRun(
    `UPDATE lessons SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
    params,
  );
}

// ===========================================================================
//  ГРУПИ
// ===========================================================================

/** Усі поточні групи викладача. */
export async function listMyGroups(teacherId: number): Promise<TeacherGroupRow[]> {
  const rows = await teacherAll<any>(
    `SELECT
       g.id, g.public_id, g.course_id,
       c.title AS course_title,
       g.title, g.weekly_day, g.start_time, g.duration_minutes,
       g.timezone, g.start_date, g.end_date, g.capacity,
       g.status, g.is_active,
       (SELECT COUNT(*)::int
          FROM student_groups sg
          WHERE sg.group_id = g.id AND sg.is_active = TRUE) AS active_student_count
     FROM groups g
     LEFT JOIN courses c ON c.id = g.course_id
     WHERE g.teacher_id = $1
     ORDER BY g.is_active DESC, g.weekly_day, g.start_time`,
    [teacherId],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    public_id: r.public_id ?? null,
    course_id: Number(r.course_id),
    course_title: r.course_title ?? null,
    title: String(r.title),
    weekly_day: Number(r.weekly_day),
    start_time: String(r.start_time),
    duration_minutes: Number(r.duration_minutes),
    timezone: r.timezone ?? null,
    start_date: r.start_date ?? null,
    end_date: r.end_date ?? null,
    capacity: r.capacity ?? null,
    status: String(r.status),
    is_active: Boolean(r.is_active),
    active_student_count: Number(r.active_student_count ?? 0),
  }));
}

/** Повертає null, якщо група не належить викладачу. */
export async function getMyGroup(
  teacherId: number,
  groupId: number,
): Promise<TeacherGroupRow | null> {
  if (!Number.isInteger(groupId) || groupId <= 0) return null;
  const r = await teacherGet<any>(
    `SELECT
       g.id, g.public_id, g.course_id,
       c.title AS course_title,
       g.title, g.weekly_day, g.start_time, g.duration_minutes,
       g.timezone, g.start_date, g.end_date, g.capacity,
       g.status, g.is_active,
       (SELECT COUNT(*)::int
          FROM student_groups sg
          WHERE sg.group_id = g.id AND sg.is_active = TRUE) AS active_student_count
     FROM groups g
     LEFT JOIN courses c ON c.id = g.course_id
     WHERE g.id = $1 AND g.teacher_id = $2
     LIMIT 1`,
    [groupId, teacherId],
  );
  if (!r) return null;
  return {
    id: Number(r.id),
    public_id: r.public_id ?? null,
    course_id: Number(r.course_id),
    course_title: r.course_title ?? null,
    title: String(r.title),
    weekly_day: Number(r.weekly_day),
    start_time: String(r.start_time),
    duration_minutes: Number(r.duration_minutes),
    timezone: r.timezone ?? null,
    start_date: r.start_date ?? null,
    end_date: r.end_date ?? null,
    capacity: r.capacity ?? null,
    status: String(r.status),
    is_active: Boolean(r.is_active),
    active_student_count: Number(r.active_student_count ?? 0),
  };
}

/** Заняття конкретної моєї групи (асортимент дат опційно). */
export async function listLessonsInMyGroup(
  teacherId: number,
  groupId: number,
  opts: LessonsListOpts = {},
): Promise<TeacherLessonRow[]> {
  await assertOwnsGroup(teacherId, groupId);
  const params: unknown[] = [teacherId, groupId];
  const filters: string[] = [`l.group_id = $2`, MY_LESSON_WHERE];

  if (opts.fromDate) {
    params.push(opts.fromDate);
    filters.push(`l.lesson_date >= $${params.length}`);
  }
  if (opts.toDate) {
    params.push(opts.toDate);
    filters.push(`l.lesson_date <= $${params.length}`);
  }

  const limit = Math.min(Math.max(1, opts.limit ?? 300), 1000);

  const rows = await teacherAll<any>(
    `SELECT
       l.id, l.public_id, l.group_id, l.course_id,
       TO_CHAR(l.lesson_date, 'YYYY-MM-DD') AS lesson_date,
       l.start_datetime, l.end_datetime,
       l.topic, l.status, l.notes,
       COALESCE(l.is_makeup, FALSE) AS is_makeup,
       COALESCE(l.is_trial, FALSE) AS is_trial,
       g.title AS group_title,
       c.title AS course_title,
       ltr.replacement_teacher_id,
       FALSE AS is_replacement_for_me
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
     WHERE ${filters.join(' AND ')}
     ORDER BY l.lesson_date DESC, l.start_datetime DESC
     LIMIT ${limit}`,
    params,
  );

  return rows.map((r: any) => ({
    id: Number(r.id),
    public_id: r.public_id ?? null,
    group_id: r.group_id ?? null,
    course_id: r.course_id ?? null,
    lesson_date: String(r.lesson_date),
    start_datetime: String(r.start_datetime),
    end_datetime: String(r.end_datetime),
    topic: r.topic ?? null,
    status: r.status ?? null,
    notes: r.notes ?? null,
    is_makeup: Boolean(r.is_makeup),
    is_trial: Boolean(r.is_trial),
    group_title: r.group_title ?? null,
    course_title: r.course_title ?? null,
    replacement_teacher_id: r.replacement_teacher_id ?? null,
    is_replacement_for_me: false,
  }));
}

// ===========================================================================
//  УЧНІ
// ===========================================================================

/** Учні в активних групах викладача (унікальний список). */
export async function listMyStudents(teacherId: number): Promise<TeacherStudentRow[]> {
  const rows = await teacherAll<any>(
    `SELECT DISTINCT ON (s.id)
       s.id, s.public_id, s.full_name, s.photo, s.birth_date,
       s.parent_name, s.parent_phone, s.is_active
     FROM students s
     JOIN student_groups sg ON sg.student_id = s.id
     JOIN groups g ON g.id = sg.group_id
     WHERE g.teacher_id = $1 AND sg.is_active = TRUE
     ORDER BY s.id, s.full_name`,
    [teacherId],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    public_id: r.public_id ?? null,
    full_name: String(r.full_name),
    photo: r.photo ?? null,
    birth_date: r.birth_date ?? null,
    parent_name: r.parent_name ?? null,
    parent_phone: r.parent_phone ?? null,
    is_active: Boolean(r.is_active),
  }));
}

/** Учні конкретної моєї групи. */
export async function listStudentsInMyGroup(
  teacherId: number,
  groupId: number,
): Promise<TeacherStudentRow[]> {
  await assertOwnsGroup(teacherId, groupId);
  const rows = await teacherAll<any>(
    `SELECT
       s.id, s.public_id, s.full_name, s.photo, s.birth_date,
       s.parent_name, s.parent_phone, s.is_active,
       sg.group_id
     FROM students s
     JOIN student_groups sg ON sg.student_id = s.id
     WHERE sg.group_id = $1 AND sg.is_active = TRUE
     ORDER BY s.full_name`,
    [groupId],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    public_id: r.public_id ?? null,
    full_name: String(r.full_name),
    photo: r.photo ?? null,
    birth_date: r.birth_date ?? null,
    parent_name: r.parent_name ?? null,
    parent_phone: r.parent_phone ?? null,
    is_active: Boolean(r.is_active),
    group_id: r.group_id ?? null,
  }));
}

/** Повертає null, якщо учень не у жодній з груп викладача. */
export async function getMyStudent(
  teacherId: number,
  studentId: number,
): Promise<TeacherStudentRow | null> {
  if (!Number.isInteger(studentId) || studentId <= 0) return null;
  const r = await teacherGet<any>(
    `SELECT DISTINCT ON (s.id)
       s.id, s.public_id, s.full_name, s.photo, s.birth_date,
       s.parent_name, s.parent_phone, s.is_active
     FROM students s
     JOIN student_groups sg ON sg.student_id = s.id
     JOIN groups g ON g.id = sg.group_id
     WHERE s.id = $1 AND g.teacher_id = $2 AND sg.is_active = TRUE
     LIMIT 1`,
    [studentId, teacherId],
  );
  if (!r) return null;
  return {
    id: Number(r.id),
    public_id: r.public_id ?? null,
    full_name: String(r.full_name),
    photo: r.photo ?? null,
    birth_date: r.birth_date ?? null,
    parent_name: r.parent_name ?? null,
    parent_phone: r.parent_phone ?? null,
    is_active: Boolean(r.is_active),
  };
}

// ===========================================================================
//  ПРИСУТНІСТЬ
// ===========================================================================

/** Присутність на конкретному моєму уроці (з ім'ям учня). */
export async function listAttendanceForMyLesson(
  teacherId: number,
  lessonId: number,
): Promise<TeacherAttendanceRow[]> {
  await assertOwnsLesson(teacherId, lessonId);
  const rows = await teacherAll<any>(
    `SELECT
       a.id, a.lesson_id, a.student_id,
       s.full_name AS student_full_name,
       a.status, a.comment,
       COALESCE(a.is_trial, FALSE) AS is_trial,
       a.makeup_lesson_id
     FROM attendance a
     JOIN students s ON s.id = a.student_id
     WHERE a.lesson_id = $1
     ORDER BY s.full_name`,
    [lessonId],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    lesson_id: Number(r.lesson_id),
    student_id: Number(r.student_id),
    student_full_name: String(r.student_full_name),
    status: r.status ?? null,
    comment: r.comment ?? null,
    is_trial: Boolean(r.is_trial),
    makeup_lesson_id: r.makeup_lesson_id ?? null,
  }));
}

/**
 * Upsert (insert or update) присутності. Перевіряє:
 *   1) урок належить викладачу
 *   2) учень — у моїй групі (інакше викладач не може його позначати)
 */
export async function upsertAttendanceForMyLesson(
  teacherId: number,
  lessonId: number,
  studentId: number,
  status: 'present' | 'absent' | 'late' | 'excused',
  comment: string | null,
): Promise<void> {
  await assertOwnsLesson(teacherId, lessonId);
  await assertOwnsStudent(teacherId, studentId);

  // Чи запис уже є — оновлюємо, інакше вставляємо
  const existing = await teacherGet<{ id: number }>(
    `SELECT id FROM attendance WHERE lesson_id = $1 AND student_id = $2 LIMIT 1`,
    [lessonId, studentId],
  );

  if (existing) {
    await teacherRun(
      `UPDATE attendance
         SET status = $1, comment = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $4`,
      [status, comment ?? null, teacherId, existing.id],
    );
  } else {
    await teacherRun(
      `INSERT INTO attendance (lesson_id, student_id, status, comment, added_by, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5, NOW())`,
      [lessonId, studentId, status, comment ?? null, teacherId],
    );
  }
}

/** Видалення позначки присутності (виправлення помилки). */
export async function deleteAttendanceForMyLesson(
  teacherId: number,
  lessonId: number,
  attendanceId: number,
): Promise<void> {
  await assertOwnsLesson(teacherId, lessonId);
  if (!Number.isInteger(attendanceId) || attendanceId <= 0) {
    throw new TeacherAccessError('invalid_input', 'Невалідний attendanceId');
  }
  await teacherRun(
    `DELETE FROM attendance WHERE id = $1 AND lesson_id = $2`,
    [attendanceId, lessonId],
  );
}

// ===========================================================================
//  LESSON SHORTCUTS (Phase D.1) — викладач керує своїми
// ===========================================================================

export async function listMyLessonShortcuts(
  teacherId: number,
  lessonId: number,
): Promise<TeacherShortcutRow[]> {
  await assertOwnsLesson(teacherId, lessonId);
  const rows = await teacherAll<any>(
    `SELECT id, lesson_id, kind, label, target, icon, sort_order,
            created_by_name, created_at, updated_at
     FROM lesson_shortcuts
     WHERE lesson_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [lessonId],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    lesson_id: Number(r.lesson_id),
    kind: r.kind as 'url' | 'app',
    label: String(r.label),
    target: String(r.target),
    icon: r.icon ?? null,
    sort_order: Number(r.sort_order),
    created_by_name: r.created_by_name ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));
}

export interface ShortcutInput {
  kind: 'url' | 'app';
  label: string;
  target: string;
  icon?: string | null;
  sortOrder?: number;
}

export async function createMyLessonShortcut(
  teacherId: number,
  teacherName: string,
  lessonId: number,
  input: ShortcutInput,
): Promise<TeacherShortcutRow> {
  await assertOwnsLesson(teacherId, lessonId);

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const maxRow = await teacherGet<{ max_order: number | null }>(
      `SELECT MAX(sort_order)::int AS max_order FROM lesson_shortcuts WHERE lesson_id = $1`,
      [lessonId],
    );
    sortOrder = (maxRow?.max_order ?? -1) + 1;
  }

  const rows = await teacherRun(
    `INSERT INTO lesson_shortcuts
       (lesson_id, kind, label, target, icon, sort_order, created_by_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, lesson_id, kind, label, target, icon, sort_order,
               created_by_name, created_at, updated_at`,
    [lessonId, input.kind, input.label, input.target, input.icon ?? null, sortOrder, teacherName],
  );
  const r: any = rows[0];
  return {
    id: Number(r.id),
    lesson_id: Number(r.lesson_id),
    kind: r.kind as 'url' | 'app',
    label: String(r.label),
    target: String(r.target),
    icon: r.icon ?? null,
    sort_order: Number(r.sort_order),
    created_by_name: r.created_by_name ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function updateMyLessonShortcut(
  teacherId: number,
  lessonId: number,
  shortcutId: number,
  input: ShortcutInput,
): Promise<TeacherShortcutRow | null> {
  await assertOwnsLesson(teacherId, lessonId);

  const rows = await teacherRun(
    `UPDATE lesson_shortcuts
       SET kind = $1, label = $2, target = $3, icon = $4,
           sort_order = COALESCE($5, sort_order),
           updated_at = NOW()
     WHERE id = $6 AND lesson_id = $7
     RETURNING id, lesson_id, kind, label, target, icon, sort_order,
               created_by_name, created_at, updated_at`,
    [
      input.kind,
      input.label,
      input.target,
      input.icon ?? null,
      input.sortOrder ?? null,
      shortcutId,
      lessonId,
    ],
  );
  if (rows.length === 0) return null;
  const r: any = rows[0];
  return {
    id: Number(r.id),
    lesson_id: Number(r.lesson_id),
    kind: r.kind as 'url' | 'app',
    label: String(r.label),
    target: String(r.target),
    icon: r.icon ?? null,
    sort_order: Number(r.sort_order),
    created_by_name: r.created_by_name ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function deleteMyLessonShortcut(
  teacherId: number,
  lessonId: number,
  shortcutId: number,
): Promise<boolean> {
  await assertOwnsLesson(teacherId, lessonId);
  const rows = await teacherRun(
    `DELETE FROM lesson_shortcuts WHERE id = $1 AND lesson_id = $2 RETURNING id`,
    [shortcutId, lessonId],
  );
  return rows.length > 0;
}

// ===========================================================================
//  ФОТОГАЛЕРЕЯ ЗАНЯТТЯ — викладач читає
// ===========================================================================

export async function listMyLessonPhotos(
  teacherId: number,
  lessonId: number,
): Promise<TeacherLessonPhotoRow[]> {
  await assertOwnsLesson(teacherId, lessonId);
  const rows = await teacherAll<any>(
    `SELECT id, lesson_id, drive_file_id, file_name, mime_type, file_size,
            uploaded_by_name, uploaded_via, created_at
     FROM lesson_photo_files
     WHERE lesson_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 500`,
    [lessonId],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    lesson_id: Number(r.lesson_id),
    drive_file_id: String(r.drive_file_id),
    file_name: String(r.file_name),
    mime_type: r.mime_type ?? null,
    file_size: r.file_size !== null && r.file_size !== undefined ? Number(r.file_size) : null,
    uploaded_by_name: r.uploaded_by_name ?? null,
    uploaded_via: String(r.uploaded_via),
    created_at: String(r.created_at),
  }));
}

// ===========================================================================
//  РОБОТИ УЧНІВ — викладач переглядає
// ===========================================================================

interface WorksListOpts {
  /** Тільки роботи цієї групи */
  groupId?: number;
  /** Тільки роботи цього заняття */
  lessonId?: number;
  /** Тільки роботи цього учня (має бути моїм) */
  studentId?: number;
  limit?: number;
}

/** Роботи учнів моїх груп. */
export async function listMyStudentsWorks(
  teacherId: number,
  opts: WorksListOpts = {},
): Promise<TeacherStudentWorkRow[]> {
  if (opts.groupId) {
    await assertOwnsGroup(teacherId, opts.groupId);
  }
  if (opts.lessonId) {
    await assertOwnsLesson(teacherId, opts.lessonId);
  }
  if (opts.studentId) {
    await assertOwnsStudent(teacherId, opts.studentId);
  }

  const params: unknown[] = [teacherId];
  const filters: string[] = [
    `w.deleted_at IS NULL`,
    `EXISTS (
      SELECT 1
      FROM student_groups sg
      JOIN groups g ON g.id = sg.group_id
      WHERE sg.student_id = w.student_id
        AND sg.is_active = TRUE
        AND g.teacher_id = $1
    )`,
  ];

  if (opts.lessonId) {
    params.push(opts.lessonId);
    filters.push(`w.lesson_id = $${params.length}`);
  }
  if (opts.studentId) {
    params.push(opts.studentId);
    filters.push(`w.student_id = $${params.length}`);
  }
  if (opts.groupId) {
    params.push(opts.groupId);
    filters.push(`EXISTS (
      SELECT 1 FROM student_groups sg2
      WHERE sg2.student_id = w.student_id
        AND sg2.group_id = $${params.length}
        AND sg2.is_active = TRUE
    )`);
  }

  const limit = Math.min(Math.max(1, opts.limit ?? 200), 500);

  const rows = await teacherAll<any>(
    `SELECT
       w.id, w.student_id, s.full_name AS student_full_name,
       w.course_id, w.lesson_id,
       w.title, w.description, w.storage_url, w.storage_kind,
       w.mime_type, w.size_bytes, w.status, w.created_at
     FROM student_works w
     JOIN students s ON s.id = w.student_id
     WHERE ${filters.join(' AND ')}
     ORDER BY w.created_at DESC, w.id DESC
     LIMIT ${limit}`,
    params,
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    student_id: Number(r.student_id),
    student_full_name: String(r.student_full_name),
    course_id: r.course_id ?? null,
    lesson_id: r.lesson_id ?? null,
    title: String(r.title),
    description: r.description ?? null,
    storage_url: String(r.storage_url),
    storage_kind: String(r.storage_kind),
    mime_type: r.mime_type ?? null,
    size_bytes: r.size_bytes !== null && r.size_bytes !== undefined ? Number(r.size_bytes) : null,
    status: String(r.status),
    created_at: String(r.created_at),
  }));
}
