import Link from 'next/link';
import { Calendar, ChevronRight } from 'lucide-react';
import CountdownTimer from './CountdownTimer';

interface Props {
  title: string;
  datetime: string;
  topic?: string | null;
  startIso: string;
  href?: string | null;
  ctaLabel?: string;
}

/**
 * Hero-картка дашборду: «Наступне заняття».
 *
 * Layout:
 *   - mobile: column (badge → title → datetime → topic → action → timer)
 *   - desktop ≥768: row (content зліва, timer справа без додаткової картки)
 *
 * Цілеспрямовано "повітряно": один tone background, без рамок-у-рамках.
 */
export default function DashboardHero({
  title,
  datetime,
  topic,
  startIso,
  href,
  ctaLabel = 'Перейти до заняття',
}: Props) {
  return (
    <article className="student-dashboard-hero">
      <div className="student-dashboard-hero__main">
        <div className="student-dashboard-hero__badge">
          <Calendar size={14} strokeWidth={1.75} />
          Наступне заняття
        </div>

        <h2 className="student-dashboard-hero__title">{title}</h2>

        <div className="student-dashboard-hero__datetime">{datetime}</div>

        {topic && (
          <div className="student-dashboard-hero__topic">
            Тема: <strong>{topic}</strong>
          </div>
        )}

        {href && (
          <div className="student-dashboard-hero__actions">
            <Link href={href} className="student-primary-btn">
              {ctaLabel}
              <ChevronRight size={16} strokeWidth={1.75} />
            </Link>
          </div>
        )}
      </div>

      <div className="student-dashboard-hero__timer">
        <div className="student-dashboard-hero__timer-label">До початку</div>
        <CountdownTimer targetIso={startIso} large />
      </div>
    </article>
  );
}
