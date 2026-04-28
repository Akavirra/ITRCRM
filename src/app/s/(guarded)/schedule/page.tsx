/**
 * /schedule — повний розклад учня (30 днів вперед + 7 назад за замовчуванням).
 * Групує уроки по днях. Сьогоднішній день виділяється sticky-заголовком.
 */

import { cookies } from 'next/headers';
import { CalendarOff } from 'lucide-react';
import { STUDENT_COOKIE_NAME, getStudentSession } from '@/lib/student-auth';
import { studentAll } from '@/db/neon-student';
import LessonRow from '@/components/student/LessonRow';
import { PageHeader } from '@/components/student/ui/PageHeader';
import { EmptyState } from '@/components/student/ui/EmptyState';

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
    return <EmptyState title="Сесія закінчилась" hint="Увійдіть знову." />;
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

  const groupFmt = new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: 'Europe/Kyiv',
  });

  const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const groups = new Map<string, { label: string; items: LessonDTO[] }>();
  for (const lesson of lessons) {
    const d = new Date(lesson.start_datetime);
    const key = dayKeyFmt.format(d);
    if (!groups.has(key)) {
      const label = groupFmt.format(d);
      groups.set(key, {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        items: [],
      });
    }
    groups.get(key)!.items.push(lesson);
  }

  const todayKey = dayKeyFmt.format(new Date());

  return (
    <>
      <PageHeader title="Розклад" subtitle="Найближчі 30 днів + тиждень назад" />

      {lessons.length === 0 ? (
        <EmptyState
          icon={<CalendarOff size={28} strokeWidth={1.75} />}
          title="Немає занять у цьому періоді"
          hint="Зміни у розкладі з'являться тут автоматично."
        />
      ) : (
        <div className="student-schedule">
          {Array.from(groups.entries()).map(([key, group]) => {
            const isToday = key === todayKey;
            const isPast = key < todayKey;
            const sectionClass =
              'student-schedule-day' +
              (isToday ? ' student-schedule-day--today' : '') +
              (isPast && !isToday ? ' student-schedule-day--past' : '');

            return (
              <section key={key} className={sectionClass}>
                <div className="student-schedule-day__heading">
                  {isToday && <span className="student-schedule-day__heading-pin">Сьогодні</span>}
                  <span>{group.label}</span>
                </div>
                <div className="student-schedule-day__list">
                  {group.items.map((l) => (
                    <LessonRow key={l.id} lesson={l} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
