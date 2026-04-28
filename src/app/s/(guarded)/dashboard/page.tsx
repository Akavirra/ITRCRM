/**
 * Dashboard — головна сторінка учня (Context-Aware).
 *
 * Логіка:
 *   1) Якщо є активне заняття (start-15min ≤ now ≤ end+1год) і немає ?stay=1 —
 *      автоматичний редирект на сторінку групи цього заняття.
 *   2) Інакше — список усіх груп учня (мультигрупи + індивідуальні як окрема картка)
 *      та картка наступного заняття серед усіх груп.
 *
 * Серверний компонент — читає дані напряму з crm_student ролі.
 */

import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  STUDENT_COOKIE_NAME,
  getStudentSession,
} from '@/lib/student-auth';
import { getStudentLessonContext } from '@/lib/student-lesson-context';
import { studentGet } from '@/db/neon-student';
import CountdownTimer from '@/components/student/CountdownTimer';
import DashboardRecentWorks from '@/components/student/DashboardRecentWorks';
import { Calendar, ChevronRight, Users } from 'lucide-react';
import { stripTimePrefix } from '@/components/student/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: { stay?: string };
}

export default async function StudentDashboardPage({ searchParams }: PageProps) {
  const sessionId = cookies().get(STUDENT_COOKIE_NAME)?.value;
  const session = sessionId ? await getStudentSession(sessionId) : null;
  if (!session) {
    return <div className="student-empty">Сесія закінчилась</div>;
  }

  const student = await studentGet<{ full_name: string }>(
    `SELECT full_name FROM students WHERE id = $1`,
    [session.student_id]
  );
  const studentFirstName = student?.full_name?.split(' ')[0] || '';

  const ctx = await getStudentLessonContext(session.student_id);

  // Context-Aware redirect: якщо є активне заняття — переходимо на сторінку групи.
  // Учень може обійти через ?stay=1 (напр. для перегляду інших груп).
  if (ctx.activeLesson && ctx.activeGroupKey && searchParams?.stay !== '1') {
    redirect(`/groups/${ctx.activeGroupKey}?active=${ctx.activeLesson.id}`);
  }

  const { groups, overallNext, activeLesson, activeGroupKey } = ctx;

  // "Раннє вікно входу": дозволяємо учневі відкрити сторінку заняття за 30 хв
  // до старту. Поза цим вікном тільки таймер на дашборді — без кнопки, бо
  // сторінка заняття у нас "context-aware" і без активних матеріалів виглядає
  // порожньою.
  const EARLY_ENTRY_MS = 30 * 60 * 1000;
  const nextStartMs = overallNext ? new Date(overallNext.start_datetime).getTime() : 0;
  const inEarlyEntryWindow = !!overallNext && nextStartMs - Date.now() <= EARLY_ENTRY_MS;

  const nextGroupKey = overallNext
    ? overallNext.group_id
      ? String(overallNext.group_id)
      : 'individual'
    : null;
  const nextLessonHref =
    overallNext && nextGroupKey && inEarlyEntryWindow
      ? `/groups/${nextGroupKey}?active=${overallNext.id}`
      : null;

  return (
    <div className="student-dashboard-grid-layout">
      {/* Left Column: Main Context & Hero */}
      <div className="student-dashboard-main">
        <header className="student-dashboard-header">
          <h1 className="student-page-title">Привіт{studentFirstName ? `, ${studentFirstName}` : ''}! 👋</h1>
          <p className="student-page-subtitle">
            {groups.length > 1
              ? `У тебе ${groups.length} ${pluralGroup(groups.length)} — ось швидкий огляд`
              : 'Ось твоє навчальне середовище'}
          </p>
        </header>

        {/* Якщо ми тут попри active — показуємо прозорий банер з поверненням */}
        {activeLesson && activeGroupKey && (
          <Link
            href={`/groups/${activeGroupKey}?active=${activeLesson.id}`}
            className="student-active-banner"
          >
            <div>
              <div className="student-active-banner__kicker">Зараз триває заняття</div>
              <div className="student-active-banner__title">
                {activeLesson.course_title || stripTimePrefix(activeLesson.group_title) || 'Заняття'}
              </div>
              {activeLesson.topic && (
                <div className="student-active-banner__topic">Тема: {activeLesson.topic}</div>
              )}
            </div>
            <div className="student-active-banner__cta">Увійти →</div>
          </Link>
        )}

        {/* Hero Next Lesson */}
        {overallNext ? (
          <div className="student-dashboard-hero-widget">
            <div className="student-dashboard-hero-widget__content">
              <div className="student-dashboard-hero-widget__badge">
                <Calendar size={14} />
                Наступне заняття
              </div>

              <div className="student-dashboard-hero-widget__title">
                {overallNext.course_title || stripTimePrefix(overallNext.group_title) || 'Заняття'}
              </div>

              <div className="student-dashboard-hero-widget__datetime">
                {formatWhen(overallNext.start_datetime, overallNext.end_datetime)}
              </div>

              {overallNext.topic && (
                <div className="student-dashboard-hero-widget__topic">
                  Тема: <strong>{overallNext.topic}</strong>
                </div>
              )}

              {nextLessonHref && (
                <div className="student-dashboard-hero-widget__actions">
                  <Link href={nextLessonHref} className="student-primary-btn">
                    Перейти до заняття
                    <ChevronRight size={16} />
                  </Link>
                </div>
              )}
            </div>

            <div className="student-dashboard-hero-widget__timer">
              <div className="timer-label">Почнеться через</div>
              <CountdownTimer targetIso={overallNext.start_datetime} />
            </div>
          </div>
        ) : (
          <div className="student-card student-empty-hero">
            <h3>Найближчим часом занять немає</h3>
            <p>Коли з&apos;явиться нове заняття — ми покажемо його тут.</p>
          </div>
        )}
      </div>

      {/* Right Column: Groups & Recent */}
      <aside className="student-dashboard-sidebar">
        <section className="student-dashboard-section">
          <div className="student-section-header">Мої групи</div>
          {groups.length === 0 ? (
            <div className="student-empty">Ти ще не доданий(а) до жодної групи.</div>
          ) : (
            <div className="student-compact-groups-list">
              {groups.map((g) => (
                <CompactGroupItem key={String(g.id)} group={g} highlightNextId={overallNext?.group_id ?? null} />
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/schedule" className="student-secondary-btn" style={{ width: '100%' }}>
              <Calendar size={16} />
              Повний розклад
            </Link>
          </div>
        </section>

        <section className="student-dashboard-section">
          <DashboardRecentWorks />
        </section>
      </aside>
    </div>
  );
}

/* Compact group item for dashboard list */
function CompactGroupItem({
  group,
  highlightNextId,
}: {
  group: { id: number | string; course_title: string | null; title: string; next_lesson: { start_datetime: string; end_datetime: string } | null };
  highlightNextId: number | null;
}) {
  const href = group.id === 'individual' ? '/groups/individual' : `/groups/${group.id}`;
  const title = group.course_title || stripTimePrefix(group.title) || 'Група';
  const isNext = String(highlightNextId) === String(group.id);

  return (
    <Link href={href} className="student-dashboard-group-item">
      <div className="student-dashboard-group-item__icon">
        <Users size={20} />
      </div>
      <div className="student-dashboard-group-item__body">
        <div className="student-dashboard-group-item__title">{title}</div>
        <div className="student-dashboard-group-item__meta">
          {isNext ? (
            <span style={{ color: '#2563EB', fontWeight: 500 }}>Наступне заняття тут</span>
          ) : group.next_lesson ? (
            formatNextLessonShort(group.next_lesson.start_datetime, group.next_lesson.end_datetime)
          ) : (
            'Найближчих занять немає'
          )}
        </div>
      </div>
      <div className="student-dashboard-group-item__arrow">
        <ChevronRight />
      </div>
    </Link>
  );
}

function pluralGroup(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'група';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'групи';
  return 'груп';
}

function formatWhen(startIso: string, endIso: string): string {
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
  return `${dateFmt.format(start)}, ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}

function formatNextLessonShort(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const weekdayFmt = new Intl.DateTimeFormat('uk-UA', { weekday: 'short', timeZone: 'Europe/Kyiv' });
  const dateFmt = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', timeZone: 'Europe/Kyiv' });
  const timeFmt = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
  return `${weekdayFmt.format(start)}, ${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}
