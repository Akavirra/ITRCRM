/**
 * /schedule — повний розклад учня (30 днів вперед + 7 назад за замовчуванням).
 * Групує уроки по днях.
 */

import { cookies } from 'next/headers';
import { STUDENT_COOKIE_NAME, getStudentSession } from '@/lib/student-auth';
import { studentAll } from '@/db/neon-student';
import LessonRow from '@/components/student/LessonRow';

export const dynamic = 'force-dynamic';

interface LessonDTO {
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

export default async function StudentSchedulePage() {
  const sessionId = cookies().get(STUDENT_COOKIE_NAME)?.value;
  const session = sessionId ? await getStudentSession(sessionId) : null;
  if (!session) {
    return <div className="student-empty">Сесія закінчилась</div>;
  }

  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const lessons = await studentAll<LessonDTO>(
    `SELECT
       l.id, l.group_id, l.course_id,
       l.lesson_date, l.start_datetime, l.end_datetime,
       l.topic, l.status, l.is_makeup, l.is_trial,
       g.title AS group_title,
       c.title AS course_title,
       a.status AS attendance_status
     FROM lessons l
     JOIN student_groups sg ON sg.group_id = l.group_id AND sg.student_id = $1 AND sg.is_active = TRUE
     LEFT JOIN groups g ON g.id = l.group_id
     LEFT JOIN courses c ON c.id = l.course_id
     LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = $1
     WHERE l.start_datetime >= $2 AND l.start_datetime <= $3
     ORDER BY l.start_datetime ASC
     LIMIT 200`,
    [session.student_id, from, to]
  );

  // Групуємо по Kyiv-дню
  const groupFmt = new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: 'Europe/Kyiv',
  });

  const groups = new Map<string, { label: string; items: LessonDTO[] }>();
  for (const lesson of lessons) {
    const d = new Date(lesson.start_datetime);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    if (!groups.has(key)) {
      groups.set(key, { label: groupFmt.format(d), items: [] });
    }
    groups.get(key)!.items.push(lesson);
  }

  const now = Date.now();
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  return (
    <>
      <h1 className="student-page-title">Розклад</h1>
      <p className="student-page-subtitle">
        Найближчі 30 днів + тиждень назад
      </p>

      {lessons.length === 0 ? (
        <div className="student-empty">
          Немає занять у цьому періоді.
        </div>
      ) : (
        Array.from(groups.entries()).map(([key, group]) => (
          <section key={key} style={{ marginBottom: 16 }}>
            <div className="student-section-header" style={{
              color: key === todayKey ? '#2160d0' : '#6b7280',
            }}>
              {key === todayKey ? 'Сьогодні — ' : ''}{group.label}
            </div>
            {group.items.map((l) => <LessonRow key={l.id} lesson={l} />)}
          </section>
        ))
      )}
    </>
  );
}
