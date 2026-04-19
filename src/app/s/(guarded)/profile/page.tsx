/**
 * /profile — дані учня, групи, кнопка logout.
 */

import { cookies } from 'next/headers';
import { STUDENT_COOKIE_NAME, getStudentSession, studentIdToCode } from '@/lib/student-auth';
import { studentAll, studentGet } from '@/db/neon-student';
import StudentLogoutButton from '@/components/student/StudentLogoutButton';

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
  if (!session) return <div className="student-empty">Сесія закінчилась</div>;

  const student = await studentGet<{ id: number; full_name: string; photo: string | null }>(
    `SELECT id, full_name, photo FROM students WHERE id = $1`,
    [session.student_id]
  );
  if (!student) return <div className="student-empty">Учня не знайдено</div>;

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
  const initials = student.full_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const sessionExpires = new Date(session.expires_at);

  return (
    <>
      <h1 className="student-page-title">Профіль</h1>

      <div className="student-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: '#2160d0', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 700, flexShrink: 0,
        }}>{initials || 'У'}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>{student.full_name}</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Код: <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{code}</strong>
          </div>
        </div>
      </div>

      <div className="student-section-header">Групи</div>
      {groups.length === 0 ? (
        <div className="student-empty">Ви ще не в жодній активній групі.</div>
      ) : (
        groups.map((g) => (
          <div key={g.id} className="student-card">
            <h3>{g.course_title || g.title || 'Група'}</h3>
            {g.title && g.course_title !== g.title && (
              <p style={{ fontSize: 13, marginBottom: 4 }}>{g.title}</p>
            )}
            <p>
              {g.start_date && formatYmd(g.start_date)}
              {g.end_date && ` – ${formatYmd(g.end_date)}`}
              {g.status && ` • ${g.status}`}
            </p>
          </div>
        ))
      )}

      <div className="student-section-header">Сесія</div>
      <div className="student-card">
        <p style={{ fontSize: 13 }}>
          Дійсна до: <strong>{formatDateTime(sessionExpires)}</strong>
        </p>
      </div>

      <div style={{ marginTop: 24 }}>
        <StudentLogoutButton />
      </div>
    </>
  );
}

function formatYmd(ymd: string): string {
  const d = new Date(ymd);
  if (isNaN(d.getTime())) return ymd;
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv' }).format(d);
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(d);
}
