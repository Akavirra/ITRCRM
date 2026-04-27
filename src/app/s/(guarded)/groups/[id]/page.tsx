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
import { STUDENT_COOKIE_NAME, getStudentSession } from '@/lib/student-auth';
import { studentAll, studentGet } from '@/db/neon-student';
import { isLessonActive, isLessonLive, getUploadWindow } from '@/lib/student-lesson-context';
import LessonRow from '@/components/student/LessonRow';
import CountdownTimer from '@/components/student/CountdownTimer';
import LiveLessonBadge from '@/components/student/LiveLessonBadge';
import LessonWorksPanel from '@/components/student/LessonWorksPanel';
import LessonGallery from '@/components/student/LessonGallery';
import LessonShortcuts from '@/components/student/LessonShortcuts';
import { getStudentGalleryCounts } from '@/lib/student-gallery';
import { getStudentShortcutsCounts } from '@/lib/student-shortcuts';

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
  if (!session) return <div className="student-empty">Сесія закінчилась</div>;

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

    pageTitle = group.course_title || group.title || 'Група';
    pageSubtitle =
      group.title && group.course_title !== group.title ? group.title : 'Твоє навчальне середовище';

    if (group.weekly_day) summaryMeta.push(`День: ${weeklyDayToLabel(group.weekly_day)}`);
    if (group.start_time) summaryMeta.push(`Час: ${group.start_time.slice(0, 5)}`);
    if (group.duration_minutes) summaryMeta.push(`Тривалість: ${group.duration_minutes} хв`);
    if (group.start_date || group.end_date) {
      summaryMeta.push(
        `Період: ${group.start_date ? formatDate(group.start_date) : '...'} - ${group.end_date ? formatDate(group.end_date) : '...'}`,
      );
    }
    if (group.status) summaryMeta.push(`Статус: ${normalizeStatus(group.status)}`);

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

  // Явно запитане заняття через ?active=<id> — фокусуємо його, навіть якщо до старту ще довго.
  const requestedActiveId = searchParams?.active ? Number(searchParams.active) : null;
  const requestedActive =
    requestedActiveId && Number.isInteger(requestedActiveId)
      ? lessons.find((l) => l.id === requestedActiveId) ?? null
      : null;

  // Автоматичне визначення активного (у вікні [-15хв; +1год])
  const autoActive = lessons.find((l) => isLessonActive(l, now)) ?? null;

  // Пріоритет: явний ?active= → автоматичне вікно
  const activeLesson = requestedActive ?? autoActive;

  // Найближче майбутнє (тільки одне — решту ховаємо згідно ТЗ).
  // Якщо це саме сфокусоване заняття — не дублюємо у секцію "Наступне".
  const upcomingAll = lessons
    .filter((l) => new Date(l.start_datetime).getTime() >= now)
    .sort(
      (a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime(),
    );
  const nextLesson =
    upcomingAll.find((l) => !activeLesson || l.id !== activeLesson.id) ?? null;

  const history = lessons
    .filter((l) => new Date(l.start_datetime).getTime() < now)
    .sort(
      (a, b) => new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime(),
    );

  // Phase C.1: галерея заняття (read-only для учня).
  // Тягнемо counts ОДНИМ запитом по всіх занять (active + next + history),
  // щоб під рядком уроку показати "📷 Галерея (N)" тільки де реально є файли.
  const galleryCounts = await getStudentGalleryCounts(
    session.student_id,
    lessons.map((l) => l.id),
  );

  // Phase D.1: counts ярликів — щоб знати, чи рендерити панель "Швидкий доступ"
  // на активному занятті взагалі. Не показуємо список тут — це робить
  // <LessonShortcuts> у клієнті (lazy fetch).
  const shortcutsCounts = await getStudentShortcutsCounts(
    session.student_id,
    lessons.map((l) => l.id),
  );

  const stats = calcStats(lessons);
  const attendanceRate =
    stats.knownAttendance > 0
      ? Math.round(((stats.present + stats.late) / stats.knownAttendance) * 100)
      : 0;

  // Чи заняття зараз реально триває (для pulse-бейджа та особливого оформлення)
  const lessonLiveNow = activeLesson ? isLessonLive(activeLesson, now) : false;
  // Чи це заняття реально у активному вікні (а не "preview" майбутнього через ?active=).
  // Панель робіт показуємо тільки коли дійсно у вікні — інакше учні бачили б
  // "Вікно закрито" для занять, які ще не починалися.
  const isInActiveWindow = activeLesson ? isLessonActive(activeLesson, now) : false;

  return (
    <>
      <Link href="/dashboard?stay=1" className="student-secondary-btn" style={{ marginBottom: 12 }}>
        ← До моїх груп
      </Link>

      <h1 className="student-page-title">{pageTitle}</h1>
      <p className="student-page-subtitle">{pageSubtitle}</p>

      {/* Active lesson: великий банер з таймером або live-бейджем */}
      {activeLesson && (
        <div
          className={
            'student-card student-active-lesson' +
            (lessonLiveNow ? ' student-active-lesson--live' : '')
          }
        >
          <div className="student-active-lesson__header">
            <div className="student-active-lesson__kicker">
              {lessonLiveNow ? 'Зараз' : isInActiveWindow ? 'Ось-ось почнеться' : 'Заняття'}
            </div>
            <LiveLessonBadge
              startIso={activeLesson.start_datetime}
              endIso={activeLesson.end_datetime}
            />
          </div>
          <div className="student-active-lesson__topic">
            {activeLesson.topic || 'Тему буде оновлено викладачем'}
          </div>
          <div className="student-active-lesson__meta">
            {formatTimeRange(activeLesson.start_datetime, activeLesson.end_datetime)}
          </div>
          {!lessonLiveNow && (
            <div style={{ marginTop: 12 }}>
              <CountdownTimer
                targetIso={activeLesson.start_datetime}
                label="До початку"
                reachedLabel="Заняття почалось"
              />
            </div>
          )}
          {galleryCounts[activeLesson.id] > 0 && (
            <LessonGallery
              lessonId={activeLesson.id}
              count={galleryCounts[activeLesson.id]}
            />
          )}
        </div>
      )}

      {/* Phase D.1: ярлики "Швидкий доступ" від викладача — рендеримо тільки
          для активного заняття. Якщо ярликів нема — компонент сам поверне null. */}
      {activeLesson && shortcutsCounts[activeLesson.id] > 0 && (
        <LessonShortcuts lessonId={activeLesson.id} />
      )}

      {/* Панель робіт прив'язана до активного заняття.
          Upload-вікно = [start; end + 1год] — див. getUploadWindow.
          Коли вікно відкрите — можна додавати/видаляти; інакше read-only.
          Не рендеримо коли заняття ще не у активному вікні (?active= preview майбутнього),
          бо інакше панель показала б "Вікно закрито" задовго до старту. */}
      {activeLesson && isInActiveWindow &&
        (() => {
          const uploadWindow = getUploadWindow(activeLesson, now);
          return (
            <LessonWorksPanel
              lessonId={activeLesson.id}
              uploadWindowOpen={uploadWindow.isOpen}
              uploadWindowClosesAt={uploadWindow.closesAt}
              lessonTitle={activeLesson.topic || 'Активне заняття'}
            />
          );
        })()}

      {summaryMeta.length > 0 && (
        <div className="student-card">
          <div className="student-group-meta-list">
            {summaryMeta.map((item) => (
              <span key={item} className="student-group-meta-chip">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="student-card student-stats-card">
        <div>
          <div className="student-stats-card__label">Загальна присутність</div>
          <div
            className="student-stats-card__value"
            style={{
              color:
                attendanceRate >= 80 ? '#16a34a' : attendanceRate >= 50 ? '#ca8a04' : '#dc2626',
            }}
          >
            {stats.knownAttendance > 0 ? `${attendanceRate}%` : 'Немає даних'}
          </div>
        </div>
        <div className="student-stats-card__grid">
          <div>
            <div className="student-stats-card__small-label">Був(ла)</div>
            <div className="student-stats-card__small-value" style={{ color: '#16a34a' }}>
              {stats.present + stats.late}
            </div>
          </div>
          <div>
            <div className="student-stats-card__small-label">Пропуски</div>
            <div className="student-stats-card__small-value" style={{ color: '#dc2626' }}>
              {stats.absent}
            </div>
          </div>
          <div>
            <div className="student-stats-card__small-label">Поважна</div>
            <div className="student-stats-card__small-value" style={{ color: '#2563eb' }}>
              {stats.excused}
            </div>
          </div>
          <div>
            <div className="student-stats-card__small-label">Відпрацьовано</div>
            <div className="student-stats-card__small-value" style={{ color: '#7c3aed' }}>
              {stats.makeup}
            </div>
          </div>
        </div>
      </div>

      {/* Наступне заняття — тільки ОДНЕ. Решта прихована згідно ТЗ. */}
      <div className="student-section-header">Наступне заняття</div>
      {nextLesson ? (
        <div className="student-dashboard-grid">
          <div className="student-next-lesson-wrap">
            <LessonRow lesson={nextLesson} galleryCount={galleryCounts[nextLesson.id] ?? 0} />
            {!activeLesson && (
              <div className="student-next-lesson-timer">
                <CountdownTimer targetIso={nextLesson.start_datetime} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="student-empty">Найближчих занять немає.</div>
      )}

      <div className="student-section-header">Історія занять ({history.length})</div>
      {history.length === 0 ? (
        <div className="student-empty">Проведених занять ще немає.</div>
      ) : (
        <div className="student-dashboard-grid">
          {history.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              galleryCount={galleryCounts[lesson.id] ?? 0}
            />
          ))}
        </div>
      )}
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

function normalizeStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Активна',
    paused: 'Пауза',
    completed: 'Завершена',
    archived: 'Архів',
  };
  return map[status] || status;
}
