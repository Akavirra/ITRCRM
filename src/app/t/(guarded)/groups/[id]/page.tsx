/**
 * /groups/[id] — деталі групи для викладача (E.1.4).
 *
 * Sections:
 *   - Заголовок: курс, група, розклад, статус, кількість активних учнів
 *   - Учні (з фото + контакт батьків) — клік за ним веде у /students/[id]
 *   - Найближчі заняття (майбутні)
 *   - Історія занять
 *
 * Усе через teacher-data.ts: getMyGroup + listStudentsInMyGroup +
 * listLessonsInMyGroup. notFound() якщо група не належить викладачу.
 */

import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { TEACHER_COOKIE_NAME, getTeacherSession } from '@/lib/teacher-auth';
import {
  getMyGroup,
  listLessonsInMyGroup,
  listStudentsInMyGroup,
} from '@/lib/teacher-data';
import TeacherStudentRow from '@/components/teacher/TeacherStudentRow';
import TeacherLessonCard from '@/components/teacher/TeacherLessonCard';

export const dynamic = 'force-dynamic';

const KYIV_TZ = 'Europe/Kyiv';
const DAY_LABELS = [
  'Неділя',
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  "П'ятниця",
  'Субота',
];

function getDayLabel(weeklyDay: number): string {
  // DB використовує 1-7 (Пн-Нд), JS — 0-6 (Нд-Сб)
  const jsIdx = weeklyDay === 7 ? 0 : weeklyDay;
  return DAY_LABELS[jsIdx] || '?';
}

function formatHHMM(time: string): string {
  const [h, m] = time.split(':');
  return `${h}:${m}`;
}

function formatDateOnly(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: KYIV_TZ,
  }).format(d);
}

function todayKyivYMD(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: KYIV_TZ,
  }).format(new Date());
}

interface PageProps {
  params: { id: string };
}

export default async function TeacherGroupDetailPage({ params }: PageProps) {
  const sessionId = cookies().get(TEACHER_COOKIE_NAME)?.value;
  if (!sessionId) redirect('/login');
  const session = await getTeacherSession(sessionId);
  if (!session) redirect('/login');

  const groupId = parseInt(params.id, 10);
  if (!Number.isInteger(groupId) || groupId <= 0) notFound();

  const group = await getMyGroup(session.user_id, groupId);
  if (!group) notFound();

  const [students, lessons] = await Promise.all([
    listStudentsInMyGroup(session.user_id, groupId),
    listLessonsInMyGroup(session.user_id, groupId, { limit: 200 }),
  ]);

  const today = todayKyivYMD();
  const upcoming = lessons
    .filter((l) => l.lesson_date >= today)
    .sort((a, b) =>
      a.start_datetime < b.start_datetime ? -1 : a.start_datetime > b.start_datetime ? 1 : 0,
    );
  const past = lessons
    .filter((l) => l.lesson_date < today)
    .sort((a, b) =>
      a.start_datetime > b.start_datetime ? -1 : a.start_datetime < b.start_datetime ? 1 : 0,
    );

  const courseTitle = group.course_title || 'Курс';
  const periodFrom = formatDateOnly(group.start_date);
  const periodTo = formatDateOnly(group.end_date);

  return (
    <>
      <Link
        href="/groups"
        className="teacher-secondary-btn"
        style={{ marginBottom: 12 }}
      >
        ← До груп
      </Link>

      <h1 className="teacher-page-title">{courseTitle}</h1>
      <p className="teacher-page-subtitle">{group.title}</p>

      <div className="teacher-card">
        <div className="teacher-group-meta">
          <div>
            <span className="teacher-group-meta__label">Розклад</span>
            <span className="teacher-group-meta__value">
              {getDayLabel(group.weekly_day)} · {formatHHMM(group.start_time)} (
              {group.duration_minutes} хв)
            </span>
          </div>
          {(periodFrom || periodTo) && (
            <div>
              <span className="teacher-group-meta__label">Період</span>
              <span className="teacher-group-meta__value">
                {periodFrom || '...'} – {periodTo || '...'}
              </span>
            </div>
          )}
          <div>
            <span className="teacher-group-meta__label">Учнів</span>
            <span className="teacher-group-meta__value">
              {group.active_student_count} активних
            </span>
          </div>
          <div>
            <span className="teacher-group-meta__label">Статус</span>
            <span className="teacher-group-meta__value">
              {group.status === 'active'
                ? 'Активна'
                : group.status === 'graduate'
                ? 'Випускна'
                : group.status === 'inactive'
                ? 'На паузі'
                : group.status}
              {!group.is_active && ' · Архів'}
            </span>
          </div>
        </div>
      </div>

      {/* === Учні === */}
      <div
        className="teacher-section-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Учні</span>
        <span className="teacher-section-counter">{students.length}</span>
      </div>
      {students.length === 0 ? (
        <div className="teacher-empty">У групі поки немає активних учнів.</div>
      ) : (
        <div className="teacher-student-list">
          {students.map((s) => (
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
      )}

      {/* === Найближчі заняття === */}
      <div
        className="teacher-section-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Найближчі заняття</span>
        <span className="teacher-section-counter">{upcoming.length}</span>
      </div>
      {upcoming.length === 0 ? (
        <div className="teacher-empty">Майбутніх занять не заплановано.</div>
      ) : (
        <div className="teacher-day-group__list" style={{ marginBottom: 16 }}>
          {upcoming.map((l) => (
            <TeacherLessonCard key={l.id} lesson={l} variant="compact" />
          ))}
        </div>
      )}

      {/* === Історія === */}
      <div
        className="teacher-section-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Історія</span>
        <span className="teacher-section-counter">{past.length}</span>
      </div>
      {past.length === 0 ? (
        <div className="teacher-empty">Проведених занять ще не було.</div>
      ) : (
        <div className="teacher-day-group__list">
          {past.map((l) => (
            <TeacherLessonCard key={l.id} lesson={l} variant="compact" />
          ))}
        </div>
      )}
    </>
  );
}
