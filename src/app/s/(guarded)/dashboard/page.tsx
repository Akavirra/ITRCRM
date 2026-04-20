/**
 * Dashboard — головна сторінка учня.
 *
 * Показує:
 *   - Привітання
 *   - Наступне заняття (карточка з датою/часом/темою)
 *   - Уроки на цей тиждень (до 5 шт.)
 *
 * Серверний компонент — читає дані напряму з crm_student ролі.
 */

import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  STUDENT_COOKIE_NAME,
  getStudentSession,
} from '@/lib/student-auth';
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

async function fetchUpcoming(studentId: number): Promise<LessonDTO[]> {
  const from = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return studentAll<LessonDTO>(
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
     LIMIT 5`,
    [studentId, from, to]
  );
}

export default async function StudentDashboardPage() {
  // Layout уже перевірив сесію — sessionId тут є. Але треба student_id —
  // дістаємо ще раз швидким запитом (не додаємо зайвої передачі через контекст).
  const sessionId = cookies().get(STUDENT_COOKIE_NAME)?.value;
  const session = sessionId ? await getStudentSession(sessionId) : null;
  if (!session) {
    // Layout уже мав би редіректити, але на всяк випадок
    return <div className="student-empty">Сесія закінчилась</div>;
  }

  const lessons = await fetchUpcoming(session.student_id);

  const next = lessons.find((l) => new Date(l.start_datetime).getTime() >= Date.now());

  return (
    <>
      <h1 className="student-page-title">Привіт! 👋</h1>
      <p className="student-page-subtitle">Ось що заплановано на найближчий час</p>

      {next ? (
        <div className="student-card" style={{ background: 'linear-gradient(135deg, #2160d0 0%, #3b82f6 100%)', color: '#fff', border: 'none' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 6 }}>
            Наступне заняття
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {next.course_title || next.group_title || 'Заняття'}
          </div>
          <div style={{ fontSize: 14, opacity: 0.95, marginBottom: 2 }}>
            {formatWhen(next.start_datetime, next.end_datetime)}
          </div>
          {next.topic && (
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 8 }}>
              Тема: <strong>{next.topic}</strong>
            </div>
          )}
        </div>
      ) : (
        <div className="student-card">
          <h3>Найближчим часом занять немає</h3>
          <p>Перевірте повний розклад — там можуть бути заняття далі.</p>
        </div>
      )}

      <div className="student-section-header">На цей тиждень</div>

      <div className="student-dashboard-grid">
        {lessons.length === 0 ? (
          <div className="student-empty" style={{ gridColumn: '1 / -1' }}>
            Порожньо. Коли з'явиться наступне заняття — ми покажемо його тут.
          </div>
        ) : (
          lessons.map((l) => <LessonRow key={l.id} lesson={l} />)
        )}
      </div>

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <Link href="/schedule" className="student-secondary-btn">
          Повний розклад →
        </Link>
      </div>
    </>
  );
}

function formatWhen(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateFmt = new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: 'Europe/Kyiv',
  });
  const timeFmt = new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  });
  return `${dateFmt.format(start)}, ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}
