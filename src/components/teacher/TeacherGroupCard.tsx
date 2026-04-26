/**
 * TeacherGroupCard — server-component для рядка групи у списку.
 *
 * Натиск на картку → /groups/[id] (деталі групи).
 */

import Link from 'next/link';

interface Group {
  id: number;
  title: string;
  course_title: string | null;
  weekly_day: number;
  start_time: string;
  duration_minutes: number;
  status: string;
  is_active: boolean;
  active_student_count: number;
}

interface Props {
  group: Group;
}

const DAY_LABELS_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_LABELS = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота'];

function getDayLabel(weeklyDay: number, short = false): string {
  // DB використовує 1-7 (Пн-Нд), JS — 0-6 (Нд-Сб)
  const jsIdx = weeklyDay === 7 ? 0 : weeklyDay;
  return (short ? DAY_LABELS_SHORT : DAY_LABELS)[jsIdx] || '?';
}

function formatHHMM(time: string): string {
  // "14:30:00" → "14:30"
  const [h, m] = time.split(':');
  return `${h}:${m}`;
}

function statusBadge(status: string, isActive: boolean) {
  if (!isActive) {
    return (
      <span
        className="teacher-lesson-badge"
        style={{ background: '#f1f5f9', color: '#64748b' }}
      >
        Архів
      </span>
    );
  }
  if (status === 'graduate') {
    return (
      <span
        className="teacher-lesson-badge"
        style={{ background: '#ecfdf5', color: '#047857' }}
      >
        Випускна
      </span>
    );
  }
  if (status === 'inactive') {
    return (
      <span
        className="teacher-lesson-badge"
        style={{ background: '#fef3c7', color: '#92400e' }}
      >
        На паузі
      </span>
    );
  }
  return null;
}

export default function TeacherGroupCard({ group }: Props) {
  return (
    <Link href={`/groups/${group.id}`} className="teacher-group-card">
      <div className="teacher-group-card__head">
        <div className="teacher-group-card__title">
          {group.course_title || 'Курс'}
        </div>
        {statusBadge(group.status, group.is_active)}
      </div>
      <div className="teacher-group-card__subtitle">{group.title}</div>
      <div className="teacher-group-card__meta">
        <span className="teacher-group-card__schedule">
          {getDayLabel(group.weekly_day)} · {formatHHMM(group.start_time)} (
          {group.duration_minutes} хв)
        </span>
        <span className="teacher-group-card__students">
          👥 {group.active_student_count}
        </span>
      </div>
    </Link>
  );
}
