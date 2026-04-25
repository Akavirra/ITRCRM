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
import GroupOverviewCard from '@/components/student/GroupOverviewCard';
import CountdownTimer from '@/components/student/CountdownTimer';

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

  const ctx = await getStudentLessonContext(session.student_id);

  // Context-Aware redirect: якщо є активне заняття — переходимо на сторінку групи.
  // Учень може обійти через ?stay=1 (напр. для перегляду інших груп).
  if (ctx.activeLesson && ctx.activeGroupKey && searchParams?.stay !== '1') {
    redirect(`/groups/${ctx.activeGroupKey}?active=${ctx.activeLesson.id}`);
  }

  const { groups, overallNext, activeLesson, activeGroupKey } = ctx;

  return (
    <>
      <h1 className="student-page-title">Привіт! 👋</h1>
      <p className="student-page-subtitle">
        {groups.length > 1
          ? `У тебе ${groups.length} ${pluralGroup(groups.length)} — обери, куди зайти`
          : 'Ось твоє навчальне середовище'}
      </p>

      {/* Якщо ми тут попри active — показуємо прозорий банер з поверненням */}
      {activeLesson && activeGroupKey && (
        <Link
          href={`/groups/${activeGroupKey}?active=${activeLesson.id}`}
          className="student-card student-active-banner"
        >
          <div>
            <div className="student-active-banner__kicker">Зараз триває заняття</div>
            <div className="student-active-banner__title">
              {activeLesson.course_title || activeLesson.group_title || 'Заняття'}
            </div>
            {activeLesson.topic && (
              <div className="student-active-banner__topic">Тема: {activeLesson.topic}</div>
            )}
          </div>
          <div className="student-active-banner__cta">Увійти →</div>
        </Link>
      )}

      {/* Наступне заняття (оглядова картка; деталі й таймер — на сторінці групи) */}
      {overallNext ? (
        <div
          className="student-card"
          style={{
            background: 'linear-gradient(135deg, #2160d0 0%, #3b82f6 100%)',
            color: '#fff',
            border: 'none',
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: 0.85,
              marginBottom: 6,
            }}
          >
            Наступне заняття
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {overallNext.course_title || overallNext.group_title || 'Заняття'}
          </div>
          <div style={{ fontSize: 14, opacity: 0.95, marginBottom: 10 }}>
            {formatWhen(overallNext.start_datetime, overallNext.end_datetime)}
          </div>
          <div style={{ marginTop: 6 }}>
            <CountdownTimer targetIso={overallNext.start_datetime} compact />
          </div>
          {overallNext.topic && (
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 10 }}>
              Тема: <strong>{overallNext.topic}</strong>
            </div>
          )}
        </div>
      ) : (
        <div className="student-card">
          <h3>Найближчим часом занять немає</h3>
          <p>Коли з&apos;явиться нове заняття — ми покажемо його тут.</p>
        </div>
      )}

      <div className="student-section-header">Мої групи</div>

      {groups.length === 0 ? (
        <div className="student-empty">Ти ще не доданий(а) до жодної групи.</div>
      ) : (
        <div className="student-groups-grid">
          {groups.map((g) => (
            <GroupOverviewCard key={String(g.id)} group={g} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <Link href="/schedule" className="student-secondary-btn">
          Повний розклад →
        </Link>
      </div>
    </>
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
