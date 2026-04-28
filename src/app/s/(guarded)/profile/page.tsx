/**
 * /profile — дані учня, групи, кнопка logout.
 */

import { cookies } from 'next/headers';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { STUDENT_COOKIE_NAME, getStudentSession, studentIdToCode } from '@/lib/student-auth';
import { studentAll, studentGet } from '@/db/neon-student';
import StudentLogoutButton from '@/components/student/StudentLogoutButton';
import { PageHeader } from '@/components/student/ui/PageHeader';
import { SectionHeader } from '@/components/student/ui/SectionHeader';
import { EmptyState } from '@/components/student/ui/EmptyState';

export const dynamic = 'force-dynamic';

interface GroupDTO {
  id: number;
  title: string | null;
  course_title: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
}

export default async function StudentProfilePage() {
  const sessionId = cookies().get(STUDENT_COOKIE_NAME)?.value;
  const session = sessionId ? await getStudentSession(sessionId) : null;
  if (!session) {
    return <EmptyState title="Сесія закінчилась" hint="Увійдіть знову, щоб продовжити." />;
  }

  const student = await studentGet<{ id: number; full_name: string; photo: string | null }>(
    `SELECT id, full_name, photo FROM students WHERE id = $1`,
    [session.student_id]
  );
  if (!student) {
    return <EmptyState title="Учня не знайдено" />;
  }

  const codeRow = await studentGet<{ code: string; created_at: string }>(
    `SELECT code, created_at FROM student_codes WHERE student_id = $1 AND is_active = TRUE`,
    [student.id]
  );

  const groups = await studentAll<GroupDTO>(
    `SELECT g.id, g.title, c.title AS course_title, g.start_date, g.end_date, sg.status
     FROM student_groups sg
     JOIN groups g ON g.id = sg.group_id
     LEFT JOIN courses c ON c.id = g.course_id
     WHERE sg.student_id = $1 AND sg.is_active = TRUE
     ORDER BY g.start_date DESC NULLS LAST`,
    [student.id]
  );

  const code = codeRow?.code || studentIdToCode(student.id);
  const initials = student.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'У';
  const sessionExpires = new Date(session.expires_at);

  return (
    <>
      <PageHeader title="Профіль" subtitle="Твої дані, групи та сесія" />

      <article className="student-profile-hero">
        <div className="student-profile-hero__avatar">
          {student.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.photo} alt="" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="student-profile-hero__body">
          <div className="student-profile-hero__name">{student.full_name}</div>
          <div className="student-profile-hero__code">
            Код учня: <span className="student-profile-hero__code-value">{code}</span>
          </div>
        </div>
      </article>

      <SectionHeader title="Групи" />
      {groups.length === 0 ? (
        <EmptyState
          icon={<Users size={28} strokeWidth={1.75} />}
          title="Поки що немає активних груп"
          hint="Як тільки тебе додадуть до групи — вона з'явиться тут."
        />
      ) : (
        <div className="student-profile-group-list">
          {groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="student-profile-group">
              <div className="student-profile-group__title">{g.course_title || g.title || 'Група'}</div>
              {g.title && g.course_title !== g.title && (
                <div className="student-profile-group__subtitle">{g.title}</div>
              )}
              <div className="student-profile-group__meta">
                {g.start_date && formatYmd(g.start_date)}
                {g.end_date && ` – ${formatYmd(g.end_date)}`}
                {g.status && ` • ${normalizeStatus(g.status)}`}
              </div>
            </Link>
          ))}
        </div>
      )}

      <SectionHeader title="Сесія" />
      <div className="student-profile-session">
        Дійсна до: <strong>{formatDateTime(sessionExpires)}</strong>
      </div>

      <div style={{ marginTop: 28 }}>
        <StudentLogoutButton />
      </div>
    </>
  );
}

function formatYmd(ymd: string): string {
  const d = new Date(ymd);
  if (isNaN(d.getTime())) return ymd;
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  }).format(d);
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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
