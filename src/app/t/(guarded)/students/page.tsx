/**
 * /students — усі учні, з якими зараз працює викладач (унікальні
 * по всіх його активних групах).
 *
 * Дає: швидко знайти учня в одному списку (з фільтром-пошуком — додамо
 * пізніше, поки рендер усього). Натиск веде на /students/[id] — поки заглушка.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TEACHER_COOKIE_NAME, getTeacherSession } from '@/lib/teacher-auth';
import { listMyStudents } from '@/lib/teacher-data';
import TeacherStudentRow from '@/components/teacher/TeacherStudentRow';

export const dynamic = 'force-dynamic';

export default async function TeacherStudentsPage() {
  const sessionId = cookies().get(TEACHER_COOKIE_NAME)?.value;
  if (!sessionId) redirect('/login');
  const session = await getTeacherSession(sessionId);
  if (!session) redirect('/login');

  const students = await listMyStudents(session.user_id);
  const active = students.filter((s) => s.is_active);
  const inactive = students.filter((s) => !s.is_active);

  return (
    <>
      <h1 className="teacher-page-title">Мої учні</h1>
      <p className="teacher-page-subtitle">
        Унікальний список усіх учнів зі всіх твоїх активних груп.
      </p>

      {students.length === 0 ? (
        <div className="teacher-empty">У твоїх групах поки немає активних учнів.</div>
      ) : (
        <>
          <div
            className="teacher-section-header"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span>Активні</span>
            <span className="teacher-section-counter">{active.length}</span>
          </div>
          <div className="teacher-student-list">
            {active.map((s) => (
              <TeacherStudentRow
                key={s.id}
                student={{
                  id: s.id,
                  full_name: s.full_name,
                  photo: s.photo,
                  birth_date: s.birth_date,
                  parent_name: s.parent_name,
                  parent_phone: s.parent_phone,
                  is_active: s.is_active,
                }}
              />
            ))}
          </div>

          {inactive.length > 0 && (
            <>
              <div
                className="teacher-section-header"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>Неактивні</span>
                <span className="teacher-section-counter">{inactive.length}</span>
              </div>
              <div className="teacher-student-list">
                {inactive.map((s) => (
                  <TeacherStudentRow
                    key={s.id}
                    student={{
                      id: s.id,
                      full_name: s.full_name,
                      photo: s.photo,
                      birth_date: s.birth_date,
                      parent_name: s.parent_name,
                      parent_phone: s.parent_phone,
                      is_active: s.is_active,
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
