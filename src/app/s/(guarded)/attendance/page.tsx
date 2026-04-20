/**
 * /attendance — історія відвідуваності учня.
 * Відображає минулі заняття та статуси (був, пропуск, поважна причина, запізнення).
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

export default async function StudentAttendancePage() {
  const sessionId = cookies().get(STUDENT_COOKIE_NAME)?.value;
  const session = sessionId ? await getStudentSession(sessionId) : null;
  if (!session) {
    return <div className="student-empty">Сесія закінчилась</div>;
  }

  // Отримуємо до 100 минулих занять:
  // 1) Ті, де учень має конкретну відмітку (a.status IS NOT NULL) - це може бути відпрацювання в іншій групі.
  // 2) Або заняття активних груп учня, які вже проведені (l.status = 'done').
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

  // Підрахунок статистики
  const total = lessons.length;
  let present = 0;
  let absent = 0;
  let excused = 0;
  let late = 0;

  lessons.forEach((l) => {
    if (l.attendance_status === 'present') present++;
    else if (l.attendance_status === 'absent') absent++;
    else if (l.attendance_status === 'excused') excused++;
    else if (l.attendance_status === 'late') late++;
  });

  const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  // Групуємо по місяцях (укр. мовою)
  const monthFmt = new Intl.DateTimeFormat('uk-UA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  });

  const groups = new Map<string, { label: string; items: LessonDTO[] }>();
  for (const lesson of lessons) {
    const d = new Date(lesson.start_datetime);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit' }).format(d);
    if (!groups.has(key)) {
      const label = monthFmt.format(d);
      // Робимо першу літеру великою: "квітень 2026" -> "Квітень 2026"
      groups.set(key, { label: label.charAt(0).toUpperCase() + label.slice(1), items: [] });
    }
    groups.get(key)!.items.push(lesson);
  }

  return (
    <>
      <h1 className="student-page-title">Історія відвідуваності</h1>
      <p className="student-page-subtitle">Ваші минулі заняття та пропуски</p>

      {/* Статистика */}
      {total > 0 && (
        <div className="student-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Загальна присутність</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: attendanceRate >= 80 ? '#16a34a' : attendanceRate >= 50 ? '#ca8a04' : '#dc2626' }}>
              {attendanceRate}%
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Був(ла)</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#16a34a' }}>{present + late}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Пропуски</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#dc2626' }}>{absent}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Поважна</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#2563eb' }}>{excused}</div>
            </div>
          </div>
        </div>
      )}

      {lessons.length === 0 ? (
        <div className="student-empty">
          У вас ще немає проведених занять.
        </div>
      ) : (
        Array.from(groups.entries()).map(([key, group]) => (
          <section key={key} style={{ marginBottom: 24 }}>
            <div className="student-section-header">{group.label}</div>
            <div className="student-dashboard-grid">
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
