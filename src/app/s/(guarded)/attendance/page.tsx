/**
 * /attendance — історія відвідуваності учня.
 * Показує % присутності, рознос по статусах + список минулих занять, згрупованих по місяцях.
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

export default async function StudentAttendancePage() {
  const sessionId = cookies().get(STUDENT_COOKIE_NAME)?.value;
  const session = sessionId ? await getStudentSession(sessionId) : null;
  if (!session) {
    return <EmptyState title="Сесія закінчилась" hint="Увійдіть знову." />;
  }

  const lessons = await studentAll<LessonDTO>(
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
     WHERE l.end_datetime < NOW()
       AND (
         a.status IS NOT NULL
         OR (
           l.group_id IN (SELECT group_id FROM student_groups WHERE student_id = $1 AND is_active = TRUE)
           AND l.status = 'done'
         )
       )
     ORDER BY l.start_datetime DESC
     LIMIT 100`,
    [session.student_id]
  );

  const total = lessons.length;
  let present = 0;
  let absent = 0;
  let excused = 0;
  let late = 0;

  for (const l of lessons) {
    if (l.attendance_status === 'present') present++;
    else if (l.attendance_status === 'absent') absent++;
    else if (l.attendance_status === 'excused') excused++;
    else if (l.attendance_status === 'late') late++;
  }

  const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  const rateLevel: 'high' | 'mid' | 'low' =
    attendanceRate >= 80 ? 'high' : attendanceRate >= 50 ? 'mid' : 'low';

  const monthFmt = new Intl.DateTimeFormat('uk-UA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  });

  const groups = new Map<string, { label: string; items: LessonDTO[] }>();
  for (const lesson of lessons) {
    const d = new Date(lesson.start_datetime);
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
    }).format(d);
    if (!groups.has(key)) {
      const label = monthFmt.format(d);
      groups.set(key, {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        items: [],
      });
    }
    groups.get(key)!.items.push(lesson);
  }

  return (
    <>
      <PageHeader
        title="Історія відвідуваності"
        subtitle="Твоя присутність на минулих заняттях"
      />

      {total > 0 && (
        <section className="student-attendance-stats">
          <div className="student-attendance-stats__main">
            <div className="student-attendance-stats__label">Загальна присутність</div>
            <div className={`student-attendance-stats__value student-attendance-stats__value--${rateLevel}`}>
              {attendanceRate}%
            </div>
            <div className="student-attendance-stats__progress">
              <div
                className={`student-attendance-stats__progress-bar student-attendance-stats__progress-bar--${rateLevel}`}
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
          </div>

          <div className="student-attendance-stats__details">
            <div className="student-attendance-stats__detail">
              <span className="student-attendance-stats__detail-label">Був(ла)</span>
              <span className="student-attendance-stats__detail-value student-attendance-stats__detail-value--success">
                {present + late}
              </span>
            </div>
            <div className="student-attendance-stats__detail">
              <span className="student-attendance-stats__detail-label">Пропуски</span>
              <span className="student-attendance-stats__detail-value student-attendance-stats__detail-value--danger">
                {absent}
              </span>
            </div>
            <div className="student-attendance-stats__detail">
              <span className="student-attendance-stats__detail-label">Поважна</span>
              <span className="student-attendance-stats__detail-value student-attendance-stats__detail-value--info">
                {excused}
              </span>
            </div>
          </div>
        </section>
      )}

      {lessons.length === 0 ? (
        <EmptyState
          icon={<CalendarOff size={28} strokeWidth={1.75} />}
          title="Поки що немає проведених занять"
          hint="Як тільки відбудеться перше заняття — воно з'явиться тут зі статусом відвідування."
        />
      ) : (
        Array.from(groups.entries()).map(([key, group]) => (
          <section key={key} className="student-attendance-month">
            <div className="student-section-header">{group.label}</div>
            <div className="student-attendance-list">
              {group.items.map((l) => (
                <LessonRow key={l.id} lesson={l} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
