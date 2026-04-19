/**
 * Один рядок уроку в списку розкладу / dashboard.
 * Серверний-сумісний компонент (без useState/useEffect).
 */

interface LessonRowProps {
  lesson: {
    id: number;
    start_datetime: string;
    end_datetime: string;
    topic: string | null;
    status: string | null;
    is_makeup: boolean | null;
    is_trial: boolean | null;
    group_title: string | null;
    course_title: string | null;
    attendance_status: string | null;
  };
}

const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

export default function LessonRow({ lesson }: LessonRowProps) {
  const start = new Date(lesson.start_datetime);
  const end = new Date(lesson.end_datetime);

  // Дата у Kyiv-часі (uk-UA Intl підтримує timezone option)
  const day = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', timeZone: 'Europe/Kyiv' }).format(start);
  const monthIdx = Number(new Intl.DateTimeFormat('uk-UA', { month: 'numeric', timeZone: 'Europe/Kyiv' }).format(start)) - 1;
  const month = MONTHS_SHORT[monthIdx] || '';

  const timeFmt = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
  const weekdayFmt = new Intl.DateTimeFormat('uk-UA', { weekday: 'short', timeZone: 'Europe/Kyiv' });

  const attBadge = attendanceBadge(lesson.attendance_status);

  return (
    <div className="student-card">
      <div className="student-lesson-row">
        <div className="student-lesson-date">
          <span className="day">{day}</span>
          {month}
          <div style={{ fontSize: 10, marginTop: 2, opacity: 0.75 }}>{weekdayFmt.format(start)}</div>
        </div>
        <div className="student-lesson-main">
          <div className="title">{lesson.course_title || lesson.group_title || 'Заняття'}</div>
          <div className="meta">
            {timeFmt.format(start)} – {timeFmt.format(end)}
            {lesson.group_title && lesson.course_title ? ` • ${lesson.group_title}` : ''}
          </div>
          {lesson.topic && (
            <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>
              {lesson.topic}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {lesson.is_makeup && <span className="student-badge student-badge--makeup">Перенесення</span>}
            {lesson.is_trial && <span className="student-badge student-badge--trial">Пробне</span>}
            {lesson.status === 'done' && <span className="student-badge student-badge--done">Проведено</span>}
            {attBadge}
          </div>
        </div>
      </div>
    </div>
  );
}

function attendanceBadge(status: string | null) {
  if (!status) return null;
  const map: Record<string, { cls: string; label: string }> = {
    present: { cls: 'student-badge--present', label: 'Був' },
    absent: { cls: 'student-badge--absent', label: 'Пропуск' },
    late: { cls: 'student-badge--late', label: 'Запізнився' },
    excused: { cls: 'student-badge--late', label: 'Поважна причина' },
  };
  const found = map[status];
  if (!found) return null;
  return <span className={`student-badge ${found.cls}`}>{found.label}</span>;
}
