/**
 * /groups — список груп учня з короткою статистикою.
 * Звідси учень переходить у деталку конкретної групи.
 */

import Link from 'next/link';
import { cookies } from 'next/headers';
import { STUDENT_COOKIE_NAME, getStudentSession } from '@/lib/student-auth';
import { studentAll } from '@/db/neon-student';

export const dynamic = 'force-dynamic';

interface GroupRow {
  id: number;
  title: string | null;
  course_title: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  completed_lessons: number;
  upcoming_lessons: number;
  present_count: number;
  absent_count: number;
  excused_count: number;
  late_count: number;
  next_lesson_at: string | null;
}

interface IndividualRow {
  total: number;
  present_count: number;
  absent_count: number;
  excused_count: number;
  late_count: number;
  next_lesson_at: string | null;
}

export default async function StudentGroupsPage() {
  const sessionId = cookies().get(STUDENT_COOKIE_NAME)?.value;
  const session = sessionId ? await getStudentSession(sessionId) : null;
  if (!session) return <div className="student-empty">Сесія закінчилась</div>;

  const groups = await studentAll<GroupRow>(
    `SELECT
       g.id,
       g.title,
       c.title AS course_title,
       g.start_date,
       g.end_date,
       sg.status,
       COUNT(l.id) FILTER (WHERE l.end_datetime < NOW())::int AS completed_lessons,
       COUNT(l.id) FILTER (WHERE l.start_datetime >= NOW())::int AS upcoming_lessons,
       COUNT(a.lesson_id) FILTER (WHERE a.status = 'present')::int AS present_count,
       COUNT(a.lesson_id) FILTER (WHERE a.status = 'absent')::int AS absent_count,
       COUNT(a.lesson_id) FILTER (WHERE a.status = 'excused')::int AS excused_count,
       COUNT(a.lesson_id) FILTER (WHERE a.status = 'late')::int AS late_count,
       MIN(l.start_datetime) FILTER (WHERE l.start_datetime >= NOW()) AS next_lesson_at
     FROM student_groups sg
     JOIN groups g ON g.id = sg.group_id
     LEFT JOIN courses c ON c.id = g.course_id
     LEFT JOIN lessons l ON l.group_id = g.id
     LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = sg.student_id
     WHERE sg.student_id = $1
     GROUP BY g.id, g.title, c.title, g.start_date, g.end_date, sg.status
     ORDER BY COALESCE(g.start_date, CURRENT_DATE) DESC, g.id DESC`,
    [session.student_id]
  );

  const [individual] = await studentAll<IndividualRow>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE a.status = 'present')::int AS present_count,
       COUNT(*) FILTER (WHERE a.status = 'absent')::int AS absent_count,
       COUNT(*) FILTER (WHERE a.status = 'excused')::int AS excused_count,
       COUNT(*) FILTER (WHERE a.status = 'late')::int AS late_count,
       MIN(l.start_datetime) FILTER (WHERE l.start_datetime >= NOW()) AS next_lesson_at
     FROM attendance a
     JOIN lessons l ON l.id = a.lesson_id
     WHERE a.student_id = $1
       AND (
         l.group_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM student_groups sg
           WHERE sg.student_id = $1 AND sg.group_id = l.group_id
         )
       )`,
    [session.student_id]
  );

  return (
    <>
      <h1 className="student-page-title">Мої групи</h1>
      <p className="student-page-subtitle">Оберіть групу, щоб подивитись повну інформацію та історію відвідуваності</p>

      {groups.length === 0 && (individual?.total ?? 0) === 0 ? (
        <div className="student-empty">Немає груп або індивідуальних занять.</div>
      ) : (
        <div className="student-dashboard-grid">
          {groups.map((group) => {
            const knownAttendance = group.present_count + group.absent_count + group.excused_count + group.late_count;
            const attendanceRate = knownAttendance > 0
              ? Math.round(((group.present_count + group.late_count) / knownAttendance) * 100)
              : 0;

            return (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="student-card student-group-card"
              >
                <div className="student-group-card__title">
                  {group.course_title || group.title || 'Група'}
                </div>
                {group.title && group.course_title !== group.title && (
                  <div className="student-group-card__subtitle">{group.title}</div>
                )}
                <div className="student-group-card__meta">
                  {group.start_date ? formatDate(group.start_date) : 'Без дати старту'}
                  {group.end_date ? ` - ${formatDate(group.end_date)}` : ''}
                  {group.status ? ` • ${normalizeStatus(group.status)}` : ''}
                </div>
                <div className="student-group-card__stats">
                  <span>Уроків: {group.completed_lessons}</span>
                  <span>Попереду: {group.upcoming_lessons}</span>
                  <span>Присутність: {knownAttendance > 0 ? `${attendanceRate}%` : 'Немає даних'}</span>
                </div>
                {group.next_lesson_at && (
                  <div className="student-group-card__next">
                    Найближчий урок: {formatDateTime(group.next_lesson_at)}
                  </div>
                )}
              </Link>
            );
          })}

          {(individual?.total ?? 0) > 0 && (
            <Link href="/groups/individual" className="student-card student-group-card student-group-card--individual">
              <div className="student-group-card__title">Індивідуальні заняття</div>
              <div className="student-group-card__subtitle">Заняття поза груповим курсом</div>
              <div className="student-group-card__stats">
                <span>Всього: {individual.total}</span>
                <span>Був(ла): {(individual.present_count ?? 0) + (individual.late_count ?? 0)}</span>
                <span>Пропуски: {individual.absent_count ?? 0}</span>
              </div>
              {individual.next_lesson_at && (
                <div className="student-group-card__next">
                  Найближчий урок: {formatDateTime(individual.next_lesson_at)}
                </div>
              )}
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function formatDate(ymd: string): string {
  const d = new Date(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  }).format(d);
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(d);
}

function normalizeStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Активна',
    paused: 'Пауза',
    completed: 'Завершена',
    archived: 'Архів',
  };
  return map[status] || status;
}
