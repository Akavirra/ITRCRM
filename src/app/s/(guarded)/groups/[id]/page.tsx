/**
 * /groups/[id] — детальна сторінка групи або індивідуальних занять.
 *
 * Phase A (Context-Aware):
 *   - Показує тільки ОДНЕ наступне заняття (решта майбутніх приховані).
 *   - Live-таймер зворотного відліку до початку наступного.
 *   - Бейдж "Заняття триває" коли now ∈ [start, end].
 *   - "Active state" банер коли заняття у вікні [start-15хв; end+1год] — сторінка стає "доступною".
 *   - Історія: усі минулі заняття з темою + статусом присутності.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { ArrowLeft, Calendar, CalendarOff } from 'lucide-react';
import { STUDENT_COOKIE_NAME, getStudentSession } from '@/lib/student-auth';
import { studentAll, studentGet } from '@/db/neon-student';
import { isLessonActive, isLessonLive, getUploadWindow } from '@/lib/student-lesson-context';
import LessonRow from '@/components/student/LessonRow';
import CountdownTimer from '@/components/student/CountdownTimer';
import LiveLessonBadge from '@/components/student/LiveLessonBadge';
import LessonWorksPanel from '@/components/student/LessonWorksPanel';
import LessonGallery from '@/components/student/LessonGallery';
import { getStudentGalleryCounts } from '@/lib/student-gallery';
import { getStudentShortcutsCounts } from '@/lib/student-shortcuts';
import LessonShortcuts from '@/components/student/LessonShortcuts';
import { stripTimePrefix } from '@/components/student/utils';
import { EmptyState } from '@/components/student/ui/EmptyState';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams?: { active?: string };
}

interface GroupMeta {
  id: number;
  title: string | null;
  course_title: string | null;
  weekly_day: number | null;
  start_time: string | null;
  duration_minutes: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
}

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

export default async function StudentGroupDetailsPage({ params, searchParams }: PageProps) {
  const sessionId = cookies().get(STUDENT_COOKIE_NAME)?.value;
  const session = sessionId ? await getStudentSession(sessionId) : null;
  if (!session) {
    return <EmptyState title="Сесія закінчилась" hint="Увійдіть знову." />;
  }

  const idParam = params.id;
  const isIndividual = idParam === 'individual';

  let pageTitle = 'Група';
  let pageSubtitle = '';
  let lessons: LessonDTO[] = [];
  const summaryMeta: string[] = [];

  if (isIndividual) {
    pageTitle = 'Індивідуальні заняття';
    pageSubtitle = 'Історія та майбутнє індивідуальне заняття';
    lessons = await studentAll<LessonDTO>(
      `SELECT
         l.id, l.group_id, l.course_id,
         l.lesson_date, l.start_datetime, l.end_datetime,
         l.topic, l.status, l.is_makeup, l.is_trial,
         g.title AS group_title,
         c.title AS course_title,
         a.status AS attendance_status
       FROM attendance a
       JOIN lessons l ON l.id = a.lesson_id
       LEFT JOIN groups g ON g.id = l.group_id
       LEFT JOIN courses c ON c.id = l.course_id
       WHERE a.student_id = $1
         AND (
           l.group_id IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM student_groups sg
             WHERE sg.student_id = $1 AND sg.group_id = l.group_id
           )
         )
       ORDER BY l.start_datetime DESC
       LIMIT 200`,
      [session.student_id],
    );
    summaryMeta.push('Поза груповим розкладом');
  } else {
    const groupId = Number(idParam);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      notFound();
    }

    const group = await studentGet<GroupMeta>(
      `SELECT
         g.id,
         g.title,
         c.title AS course_title,
         g.weekly_day,
         g.start_time,
         g.duration_minutes,
         g.start_date,
         g.end_date,
         sg.status
       FROM student_groups sg
       JOIN groups g ON g.id = sg.group_id
       LEFT JOIN courses c ON c.id = g.course_id
       WHERE sg.student_id = $1 AND sg.group_id = $2`,
      [session.student_id, groupId],
    );

    if (!group) {
      notFound();
    }

    const strippedGroupTitle = stripTimePrefix(group.title);
    pageTitle = group.course_title || strippedGroupTitle || 'Група';
    pageSubtitle =
      group.title && group.course_title !== group.title
        ? strippedGroupTitle || 'Твоє навчальне середовище'
        : 'Твоє навчальне середовище';

    if (group.weekly_day) summaryMeta.push(`День: ${weeklyDayToLabel(group.weekly_day)}`);
    if (group.start_time) summaryMeta.push(`Час: ${group.start_time.slice(0, 5)}`);
    if (group.duration_minutes) summaryMeta.push(`Тривалість: ${group.duration_minutes} хв`);

    lessons = await studentAll<LessonDTO>(
      `SELECT
         l.id, l.group_id, l.course_id,
         l.lesson_date, l.start_datetime, l.end_datetime,
         l.topic, l.status, l.is_makeup, l.is_trial,
         g.title AS group_title,
         c.title AS course_title,
         a.status AS attendance_status
       FROM lessons l
       LEFT JOIN groups g ON g.id = l.group_id
       LEFT JOIN courses c ON c.id = l.course_id
       LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = $1
       WHERE l.group_id = $2
       ORDER BY l.start_datetime DESC
       LIMIT 300`,
      [session.student_id, groupId],
    );
  }

  const now = Date.now();

  const requestedActiveId = searchParams?.active ? Number(searchParams.active) : null;
  const requestedActive =
    requestedActiveId && Number.isInteger(requestedActiveId)
      ? lessons.find((l) => l.id === requestedActiveId) ?? null
      : null;

  const autoActive = lessons.find((l) => isLessonActive(l, now)) ?? null;
  const activeLesson = requestedActive ?? autoActive;

  const upcomingAll = lessons
    .filter((l) => new Date(l.start_datetime).getTime() >= now)
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
  const nextLesson =
    upcomingAll.find((l) => !activeLesson || l.id !== activeLesson.id) ?? null;

  const history = lessons
    .filter((l) => new Date(l.start_datetime).getTime() < now)
    .sort((a, b) => new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime());

  const galleryCounts = await getStudentGalleryCounts(
    session.student_id,
    lessons.map((l) => l.id),
  );

  const shortcutsCounts = await getStudentShortcutsCounts(
    session.student_id,
    lessons.map((l) => l.id),
  );

  const stats = calcStats(lessons);
  const attendanceRate =
    stats.knownAttendance > 0
      ? Math.round(((stats.present + stats.late) / stats.knownAttendance) * 100)
      : 0;
  const rateLevel: 'high' | 'mid' | 'low' =
    attendanceRate >= 80 ? 'high' : attendanceRate >= 50 ? 'mid' : 'low';

  const lessonLiveNow = activeLesson ? isLessonLive(activeLesson, now) : false;
  const isInActiveWindow = activeLesson ? isLessonActive(activeLesson, now) : false;
  const isPastLesson =
    !!activeLesson &&
    !isInActiveWindow &&
    new Date(activeLesson.start_datetime).getTime() < now;
  const showWorksPanel = !!activeLesson && (isInActiveWindow || isPastLesson);

  const groupHrefKey = isIndividual ? 'individual' : params.id;
  const lessonHref = (lessonId: number) => `/groups/${groupHrefKey}?active=${lessonId}`;

  return (
    <>
      <div className="student-page-header">
        <Link href="/dashboard?stay=1" className="student-back-link">
          <ArrowLeft size={14} strokeWidth={1.75} style={{ marginRight: 6 }} />
          До моїх груп
        </Link>
        <div className="student-page-header__content">
          <div>
            <h1 className="student-page-title">{pageTitle}</h1>
            <p className="student-page-subtitle" style={{ marginBottom: 0 }}>{pageSubtitle}</p>
          </div>
          {summaryMeta.length > 0 && (
            <div className="student-group-quick-meta">
              {summaryMeta.map((item) => (
                <span key={item} className="student-meta-badge">
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="student-group-grid-layout">
        <div className="student-group-main-content">
          {activeLesson && (
            <article
              className={
                'student-active-lesson-widget' +
                (lessonLiveNow ? ' student-active-lesson-widget--live' : '')
              }
            >
              <div className="student-active-lesson-widget__header">
                <div className="student-active-lesson-widget__kicker">
                  {lessonLiveNow
                    ? 'Зараз триває заняття'
                    : isPastLesson
                      ? 'Проведене заняття'
                      : isInActiveWindow
                        ? 'Ось-ось почнеться'
                        : 'Заняття'}
                </div>
                <LiveLessonBadge
                  startIso={activeLesson.start_datetime}
                  endIso={activeLesson.end_datetime}
                />
              </div>

              <h2 className="student-active-lesson-widget__topic">
                {activeLesson.topic ||
                  (isPastLesson ? 'Тему не вказано' : 'Тему буде оновлено викладачем')}
              </h2>

              <div className="student-active-lesson-widget__meta">
                <Calendar size={16} strokeWidth={1.75} />
                {formatTimeRange(activeLesson.start_datetime, activeLesson.end_datetime)}
              </div>

              {!lessonLiveNow && !isPastLesson && (
                <div className="student-active-lesson-widget__timer">
                  <div className="timer-label">Почнеться через</div>
                  <CountdownTimer
                    targetIso={activeLesson.start_datetime}
                    reachedLabel="Заняття почалось"
                  />
                </div>
              )}

              {galleryCounts[activeLesson.id] > 0 && (
                <div className="student-active-lesson-widget__gallery">
                  <LessonGallery
                    lessonId={activeLesson.id}
                    count={galleryCounts[activeLesson.id]}
                  />
                </div>
              )}
            </article>
          )}

          {activeLesson && shortcutsCounts[activeLesson.id] > 0 && (
            <section className="student-group-section">
              <div className="student-section-header">Швидкий доступ</div>
              <LessonShortcuts lessonId={activeLesson.id} />
            </section>
          )}

          {activeLesson && showWorksPanel &&
            (() => {
              const uploadWindow = getUploadWindow(activeLesson, now);
              return (
                <section className="student-group-section">
                  <LessonWorksPanel
                    lessonId={activeLesson.id}
                    uploadWindowOpen={uploadWindow.isOpen}
                    uploadWindowClosesAt={uploadWindow.closesAt}
                    lessonTitle={activeLesson.topic || 'Заняття'}
                  />
                </section>
              );
            })()}
        </div>

        <aside className="student-group-sidebar">
          <section className="student-attendance-stats" style={{ marginBottom: 0 }}>
            <div className="student-attendance-stats__main">
              <div className="student-attendance-stats__label">Твоя присутність</div>
              <div
                className={`student-attendance-stats__value student-attendance-stats__value--${rateLevel}`}
              >
                {stats.knownAttendance > 0 ? `${attendanceRate}%` : '—'}
              </div>
              <div className="student-attendance-stats__progress">
                <div
                  className={`student-attendance-stats__progress-bar student-attendance-stats__progress-bar--${rateLevel}`}
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            </div>
            <div className="student-attendance-stats__details">
              <div className="student-attendance-stats__detail">
                <span className="student-attendance-stats__detail-label">Відвідано</span>
                <span className="student-attendance-stats__detail-value student-attendance-stats__detail-value--success">
                  {stats.present + stats.late}
                </span>
              </div>
              <div className="student-attendance-stats__detail">
                <span className="student-attendance-stats__detail-label">Пропуски</span>
                <span className="student-attendance-stats__detail-value student-attendance-stats__detail-value--danger">
                  {stats.absent}
                </span>
              </div>
              <div className="student-attendance-stats__detail">
                <span className="student-attendance-stats__detail-label">Поважна</span>
                <span className="student-attendance-stats__detail-value student-attendance-stats__detail-value--info">
                  {stats.excused}
                </span>
              </div>
            </div>
          </section>

          {nextLesson && (
            <section className="student-group-section">
              <div className="student-section-header">Наступне заняття</div>
              <div className="student-next-lesson-compact">
                <LessonRow lesson={nextLesson} galleryCount={galleryCounts[nextLesson.id] ?? 0} />
                {!activeLesson && (
                  <div className="next-timer">
                    <CountdownTimer targetIso={nextLesson.start_datetime} compact />
                  </div>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>

      <section className="student-group-section">
        <div className="student-section-header">Історія занять ({history.length})</div>
        {history.length === 0 ? (
          <EmptyState
            icon={<CalendarOff size={28} strokeWidth={1.75} />}
            title="Проведених занять ще немає"
            variant="inline"
          />
        ) : (
          <div className="student-attendance-list">
            {history.map((lesson) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                galleryCount={galleryCounts[lesson.id] ?? 0}
                href={lessonHref(lesson.id)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function calcStats(lessons: LessonDTO[]) {
  let present = 0;
  let absent = 0;
  let excused = 0;
  let late = 0;
  let makeup = 0;

  lessons.forEach((l) => {
    if (l.attendance_status === 'present') present++;
    if (l.attendance_status === 'absent') absent++;
    if (l.attendance_status === 'excused') excused++;
    if (l.attendance_status === 'late') late++;
    if (l.is_makeup && l.attendance_status === 'present') makeup++;
  });

  return {
    present,
    absent,
    excused,
    late,
    makeup,
    knownAttendance: present + absent + excused + late,
  };
}

function weeklyDayToLabel(day: number): string {
  const map: Record<number, string> = {
    1: 'Понеділок',
    2: 'Вівторок',
    3: 'Середа',
    4: 'Четвер',
    5: "П'ятниця",
    6: 'Субота',
    7: 'Неділя',
  };
  return map[day] || String(day);
}

function formatTimeRange(startIso: string, endIso: string): string {
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
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}
