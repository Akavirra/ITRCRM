/**
 * /groups — список груп викладача.
 *
 * Показує всі групи, де він поточний teacher_id (без історії з
 * group_teacher_assignments — якщо колись міняли, теж не показуємо тут).
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TEACHER_COOKIE_NAME, getTeacherSession } from '@/lib/teacher-auth';
import { listMyGroups } from '@/lib/teacher-data';
import TeacherGroupCard from '@/components/teacher/TeacherGroupCard';

export const dynamic = 'force-dynamic';

export default async function TeacherGroupsListPage() {
  const sessionId = cookies().get(TEACHER_COOKIE_NAME)?.value;
  if (!sessionId) redirect('/login');
  const session = await getTeacherSession(sessionId);
  if (!session) redirect('/login');

  const groups = await listMyGroups(session.user_id);
  const activeGroups = groups.filter((g) => g.is_active);
  const archivedGroups = groups.filter((g) => !g.is_active);

  return (
    <>
      <h1 className="teacher-page-title">Мої групи</h1>
      <p className="teacher-page-subtitle">
        Усі групи, які зараз ведеш. Натисни картку, щоб подивитися учнів і заняття.
      </p>

      {groups.length === 0 ? (
        <div className="teacher-empty">
          У тебе зараз немає прив&apos;язаних груп. Якщо це помилка — напиши адміністратору.
        </div>
      ) : (
        <>
          {activeGroups.length > 0 && (
            <>
              <div
                className="teacher-section-header"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>Активні</span>
                <span className="teacher-section-counter">{activeGroups.length}</span>
              </div>
              <div className="teacher-group-grid">
                {activeGroups.map((g) => (
                  <TeacherGroupCard key={g.id} group={g} />
                ))}
              </div>
            </>
          )}

          {archivedGroups.length > 0 && (
            <>
              <div
                className="teacher-section-header"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>Архів</span>
                <span className="teacher-section-counter">{archivedGroups.length}</span>
              </div>
              <div className="teacher-group-grid">
                {archivedGroups.map((g) => (
                  <TeacherGroupCard key={g.id} group={g} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
