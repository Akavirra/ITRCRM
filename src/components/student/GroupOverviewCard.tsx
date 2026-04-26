/**
 * Картка однієї групи на dashboard'і учня.
 * Показує курс + групу + наступне заняття (якщо є).
 * Серверний компонент (без state).
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { StudentGroupSummary } from '@/lib/student-lesson-context';

interface GroupOverviewCardProps {
  group: StudentGroupSummary;
}

const WEEKDAYS: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Нд',
};

export default function GroupOverviewCard({ group }: GroupOverviewCardProps) {
  const href = group.isIndividual ? '/groups/individual' : `/groups/${group.id}`;

  const primaryTitle = group.course_title || group.title;
  const secondaryTitle =
    group.course_title && group.title && group.course_title !== group.title ? group.title : null;

  const schedulePieces: string[] = [];
  if (group.weekly_day && WEEKDAYS[group.weekly_day]) {
    schedulePieces.push(WEEKDAYS[group.weekly_day]);
  }
  if (group.start_time) {
    schedulePieces.push(group.start_time.slice(0, 5));
  }
  if (group.duration_minutes) {
    schedulePieces.push(`${group.duration_minutes} хв`);
  }

  const nextLessonLine = group.next_lesson
    ? formatNextLesson(group.next_lesson.start_datetime, group.next_lesson.end_datetime)
    : null;

  return (
    <Link href={href} className="student-group-card">
      <div className="student-group-card__title-block">
        <div className="student-group-card__title">{primaryTitle}</div>
        {secondaryTitle && <div className="student-group-card__subtitle">{secondaryTitle}</div>}
      </div>

      {schedulePieces.length > 0 && (
        <div className="student-group-card__schedule">{schedulePieces.join(' · ')}</div>
      )}

      <div className="student-group-card__next">
        {nextLessonLine ? (
          <>
            <span className="student-group-card__next-label">Наступне:</span>{' '}
            <span className="student-group-card__next-value">{nextLessonLine}</span>
          </>
        ) : (
          <span className="student-group-card__next-empty">Найближчих занять немає</span>
        )}
      </div>

      <div className="student-group-card__chev">
        <ChevronRight />
      </div>
    </Link>
  );
}

function formatNextLesson(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateFmt = new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Kyiv',
  });
  const timeFmt = new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  });
  const weekdayFmt = new Intl.DateTimeFormat('uk-UA', {
    weekday: 'short',
    timeZone: 'Europe/Kyiv',
  });
  return `${weekdayFmt.format(start)}, ${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}
