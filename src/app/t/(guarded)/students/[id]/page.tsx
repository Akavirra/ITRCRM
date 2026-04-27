/**
 * /students/[id] — сторінка учня для викладача (мінімальна, з фільтрацією).
 *
 * Показуємо ТІЛЬКИ:
 *   - фото, ім'я, вік
 *   - основний контакт (parent_name + parent_phone)
 *   - групи цього учня, ДЕ ВЧИТЕЛЬ — Я (інших не показуємо)
 *   - присутність на МОЇХ заняттях (свої групи + заміни + індивідуальні)
 *
 * НЕ показуємо: email, школу, gender, parent2_*, source, discount, інші групи
 * учня, відвідування у інших викладачів — це не моя справа.
 */

import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { TEACHER_COOKIE_NAME, getTeacherSession } from '@/lib/teacher-auth';
import {
  getMyStudent,
  listGroupsOfMyStudent,
  listMyAttendanceOfStudent,
} from '@/lib/teacher-data';
import TeacherGroupCard from '@/components/teacher/TeacherGroupCard';

export const dynamic = 'force-dynamic';

const KYIV_TZ = 'Europe/Kyiv';

function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 && age < 100 ? age : null;
}

function avatarLetter(name: string): string {
  const t = (name || '').trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KYIV_TZ,
  }).format(new Date(iso));
}

function attendanceBadge(status: string | null) {
  if (!status) {
    return (
      <span
        className="teacher-lesson-badge"
        style={{ background: '#fef3c7', color: '#92400e' }}
      >
        Не позначено
      </span>
    );
  }
  if (status === 'present') {
    return (
      <span
        className="teacher-lesson-badge"
        style={{ background: '#ecfdf5', color: '#047857' }}
      >
        Присутній
      </span>
    );
  }
  // absent / makeup_planned / makeup_done — все об'єднуємо як "Відсутній" (як у Telegram-app)
  return (
    <span
      className="teacher-lesson-badge"
      style={{ background: '#fef2f2', color: '#b91c1c' }}
    >
      Відсутній
    </span>
  );
}

interface PageProps {
  params: { id: string };
}

export default async function TeacherStudentDetailPage({ params }: PageProps) {
  const sessionId = cookies().get(TEACHER_COOKIE_NAME)?.value;
  if (!sessionId) redirect('/login');
  const session = await getTeacherSession(sessionId);
  if (!session) redirect('/login');

  const studentId = parseInt(params.id, 10);
  if (!Number.isInteger(studentId) || studentId <= 0) notFound();

  const student = await getMyStudent(session.user_id, studentId);
  if (!student) notFound();

  const [groups, attendance] = await Promise.all([
    listGroupsOfMyStudent(session.user_id, studentId),
    listMyAttendanceOfStudent(session.user_id, studentId),
  ]);

  const age = ageFromBirthDate(student.birth_date);

  // Статистика по присутності (тільки на моїх заняттях)
  const stats = {
    total: attendance.length,
    present: attendance.filter((a) => a.status === 'present').length,
    absent: attendance.filter((a) => a.status && a.status !== 'present').length,
    pending: attendance.filter((a) => !a.status).length,
  };
  const knownTotal = stats.present + stats.absent;
  const presenceRate =
    knownTotal > 0 ? Math.round((stats.present / knownTotal) * 100) : null;

  return (
    <>
      <Link href="/students" className="teacher-secondary-btn" style={{ marginBottom: 12 }}>
        ← До списку учнів
      </Link>

      <div className="teacher-card teacher-profile-card">
        <div className="teacher-profile-card__avatar">
          {student.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.photo} alt={student.full_name} />
          ) : (
            <span>{avatarLetter(student.full_name)}</span>
          )}
        </div>
        <div className="teacher-profile-card__main">
          <div className="teacher-profile-card__name">{student.full_name}</div>
          {age !== null && (
            <div className="teacher-profile-card__email">{age} років</div>
          )}
          {!student.is_active && (
            <div
              className="teacher-lesson-badge"
              style={{
                background: '#f1f5f9',
                color: '#64748b',
                marginTop: 6,
                alignSelf: 'flex-start',
              }}
            >
              Неактивний
            </div>
          )}
        </div>
      </div>

      <div className="teacher-section-header">Контакт батьків</div>
      <div className="teacher-card">
        {student.parent_phone ? (
          <dl className="teacher-profile-list">
            <div className="teacher-profile-list__row">
              <dt>Хто</dt>
              <dd>{student.parent_name || 'Не вказано'}</dd>
            </div>
            <div className="teacher-profile-list__row">
              <dt>Телефон</dt>
              <dd>
                <a
                  href={`tel:${student.parent_phone}`}
                  className="teacher-profile-list__link"
                >
                  {student.parent_phone}
                </a>
              </dd>
            </div>
          </dl>
        ) : (
          <div style={{ color: '#64748b', fontSize: 14 }}>
            Контакту батьків у БД немає. Якщо потрібен — звернись до адміністратора.
          </div>
        )}
      </div>

      <div
        className="teacher-section-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Мої групи з цим учнем</span>
        <span className="teacher-section-counter">{groups.length}</span>
      </div>
      {groups.length === 0 ? (
        <div className="teacher-empty">
          У жодній з твоїх груп цей учень зараз не активний.
        </div>
      ) : (
        <div className="teacher-group-grid">
          {groups.map((g) => (
            <TeacherGroupCard key={g.id} group={g} />
          ))}
        </div>
      )}

      <div
        className="teacher-section-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Присутність на моїх заняттях</span>
        <span className="teacher-section-counter">{stats.total}</span>
      </div>

      {stats.total === 0 ? (
        <div className="teacher-empty">
          Поки немає записів присутності цього учня на твоїх заняттях.
        </div>
      ) : (
        <>
          <div className="teacher-attendance-summary">
            <span>
              <strong>{stats.present}</strong> присутніх
            </span>
            <span>
              <strong>{stats.absent}</strong> відсутніх
            </span>
            {stats.pending > 0 && (
              <span className="teacher-attendance-summary__pending">
                <strong>{stats.pending}</strong> не позначено
              </span>
            )}
            {presenceRate !== null && (
              <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
                Присутність:{' '}
                <span
                  style={{
                    color:
                      presenceRate >= 80
                        ? '#047857'
                        : presenceRate >= 50
                        ? '#b45309'
                        : '#b91c1c',
                  }}
                >
                  {presenceRate}%
                </span>
              </span>
            )}
          </div>

          <ul className="teacher-attendance-history">
            {attendance.map((a) => (
              <li key={a.attendance_id} className="teacher-attendance-history__row">
                <Link
                  href={`/lessons/${a.lesson_id}`}
                  className="teacher-attendance-history__link"
                >
                  <span className="teacher-attendance-history__date">
                    {formatDateTime(a.start_datetime)}
                  </span>
                  <span className="teacher-attendance-history__title">
                    {a.course_title || a.group_title || 'Заняття'}
                    {a.topic && (
                      <span className="teacher-attendance-history__topic"> · {a.topic}</span>
                    )}
                  </span>
                  <span className="teacher-attendance-history__status">
                    {attendanceBadge(a.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
