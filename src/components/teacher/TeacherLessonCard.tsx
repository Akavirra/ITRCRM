/**
 * TeacherLessonCard — server-component для рядка заняття у teacher-портaлі.
 *
 * Розмір/щільність — 'today' (велика, акцентна) або 'compact' (одноряднa).
 * Клік веде на /lessons/[id] — сторінку заняття (E.1.3).
 */

import Link from 'next/link';

interface Lesson {
  id: number;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  status: string | null;
  is_makeup: boolean;
  is_trial: boolean;
  group_title: string | null;
  course_title: string | null;
  is_replacement_for_me: boolean;
}

interface Props {
  lesson: Lesson;
  variant: 'today' | 'compact';
}

const KYIV_TZ = 'Europe/Kyiv';

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KYIV_TZ,
  }).format(new Date(iso));
}

function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

function statusBadge(status: string | null) {
  if (!status) return null;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    scheduled: { label: 'Заплановано', color: '#475569', bg: '#f1f5f9' },
    done: { label: 'Проведено', color: '#047857', bg: '#ecfdf5' },
    cancelled: { label: 'Скасовано', color: '#b91c1c', bg: '#fef2f2' },
    in_progress: { label: 'Триває', color: '#1d4ed8', bg: '#dbeafe' },
  };
  const meta = map[status];
  if (!meta) return null;
  return (
    <span
      style={{
        background: meta.bg,
        color: meta.color,
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
      }}
    >
      {meta.label}
    </span>
  );
}

export default function TeacherLessonCard({ lesson, variant }: Props) {
  const title = lesson.course_title || lesson.group_title || 'Заняття';
  const subtitle =
    lesson.group_title && lesson.course_title && lesson.group_title !== lesson.course_title
      ? lesson.group_title
      : null;

  const badges: React.ReactNode[] = [];
  if (lesson.is_replacement_for_me) {
    badges.push(
      <span key="replacement" className="teacher-lesson-badge teacher-lesson-badge--replacement">
        Заміна
      </span>,
    );
  }
  if (lesson.is_makeup) {
    badges.push(
      <span key="makeup" className="teacher-lesson-badge teacher-lesson-badge--makeup">
        Перенесення
      </span>,
    );
  }
  if (lesson.is_trial) {
    badges.push(
      <span key="trial" className="teacher-lesson-badge teacher-lesson-badge--trial">
        Пробне
      </span>,
    );
  }

  if (variant === 'compact') {
    return (
      <Link href={`/lessons/${lesson.id}`} className="teacher-lesson-row">
        <span className="teacher-lesson-row__time">
          {formatTimeRange(lesson.start_datetime, lesson.end_datetime)}
        </span>
        <span className="teacher-lesson-row__title">
          {title}
          {subtitle && (
            <span className="teacher-lesson-row__subtitle"> · {subtitle}</span>
          )}
        </span>
        <span className="teacher-lesson-row__badges">
          {badges}
          {statusBadge(lesson.status)}
        </span>
      </Link>
    );
  }

  // variant === 'today'
  return (
    <Link href={`/lessons/${lesson.id}`} className="teacher-lesson-card">
      <div className="teacher-lesson-card__head">
        <div className="teacher-lesson-card__time">
          {formatTimeRange(lesson.start_datetime, lesson.end_datetime)}
        </div>
        <div className="teacher-lesson-card__badges">
          {badges}
          {statusBadge(lesson.status)}
        </div>
      </div>
      <div className="teacher-lesson-card__title">{title}</div>
      {subtitle && <div className="teacher-lesson-card__subtitle">{subtitle}</div>}
      <div className="teacher-lesson-card__topic">
        {lesson.topic ? (
          <>
            <strong>Тема:</strong> {lesson.topic}
          </>
        ) : (
          <span className="teacher-lesson-card__topic--empty">
            Тема ще не задана — встанови коли вестимеш
          </span>
        )}
      </div>
    </Link>
  );
}
