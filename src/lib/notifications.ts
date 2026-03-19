import { run, get, all } from '@/db';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'birthday' | 'lesson_done';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  data: Record<string, unknown> | null;
  is_global: boolean;
  target_user_id: number | null;
  created_at: string;
  is_read: boolean;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createGlobalNotification(
  type: NotificationType,
  title: string,
  body: string,
  link?: string | null,
  data?: Record<string, unknown> | null,
  dedupKey?: string | null
): Promise<number> {
  const result = await get<{ id: number }>(
    `INSERT INTO notifications (type, title, body, link, data, is_global, dedup_key)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6)
     ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
     RETURNING id`,
    [type, title, body, link ?? null, data ? JSON.stringify(data) : null, dedupKey ?? null]
  );
  return result?.id ?? 0;
}

// ─── Per-user notification ────────────────────────────────────────────────────

export async function createUserNotification(
  userId: number,
  type: string,
  title: string,
  body: string,
  link?: string | null,
  dedupKey?: string | null
): Promise<void> {
  await get<{ id: number }>(
    `INSERT INTO notifications (type, title, body, link, data, is_global, target_user_id, dedup_key)
     VALUES ($1, $2, $3, $4, NULL, FALSE, $5, $6)
     ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
     RETURNING id`,
    [type, title, body, link ?? null, userId, dedupKey ?? null]
  );
}

// ─── Lesson done notification ─────────────────────────────────────────────────

export async function safeCreateLessonDoneNotification(
  lessonId: number,
  actorName: string
): Promise<void> {
  try {
    const lesson = await get<{
      lesson_date: unknown;
      start_datetime: string;
      end_datetime: string;
      topic: string | null;
      notes: string | null;
      group_id: number | null;
      is_makeup: boolean | null;
      group_title: string | null;
      course_title: string | null;
      teacher_name: string | null;
    }>(
      `SELECT
        l.lesson_date,
        l.start_datetime,
        l.end_datetime,
        l.topic,
        l.notes,
        l.group_id,
        l.is_makeup,
        g.title  AS group_title,
        c.title  AS course_title,
        COALESCE(u.name, gu.name) AS teacher_name
       FROM lessons l
       LEFT JOIN groups g  ON l.group_id = g.id
       LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
       LEFT JOIN users u   ON l.teacher_id = u.id
       LEFT JOIN users gu  ON g.teacher_id = gu.id
       WHERE l.id = $1`,
      [lessonId]
    );

    if (!lesson) return;

    // Date from DATE column — Neon may return a JS Date object or a string
    const dateObj = new Date(lesson.lesson_date as string | Date);
    const dy = String(dateObj.getUTCDate()).padStart(2, '0');
    const mo = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const yr = dateObj.getUTCFullYear();
    const formattedDate = `${dy}.${mo}.${yr}`;

    // Times from TIMESTAMPTZ — convert to Kyiv
    const startKyiv = toZonedTime(new Date(lesson.start_datetime), 'Europe/Kyiv');
    const endKyiv   = toZonedTime(new Date(lesson.end_datetime),   'Europe/Kyiv');
    const startTime = format(startKyiv, 'HH:mm');
    const endTime   = format(endKyiv,   'HH:mm');

    // Lesson type label
    let lessonType: string;
    if (lesson.is_makeup) {
      lessonType = 'Відпрацювання';
    } else if (lesson.group_id) {
      lessonType = 'Групове';
    } else {
      lessonType = 'Індивідуальне';
    }

    const groupName = lesson.group_title || lesson.course_title || '';
    const titleName = groupName ? `${groupName}` : lessonType;
    const title = `Заняття проведено: ${titleName}`;

    const lines: string[] = [
      `${lessonType} • ${formattedDate}, ${startTime}–${endTime}`,
    ];
    if (lesson.teacher_name) lines.push(`Викладач: ${lesson.teacher_name}`);
    if (lesson.topic)        lines.push(`Тема: ${lesson.topic}`);
    if (lesson.notes)        lines.push(`Примітка: ${lesson.notes}`);
    lines.push(`Відзначив: ${actorName}`);

    await createGlobalNotification(
      'lesson_done',
      title,
      lines.join('\n'),
      '/schedule',
      { lessonId, groupId: lesson.group_id },
      `lesson_done:${lessonId}`
    );
  } catch (err) {
    console.error('[notifications] Failed to create lesson_done notification:', err);
  }
}

// ─── Birthday notifications ───────────────────────────────────────────────────

export async function createBirthdayNotificationsForToday(): Promise<number> {
  const kyivNow = toZonedTime(new Date(), 'Europe/Kyiv');
  const month   = kyivNow.getMonth() + 1;
  const day     = kyivNow.getDate();

  const students = await all<{ id: number; full_name: string; birth_date: string }>(
    `SELECT id, full_name, birth_date
     FROM students
     WHERE is_active = TRUE
       AND birth_date IS NOT NULL
       AND EXTRACT(MONTH FROM birth_date) = $1
       AND EXTRACT(DAY   FROM birth_date) = $2`,
    [month, day]
  );

  if (students.length === 0) return 0;

  let created = 0;
  for (const student of students) {
    // Prevent duplicate within the last 20 hours
    const existing = await get<{ id: number }>(
      `SELECT id FROM notifications
       WHERE type = 'birthday'
         AND (data->>'studentId')::int = $1
         AND created_at >= NOW() - INTERVAL '20 hours'`,
      [student.id]
    );
    if (existing) continue;

    const birthYear = new Date(student.birth_date).getUTCFullYear();
    const age = kyivNow.getFullYear() - birthYear;

    await createGlobalNotification(
      'birthday',
      'День народження',
      `Сьогодні ${age} ${ageWord(age)} виповнюється учню ${student.full_name}`,
      `/students/${student.id}`,
      { studentId: student.id, studentName: student.full_name, age }
    );
    created++;
  }

  return created;
}

function ageWord(age: number): string {
  const mod10  = age % 10;
  const mod100 = age % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'років';
  if (mod10 === 1) return 'рік';
  if (mod10 >= 2 && mod10 <= 4) return 'роки';
  return 'років';
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getNotificationsForUser(
  userId: number,
  limit = 50
): Promise<AppNotification[]> {
  return await all<AppNotification>(
    `SELECT
       n.*,
       CASE WHEN nr.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_read
     FROM notifications n
     LEFT JOIN notification_reads nr
       ON nr.notification_id = n.id AND nr.user_id = $1
     LEFT JOIN notification_clears nc
       ON nc.user_id = $1
     WHERE (n.is_global = TRUE OR n.target_user_id = $1)
       AND (nc.cleared_at IS NULL OR n.created_at > nc.cleared_at)
     ORDER BY n.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
}

export async function getUnreadCountForUser(userId: number): Promise<number> {
  const result = await get<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM notifications n
     LEFT JOIN notification_reads nr
       ON nr.notification_id = n.id AND nr.user_id = $1
     LEFT JOIN notification_clears nc
       ON nc.user_id = $1
     WHERE (n.is_global = TRUE OR n.target_user_id = $1)
       AND (nc.cleared_at IS NULL OR n.created_at > nc.cleared_at)
       AND nr.user_id IS NULL`,
    [userId]
  );
  return parseInt(result?.count ?? '0', 10);
}

export async function markNotificationsAsRead(
  userId: number,
  ids?: number[]
): Promise<void> {
  if (ids && ids.length > 0) {
    for (const id of ids) {
      await run(
        `INSERT INTO notification_reads (notification_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, userId]
      );
    }
  } else {
    await run(
      `INSERT INTO notification_reads (notification_id, user_id)
       SELECT n.id, $1
       FROM notifications n
       LEFT JOIN notification_clears nc ON nc.user_id = $1
       WHERE (n.is_global = TRUE OR n.target_user_id = $1)
         AND (nc.cleared_at IS NULL OR n.created_at > nc.cleared_at)
         AND NOT EXISTS (
           SELECT 1 FROM notification_reads nr
           WHERE nr.notification_id = n.id AND nr.user_id = $1
         )
       ON CONFLICT DO NOTHING`,
      [userId]
    );
  }
}

export async function clearNotificationsForUser(userId: number): Promise<void> {
  await run(
    `INSERT INTO notification_clears (user_id, cleared_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET cleared_at = NOW()`,
    [userId]
  );
}
