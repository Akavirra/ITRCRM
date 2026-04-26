/**
 * /lessons — повний розклад викладача (минулі + майбутні).
 *
 * На відміну від /dashboard (який показує тільки сьогодні + поточний тиждень),
 * тут — глибша історія за останні 60 днів + наступні 60 днів. Заняття
 * згруповані по даті, найновіші зверху серед майбутніх, найсвіжіші зверху
 * серед минулих.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { addDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { TEACHER_COOKIE_NAME, getTeacherSession } from '@/lib/teacher-auth';
import { listMyLessons } from '@/lib/teacher-data';
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

function getRange(): { today: string; from: string; to: string } {
  const now = toZonedTime(new Date(), KYIV_TZ);
  const today = format(now, 'yyyy-MM-dd');
  const from = format(addDays(now, -60), 'yyyy-MM-dd');
  const to = format(addDays(now, 60), 'yyyy-MM-dd');
  return { today, from, to };
}

export default async function TeacherLessonsPage() {
  const sessionId = cookies().get(TEACHER_COOKIE_NAME)?.value;
  if (!sessionId) redirect('/login');
  const session = await getTeacherSession(sessionId);
  if (!session) redirect('/login');

  const { today, from, to } = getRange();
  const lessons = await listMyLessons(session.user_id, {
    fromDate: from,
    toDate: to,
    limit: 1000,
  });

  // Майбутні: ASC, минулі: DESC
  const upcomingLessons = lessons
    .filter((l) => l.lesson_date >= today)
    .sort((a, b) =>
      a.start_datetime < b.start_datetime ? -1 : a.start_datetime > b.start_datetime ? 1 : 0,
    );
  const pastLessons = lessons
    .filter((l) => l.lesson_date < today)
    .sort((a, b) =>
      a.start_datetime > b.start_datetime ? -1 : a.start_datetime < b.start_datetime ? 1 : 0,
    );

  const groupByDate = (arr: typeof lessons) => {
    const map = new Map<string, typeof lessons>();
    for (const l of arr) {
      if (!map.has(l.lesson_date)) map.set(l.lesson_date, []);
      map.get(l.lesson_date)!.push(l);
    }
    return map;
  };

  const upcomingByDate = groupByDate(upcomingLessons);
  const pastByDate = groupByDate(pastLessons);

  const renderDay = (date: string, dayLessons: typeof lessons) => {
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
          <span className="teacher-day-group__date">
            {dayLabel}
            {date === today && <> · сьогодні</>}
          </span>
          <span className="teacher-day-group__count">{dayLessons.length}</span>
        </div>
        <div className="teacher-day-group__list">
          {dayLessons.map((l) => (
            <TeacherLessonCard key={l.id} lesson={l} variant="compact" />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <h1 className="teacher-page-title">Розклад</h1>
      <p className="teacher-page-subtitle">
        Усі твої заняття — найближчі 60 днів і останні 60 днів історії.
      </p>

      <div
        className="teacher-section-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Майбутні</span>
        <span className="teacher-section-counter">{upcomingLessons.length}</span>
      </div>
      {upcomingLessons.length === 0 ? (
        <div className="teacher-empty">Майбутніх занять не заплановано.</div>
      ) : (
        Array.from(upcomingByDate.keys()).map((d) => renderDay(d, upcomingByDate.get(d)!))
      )}

      <div
        className="teacher-section-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Історія</span>
        <span className="teacher-section-counter">{pastLessons.length}</span>
      </div>
      {pastLessons.length === 0 ? (
        <div className="teacher-empty">Історія порожня.</div>
      ) : (
        Array.from(pastByDate.keys()).map((d) => renderDay(d, pastByDate.get(d)!))
      )}
    </>
  );
}
