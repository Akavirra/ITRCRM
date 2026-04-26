/**
 * /dashboard — головна сторінка teacher-портaлa (E.1.2).
 *
 * Що показуємо:
 *   1. Привітання з днем/датою (Kyiv timezone)
 *   2. Сьогодні: усі заняття цього дня великими картками
 *   3. Цей тиждень: решта днів тижня (компактні рядки під заголовками днів)
 *
 * Дані — через listMyLessons з teacher-data (вже фільтрує по teacher_id +
 * заміни + індивідуальні).
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { addDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { TEACHER_COOKIE_NAME, getTeacherSession } from '@/lib/teacher-auth';
import { teacherGet } from '@/db/neon-teacher';
import { listMyLessons } from '@/lib/teacher-data';
import TeacherLessonCard from '@/components/teacher/TeacherLessonCard';
import TeacherLogoutButton from '@/components/teacher/TeacherLogoutButton';

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

function getWeekBounds(): { today: string; monday: string; sunday: string; nowKyiv: Date } {
  const nowKyiv = toZonedTime(new Date(), KYIV_TZ);
  const day = nowKyiv.getDay();
  const daysFromMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(nowKyiv, daysFromMonday);
  const sunday = addDays(monday, 6);
  return {
    today: format(nowKyiv, 'yyyy-MM-dd'),
    monday: format(monday, 'yyyy-MM-dd'),
    sunday: format(sunday, 'yyyy-MM-dd'),
    nowKyiv,
  };
}

function formatHumanDate(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: KYIV_TZ,
  }).format(date);
}

export default async function TeacherDashboardPage() {
  const sessionId = cookies().get(TEACHER_COOKIE_NAME)?.value;
  if (!sessionId) redirect('/login');
  const session = await getTeacherSession(sessionId);
  if (!session) redirect('/login');

  const user = await teacherGet<{ id: number; name: string }>(
    `SELECT id, name FROM users WHERE id = $1`,
    [session.user_id],
  );
  if (!user) redirect('/login');

  const { today, monday, sunday, nowKyiv } = getWeekBounds();
  const allWeekLessons = await listMyLessons(user.id, {
    fromDate: monday,
    toDate: sunday,
  });

  const todayLessons = allWeekLessons.filter((l) => l.lesson_date === today);

  // Решта тижня — групуємо по lesson_date, виключаючи сьогодні
  const restByDate = new Map<string, typeof allWeekLessons>();
  for (const l of allWeekLessons) {
    if (l.lesson_date === today) continue;
    if (!restByDate.has(l.lesson_date)) restByDate.set(l.lesson_date, []);
    restByDate.get(l.lesson_date)!.push(l);
  }
  // Сортуємо ключі за датою
  const restDates = Array.from(restByDate.keys()).sort();

  const firstName = (user.name || '').trim().split(/\s+/)[0] || 'викладач';

  return (
    <>
      <h1 className="teacher-page-title">Вітаю, {firstName} 👋</h1>
      <p className="teacher-page-subtitle">
        Сьогодні: {formatHumanDate(nowKyiv)}
      </p>

      {/* === Сьогодні === */}
      <div
        className="teacher-section-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Сьогодні</span>
        <span className="teacher-section-counter">{todayLessons.length}</span>
      </div>

      {todayLessons.length === 0 ? (
        <div className="teacher-empty">
          🌿 Сьогодні занять немає. Гарного дня!
        </div>
      ) : (
        <div className="teacher-lesson-stack">
          {todayLessons.map((lesson) => (
            <TeacherLessonCard key={lesson.id} lesson={lesson} variant="today" />
          ))}
        </div>
      )}

      {/* === Тиждень === */}
      <div
        className="teacher-section-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Цей тиждень</span>
        <span className="teacher-section-counter">
          {allWeekLessons.length - todayLessons.length}
        </span>
      </div>

      {restDates.length === 0 ? (
        <div className="teacher-empty">
          На решту тижня занять немає.
        </div>
      ) : (
        restDates.map((date) => {
          const lessons = restByDate.get(date)!;
          const dateObj = new Date(`${date}T12:00:00+02:00`);
          const dayName = DAY_LABELS[dateObj.getDay()];
          const dayLabel = new Intl.DateTimeFormat('uk-UA', {
            day: 'numeric',
            month: 'short',
            timeZone: KYIV_TZ,
          }).format(dateObj);
          return (
            <div key={date} className="teacher-day-group">
              <div className="teacher-day-group__header">
                <span className="teacher-day-group__day">{dayName}</span>
                <span className="teacher-day-group__date">{dayLabel}</span>
                <span className="teacher-day-group__count">{lessons.length}</span>
              </div>
              <div className="teacher-day-group__list">
                {lessons.map((lesson) => (
                  <TeacherLessonCard key={lesson.id} lesson={lesson} variant="compact" />
                ))}
              </div>
            </div>
          );
        })
      )}

      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'flex-end' }}>
        <TeacherLogoutButton />
      </div>
    </>
  );
}
