'use client';

import { useState, useEffect, useCallback } from 'react';

type AttendanceStatus = 'present' | 'absent' | 'makeup_planned' | 'makeup_done';
type ViewMode = 'monthly' | 'calendar';

interface MonthlyLessonItem {
  lesson_id: number;
  lesson_date: string;
  start_datetime: string | null;
  start_time_kyiv: string | null;
  topic: string | null;
  lesson_status: string;
  attendance_status: AttendanceStatus | null;
  is_makeup: boolean;
  lesson_course_title: string | null;
  lesson_teacher_name: string | null;
  original_lesson_date: string | null;
  original_group_id: number | null;
  original_group_title: string | null;
  original_course_title: string | null;
}

interface MonthlyGroupAttendance {
  group_id: number | null;
  group_title: string | null;
  course_title: string | null;
  weekly_day: number | null;
  start_time: string | null;
  lessons: MonthlyLessonItem[];
  total: number;
  present: number;
  absent: number;
  not_marked: number;
  makeup: number;
  rate: number;
  is_individual: boolean;
  is_makeup_group: boolean;
}

interface AbsenceLesson {
  lesson_id: number;
  lesson_date: string;
  start_datetime: string | null;
  group_id: number | null;
  group_title: string | null;
  course_title: string | null;
  topic: string | null;
  status: AttendanceStatus | null;
}

interface YearlyDayLesson {
  lesson_id: number;
  lesson_date: string;
  start_time_kyiv: string | null;
  group_id: number | null;
  group_title: string | null;
  course_title: string | null;
  attendance_status: AttendanceStatus | null;
  is_makeup: boolean;
  topic: string | null;
}

const WEEKDAY_UK = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WEEKDAY_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']; // 0=Sun
const WEEKDAY_MON_FIRST = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTH_UK = ['', 'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const MONTH_UK_SHORT = ['', 'Січ', 'Лют', 'Бер', 'Квіт', 'Трав', 'Черв',
  'Лип', 'Серп', 'Вер', 'Жовт', 'Лист', 'Груд'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getWeekday(dateStr: string): string {
  return WEEKDAY_SHORT[new Date(dateStr).getUTCDay()];
}

// Returns bg/text colors for a calendar day based on lesson statuses
function getDayStyle(lessons: YearlyDayLesson[]): { bg: string; color: string; border: string } | null {
  if (!lessons.length) return null;
  const statuses = lessons.map(l => l.attendance_status);
  if (statuses.some(s => s === 'absent'))
    return { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' };
  if (statuses.some(s => s === 'makeup_planned'))
    return { bg: '#fef3c7', color: '#d97706', border: '#fcd34d' };
  if (statuses.every(s => s === null))
    return { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
  return { bg: '#dcfce7', color: '#16a34a', border: '#86efac' };
}

function StatusDot({ status, size = 'md', onClick, title }: {
  status: AttendanceStatus | null;
  size?: 'sm' | 'md';
  onClick?: () => void;
  title?: string;
}) {
  const sz = size === 'sm' ? 26 : 32;
  const fs = size === 'sm' ? '0.75rem' : '0.875rem';

  const baseStyle: React.CSSProperties = {
    width: sz, height: sz, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: fs, cursor: onClick ? 'pointer' : 'default',
    transition: 'transform 0.1s, box-shadow 0.1s',
    border: '2px solid transparent',
  };

  const map: Record<AttendanceStatus, { bg: string; border: string; icon: string; label: string; color: string }> = {
    present:        { bg: '#dcfce7', border: '#86efac', icon: '✓', label: 'Присутній',    color: '#16a34a' },
    absent:         { bg: '#fee2e2', border: '#fca5a5', icon: '✗', label: 'Відсутній',    color: '#dc2626' },
    makeup_planned: { bg: '#fef3c7', border: '#fcd34d', icon: '↺', label: 'Відпрацювання', color: '#d97706' },
    makeup_done:    { bg: '#dbeafe', border: '#93c5fd', icon: '✓', label: 'Відпрацьовано', color: '#2563eb' },
  };

  if (!status) {
    return (
      <div
        title={title || 'Не відмічено'}
        onClick={onClick}
        style={{ ...baseStyle, backgroundColor: '#f3f4f6', border: '2px solid #e5e7eb', color: '#9ca3af' }}
        onMouseEnter={onClick ? e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.15)'; } : undefined}
        onMouseLeave={onClick ? e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; } : undefined}
      >○</div>
    );
  }

  const m = map[status];
  return (
    <div
      title={title || m.label}
      onClick={onClick}
      style={{ ...baseStyle, backgroundColor: m.bg, border: `2px solid ${m.border}`, fontWeight: 700, color: m.color }}
      onMouseEnter={onClick ? e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.15)'; } : undefined}
      onMouseLeave={onClick ? e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; } : undefined}
    >{m.icon}</div>
  );
}

function statusLabel(s: AttendanceStatus | null): string {
  if (s === 'present') return '✓ Присутній';
  if (s === 'absent') return '✗ Відсутній';
  if (s === 'makeup_planned') return '↺ Відпрацювання (заплановано)';
  if (s === 'makeup_done') return '✓ Відпрацьовано';
  return '○ Не відмічено';
}

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${rate}%`, height: '100%', backgroundColor: color, borderRadius: 5 }} />
      </div>
      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>{rate}%</span>
    </div>
  );
}

export default function StudentAttendancePanel({
  studentId,
  onOpenLesson,
}: {
  studentId: number;
  onOpenLesson?: (lessonId: number) => void;
}) {
  const now = new Date();

  // Monthly view state
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groups, setGroups] = useState<MonthlyGroupAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [sectionsCollapsed, setSectionsCollapsed] = useState<{ group: boolean; individual: boolean; makeup: boolean }>({ group: false, individual: false, makeup: false });

  // Absences modal state
  const [absencesOpen, setAbsencesOpen] = useState(false);
  const [absencesList, setAbsencesList] = useState<AbsenceLesson[]>([]);
  const [absencesLoading, setAbsencesLoading] = useState(false);

  // Calendar (yearly) view state
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calData, setCalData] = useState<Record<string, YearlyDayLesson[]>>({});
  const [calLoading, setCalLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ dateKey: string; x: number; y: number } | null>(null);

  const toggleSection = (key: 'group' | 'individual' | 'makeup') =>
    setSectionsCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleGroup = (groupId: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Monthly data loader
  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/${studentId}/attendance?view=monthly&year=${y}&month=${m}`);
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(year, month); }, [load, year, month]);

  // Yearly calendar data loader
  const loadCalendar = useCallback(async (y: number) => {
    setCalLoading(true);
    try {
      const res = await fetch(`/api/students/${studentId}/attendance?view=yearly&year=${y}`);
      if (res.ok) {
        const data = await res.json();
        setCalData(data.days || {});
      }
    } finally {
      setCalLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (viewMode === 'calendar' && expanded) {
      loadCalendar(calYear);
    }
  }, [viewMode, calYear, expanded, loadCalendar]);

  // Load all-time absences when modal opens
  useEffect(() => {
    if (!absencesOpen) return;
    setAbsencesLoading(true);
    fetch(`/api/students/${studentId}/attendance?view=absences`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAbsencesList(data.absences || []); })
      .finally(() => setAbsencesLoading(false));
  }, [absencesOpen, studentId]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    const today = new Date();
    if (year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth() + 1)) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const groupLessons = groups.filter(g => g.group_id !== null);
  const individualGroup = groups.find(g => g.is_individual);
  const makeupGroup = groups.find(g => g.is_makeup_group);

  const lessonTitle = (l: MonthlyLessonItem) =>
    `${getWeekday(l.lesson_date)} ${formatDate(l.lesson_date)}${l.topic ? ' — ' + l.topic : ''} — відкрити заняття`;

  const originalLessonLabel = (l: MonthlyLessonItem): string | null => {
    if (!l.original_lesson_date) return null;
    const dateStr = formatDate(l.original_lesson_date);
    const day = getWeekday(l.original_lesson_date);
    const type = l.original_group_id !== null ? (l.original_group_title || 'Групове') : 'Індивідуальне';
    const course = l.original_course_title ? ` · ${l.original_course_title}` : '';
    return `${day} ${dateStr} · ${type}${course}`;
  };

  // Handle click on a calendar day
  const handleDayClick = (dateKey: string) => {
    const lessons = calData[dateKey] || [];
    if (!lessons.length) return;
    if (lessons.length === 1 && onOpenLesson) {
      onOpenLesson(lessons[0].lesson_id);
      return;
    }
    setSelectedDay(prev => prev === dateKey ? null : dateKey);
  };

  // Render a single mini-month in the year calendar
  const renderMiniMonth = (m: number) => {
    const firstDay = new Date(calYear, m - 1, 1);
    const daysInMonth = new Date(calYear, m, 0).getDate();
    // Mon-first offset: getDay() is 0=Sun..6=Sat → convert to Mon=0..Sun=6
    const startOffset = (firstDay.getDay() + 6) % 7;

    const today = now;
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <div key={m} style={{ minWidth: 0 }}>
        {/* Month label */}
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: 6, textAlign: 'center' }}>
          {MONTH_UK_SHORT[m]}
        </div>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 3 }}>
          {WEEKDAY_MON_FIRST.map(wd => (
            <div key={wd} style={{ fontSize: '0.5rem', color: '#d1d5db', textAlign: 'center', fontWeight: 700, paddingBottom: 1 }}>
              {wd[0]}
            </div>
          ))}
        </div>
        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateKey = `${calYear}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const lessons = calData[dateKey] || [];
            const style = getDayStyle(lessons);
            const isToday = dateKey === todayKey;
            const isSelected = selectedDay === dateKey;
            const isSun = (startOffset + day - 1) % 7 === 6; // Mon-first: index 6 = Sunday
            const isSat = (startOffset + day - 1) % 7 === 5;

            return (
              <div
                key={day}
                onClick={() => handleDayClick(dateKey)}
                onMouseEnter={lessons.length ? (e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  setTooltip({ dateKey, x: rect.left + rect.width / 2, y: rect.top });
                } : undefined}
                onMouseLeave={lessons.length ? () => setTooltip(null) : undefined}
                style={{
                  aspectRatio: '1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 4,
                  fontSize: '0.5625rem',
                  fontWeight: style ? 700 : 400,
                  color: style ? style.color : (isSun || isSat) ? '#d1d5db' : '#9ca3af',
                  backgroundColor: isSelected ? '#dbeafe' : style ? style.bg : 'transparent',
                  border: isSelected ? '1.5px solid #93c5fd' : isToday ? '1.5px solid #6366f1' : style ? `1px solid ${style.border}` : 'none',
                  cursor: lessons.length ? 'pointer' : 'default',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                  boxSizing: 'border-box',
                  position: 'relative',
                }}
                onMouseDown={lessons.length ? e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.9)'; } : undefined}
                onMouseUp={lessons.length ? e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; } : undefined}
              >
                {day}
                {/* dot indicator if multiple lessons */}
                {lessons.length > 1 && (
                  <span style={{ position: 'absolute', bottom: 1, right: 1, width: 4, height: 4, borderRadius: '50%', backgroundColor: style?.color || '#6b7280', opacity: 0.7 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Day detail modal */}
      {selectedDay && (() => {
        const lessons = calData[selectedDay] || [];
        if (!lessons.length) return null;
        const [dy, dm, dd] = selectedDay.split('-');
        const dateLabel = `${dd}.${dm}.${dy}`;
        const jsDate = new Date(parseInt(dy), parseInt(dm) - 1, parseInt(dd));
        const weekday = WEEKDAY_MON_FIRST[(jsDate.getDay() + 6) % 7];
        return (
          <div
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', width: 380, maxWidth: 'calc(100vw - 2rem)', overflow: 'hidden' }}
          >
              {/* Modal header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{weekday}, {dateLabel}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                    {lessons.length} {lessons.length === 1 ? 'заняття' : lessons.length < 5 ? 'заняття' : 'занять'}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  style={{ width: 32, height: 32, border: '1px solid #e5e7eb', borderRadius: '50%', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '1.125rem', lineHeight: 1, flexShrink: 0 }}
                >×</button>
              </div>
              {/* Lessons list */}
              {lessons.map((l, i) => {
                const ds = getDayStyle([l]);
                return (
                  <div
                    key={l.lesson_id}
                    onClick={onOpenLesson ? () => onOpenLesson(l.lesson_id) : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.875rem',
                      padding: '0.875rem 1.25rem',
                      borderBottom: i < lessons.length - 1 ? '1px solid #f3f4f6' : 'none',
                      cursor: onOpenLesson ? 'pointer' : 'default',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={onOpenLesson ? e => { e.currentTarget.style.background = '#f9fafb'; } : undefined}
                    onMouseLeave={onOpenLesson ? e => { e.currentTarget.style.background = 'transparent'; } : undefined}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: ds?.bg || '#f3f4f6', border: `1.5px solid ${ds?.border || '#e5e7eb'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700, color: ds?.color || '#6b7280', flexShrink: 0 }}>
                      {l.attendance_status === 'present' ? '✓' : l.attendance_status === 'absent' ? '✗' : l.attendance_status === 'makeup_planned' ? '↺' : l.attendance_status === 'makeup_done' ? '✓' : '○'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {l.is_makeup ? '↺ Відпрацювання' : l.group_title || 'Індивідуальне'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: 2, flexWrap: 'wrap' }}>
                        {l.start_time_kyiv && (
                          <span style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 600 }}>{l.start_time_kyiv}</span>
                        )}
                        {l.course_title && (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{l.course_title}</span>
                        )}
                        {l.topic && (
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {l.topic}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: ds?.color || '#9ca3af', marginTop: 2 }}>{statusLabel(l.attendance_status)}</div>
                    </div>
                    {onOpenLesson && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })()}

      {/* Absences modal */}
      {absencesOpen && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setAbsencesOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Пропуски</div>
                {!absencesLoading && (
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                    {absencesList.length === 0 ? 'немає пропусків' : `${absencesList.length} ${absencesList.length === 1 ? 'пропуск' : absencesList.length < 5 ? 'пропуски' : 'пропусків'} за весь час`}
                  </div>
                )}
              </div>
              <button
                onClick={() => setAbsencesOpen(false)}
                style={{ width: 32, height: 32, border: '1px solid #e5e7eb', borderRadius: '50%', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '1.125rem', lineHeight: 1, flexShrink: 0 }}
              >×</button>
            </div>
            {/* Body */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {absencesLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>Завантаження...</div>
              ) : absencesList.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9375rem' }}>Пропусків не знайдено</div>
              ) : absencesList.map((l, i) => (
                <div
                  key={l.lesson_id}
                  onClick={onOpenLesson ? () => onOpenLesson(l.lesson_id) : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.875rem',
                    padding: '0.875rem 1.25rem',
                    borderBottom: i < absencesList.length - 1 ? '1px solid #f3f4f6' : 'none',
                    cursor: onOpenLesson ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={onOpenLesson ? e => { e.currentTarget.style.background = '#fef2f2'; } : undefined}
                  onMouseLeave={onOpenLesson ? e => { e.currentTarget.style.background = 'transparent'; } : undefined}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#fee2e2', border: '1.5px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>✗</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                        {getWeekday(l.lesson_date)}, {formatDate(l.lesson_date)}
                      </span>
                      {l.start_datetime && (
                        <span style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 600 }}>
                          {new Date(l.start_datetime).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' })}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>
                        {l.group_title || 'Індивідуальне'}
                      </span>
                      {l.course_title && (
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>· {l.course_title}</span>
                      )}
                    </div>
                    {l.topic && (
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.topic}</div>
                    )}
                  </div>
                  {onOpenLesson && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tooltip (fixed, outside card flow) */}
      {tooltip && (() => {
        const lessons = calData[tooltip.dateKey] || [];
        if (!lessons.length) return null;
        const [y, m, d] = tooltip.dateKey.split('-');
        const dateLabel = `${d}.${m}.${y}`;
        return (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y - 10,
              transform: 'translate(-50%, -100%)',
              backgroundColor: '#1f2937',
              color: 'white',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: '0.75rem',
              zIndex: 9999,
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              minWidth: 160,
              maxWidth: 240,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 5, color: '#e5e7eb' }}>{dateLabel} · {lessons.length} {lessons.length === 1 ? 'заняття' : lessons.length < 5 ? 'заняття' : 'занять'}</div>
            {lessons.map(l => (
              <div key={l.lesson_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 3, lineHeight: 1.4 }}>
                <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>
                  {l.start_time_kyiv ? l.start_time_kyiv : '—'}
                </span>
                <span style={{ flex: 1 }}>
                  {l.is_makeup ? '↺ Відпрацювання' : l.group_title || 'Індивідуальне'}
                  {l.course_title ? ` · ${l.course_title}` : ''}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #374151', fontSize: '0.6875rem', color: '#9ca3af' }}>
              {lessons.map(l => statusLabel(l.attendance_status)).join(' · ')}
            </div>
          </div>
        );
      })()}

      <div className="card" style={{ marginBottom: '2rem', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

        {/* Header — clickable to expand/collapse */}
        <div
          onClick={() => setExpanded(e => !e)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.125rem 1.5rem', borderBottom: expanded ? '1px solid var(--gray-200)' : 'none', cursor: 'pointer', userSelect: 'none', transition: 'background 0.15s', borderRadius: expanded ? '1rem 1rem 0 0' : '1rem' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--gray-800)' }}>Відвідуваність</h2>
            {!expanded && viewMode === 'monthly' && !isCurrentMonth && (
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>
                {MONTH_UK[month]} {year}
              </span>
            )}
            {!expanded && viewMode === 'calendar' && (
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>
                Календар {calYear}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
            {/* Absences button */}
            {(() => {
              const totalAbsent = groups.reduce((s, g) => s + g.absent, 0);
              if (totalAbsent === 0) return null;
              return (
                <button
                  onClick={e => { e.stopPropagation(); setAbsencesOpen(true); }}
                  title="Переглянути пропуски"
                  style={{
                    height: 28, paddingLeft: 9, paddingRight: 9,
                    border: '1px solid #fca5a5', borderRadius: 6,
                    backgroundColor: '#fef2f2',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                    color: '#dc2626', flexShrink: 0, transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, lineHeight: 1 }}>{totalAbsent}</span>
                </button>
              );
            })()}
            {/* Calendar / List toggle button */}
            <button
              onClick={e => {
                e.stopPropagation();
                setViewMode(v => v === 'monthly' ? 'calendar' : 'monthly');
                setSelectedDay(null);
                setTooltip(null);
                if (!expanded) setExpanded(true);
              }}
              title={viewMode === 'monthly' ? 'Перейти до календаря року' : 'Перейти до місячного перегляду'}
              style={{
                width: 28, height: 28, border: '1px solid #e5e7eb', borderRadius: 6,
                backgroundColor: viewMode === 'calendar' ? '#eef2ff' : 'white',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: viewMode === 'calendar' ? '#4f46e5' : '#6b7280',
                flexShrink: 0, padding: 0,
              }}
            >
              {viewMode === 'monthly' ? (
                // Calendar grid icon
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              ) : (
                // List icon
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              )}
            </button>

            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--gray-400)" strokeWidth="2"
              style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {expanded && viewMode === 'monthly' && (
          <>
            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '0.625rem 1.5rem', borderBottom: '1px solid #f3f4f6', backgroundColor: '#fafafa' }}>
              <button onClick={e => { e.stopPropagation(); prevMonth(); }} style={{ width: 30, height: 30, border: '1px solid #e5e7eb', borderRadius: '50%', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', flexShrink: 0 }}>‹</button>
              <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827', minWidth: 150, textAlign: 'center' }}>
                {MONTH_UK[month]} {year}
              </span>
              <button onClick={e => { e.stopPropagation(); nextMonth(); }} disabled={isCurrentMonth} style={{ width: 30, height: 30, border: '1px solid #e5e7eb', borderRadius: '50%', backgroundColor: 'white', cursor: isCurrentMonth ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isCurrentMonth ? '#d1d5db' : '#374151', opacity: isCurrentMonth ? 0.5 : 1, flexShrink: 0 }}>›</button>
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>Завантаження...</div>
            ) : groups.length === 0 ? (
              <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.375rem 0', color: '#6b7280', fontSize: '0.9375rem' }}>Занять у цьому місяці немає</p>
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.8125rem' }}>Відвідуваність з&apos;явиться після проведення занять</p>
              </div>
            ) : (
              /* ── EXPANDED MONTHLY VIEW ── */
              <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* ── Group lessons ── */}
                {groupLessons.length > 0 && (
                  <div>
                    <div
                      onClick={() => toggleSection('group')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: sectionsCollapsed.group ? 0 : '0.5rem', cursor: 'pointer', userSelect: 'none', padding: '2px 0' }}
                    >
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Групові заняття ({groupLessons.length} {groupLessons.length === 1 ? 'група' : groupLessons.length < 5 ? 'групи' : 'груп'})
                      </span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5"
                        style={{ transition: 'transform 0.2s', transform: sectionsCollapsed.group ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                    {!sectionsCollapsed.group && <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {groupLessons.map(g => {
                        const isCollapsed = collapsedGroups.has(g.group_id!);
                        return (
                          <div key={g.group_id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden' }}>
                            <div
                              onClick={() => toggleGroup(g.group_id!)}
                              style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderBottom: isCollapsed ? 'none' : '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.group_title}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: 3, flexWrap: 'wrap' }}>
                                  {g.course_title && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{g.course_title}</span>}
                                  {g.weekly_day && g.start_time && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', backgroundColor: '#eef2ff', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, color: '#4f46e5', whiteSpace: 'nowrap' }}>
                                      📅 {WEEKDAY_UK[g.weekly_day]} {g.start_time.slice(0, 5)}
                                    </span>
                                  )}
                                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{g.total} занять</span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexShrink: 0 }}>
                                <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#dcfce7', color: '#16a34a' }}>✓ {g.present}</span>
                                <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#fee2e2', color: '#dc2626' }}>✗ {g.absent}</span>
                                {g.not_marked > 0 && <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f3f4f6', color: '#6b7280' }}>○ {g.not_marked}</span>}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
                                  style={{ marginLeft: 4, transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </div>
                            </div>
                            {!isCollapsed && (
                              <div style={{ padding: '0.875rem 1rem' }}>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                  {g.lessons.map(l => (
                                    <div key={l.lesson_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                      <StatusDot
                                        status={l.attendance_status}
                                        size="sm"
                                        onClick={onOpenLesson ? () => onOpenLesson(l.lesson_id) : undefined}
                                        title={lessonTitle(l)}
                                      />
                                      <span style={{ fontSize: '0.5625rem', color: '#9ca3af', fontWeight: 600, lineHeight: 1.2 }}>{getWeekday(l.lesson_date)}</span>
                                      <span style={{ fontSize: '0.5625rem', color: '#6b7280', fontWeight: 500, lineHeight: 1.2 }}>{formatDate(l.lesson_date)}</span>
                                      {l.topic && (
                                        <span style={{ fontSize: '0.5rem', color: '#9ca3af', maxWidth: 44, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.topic}>{l.topic}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <RateBar rate={g.rate} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>}
                  </div>
                )}

                {/* ── Individual lessons ── */}
                {individualGroup && individualGroup.lessons.length > 0 && (
                  <div>
                    <div
                      onClick={() => toggleSection('individual')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: sectionsCollapsed.individual ? 0 : '0.5rem', cursor: 'pointer', userSelect: 'none', padding: '2px 0' }}
                    >
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Індивідуальні заняття ({individualGroup.lessons.length})
                      </span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5"
                        style={{ transition: 'transform 0.2s', transform: sectionsCollapsed.individual ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                    {!sectionsCollapsed.individual && <div style={{ border: '1px solid #e8d5ff', borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: '#fdf8ff' }}>
                      {individualGroup.lessons.map((l, i) => (
                        <div
                          key={l.lesson_id}
                          onClick={onOpenLesson ? () => onOpenLesson(l.lesson_id) : undefined}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem',
                            borderBottom: i < individualGroup.lessons.length - 1 ? '1px solid #f3e8ff' : 'none',
                            cursor: onOpenLesson ? 'pointer' : 'default',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={onOpenLesson ? e => { e.currentTarget.style.background = '#f3e8ff'; } : undefined}
                          onMouseLeave={onOpenLesson ? e => { e.currentTarget.style.background = 'transparent'; } : undefined}
                        >
                          <StatusDot status={l.attendance_status} size="sm" />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                                {getWeekday(l.lesson_date)}, {formatDate(l.lesson_date)}
                              </span>
                              {l.start_time_kyiv && (
                                <span style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600, padding: '1px 6px', backgroundColor: '#f3e8ff', borderRadius: 4 }}>
                                  {l.start_time_kyiv}
                                </span>
                              )}
                            </div>
                            {(l.lesson_course_title || l.lesson_teacher_name) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: 3, flexWrap: 'wrap' }}>
                                {l.lesson_course_title && (
                                  <span style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 500 }}>{l.lesson_course_title}</span>
                                )}
                                {l.lesson_course_title && l.lesson_teacher_name && (
                                  <span style={{ fontSize: '0.75rem', color: '#d1d5db' }}>·</span>
                                )}
                                {l.lesson_teacher_name && (
                                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{l.lesson_teacher_name}</span>
                                )}
                              </div>
                            )}
                            {l.topic && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{l.topic}</div>}
                          </div>
                          {onOpenLesson && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ flexShrink: 0 }}>
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>}
                  </div>
                )}

                {/* ── Makeup lessons (відпрацювання) ── */}
                {makeupGroup && makeupGroup.lessons.length > 0 && (
                  <div>
                    <div
                      onClick={() => toggleSection('makeup')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: sectionsCollapsed.makeup ? 0 : '0.5rem', cursor: 'pointer', userSelect: 'none', padding: '2px 0' }}
                    >
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Відпрацювання ({makeupGroup.lessons.length})
                      </span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" strokeWidth="2.5"
                        style={{ transition: 'transform 0.2s', transform: sectionsCollapsed.makeup ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                    {!sectionsCollapsed.makeup && <div style={{ border: '1px solid #fde68a', borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: '#fffbeb' }}>
                      {makeupGroup.lessons.map((l, i) => (
                        <div
                          key={l.lesson_id}
                          onClick={onOpenLesson ? () => onOpenLesson(l.lesson_id) : undefined}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem',
                            borderBottom: i < makeupGroup.lessons.length - 1 ? '1px solid #fef3c7' : 'none',
                            cursor: onOpenLesson ? 'pointer' : 'default',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={onOpenLesson ? e => { e.currentTarget.style.background = '#fef3c7'; } : undefined}
                          onMouseLeave={onOpenLesson ? e => { e.currentTarget.style.background = 'transparent'; } : undefined}
                        >
                          <StatusDot status={l.attendance_status} size="sm" />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                                {getWeekday(l.lesson_date)}, {formatDate(l.lesson_date)}
                              </span>
                              {l.start_time_kyiv && (
                                <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600, padding: '1px 6px', backgroundColor: '#fef3c7', borderRadius: 4 }}>
                                  {l.start_time_kyiv}
                                </span>
                              )}
                            </div>
                            {(() => {
                              const orig = originalLessonLabel(l);
                              return orig ? (
                                <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ opacity: 0.6 }}>↩</span>
                                  <span>{orig}</span>
                                </div>
                              ) : null;
                            })()}
                            {l.topic && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{l.topic}</div>}
                          </div>
                          {onOpenLesson && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ flexShrink: 0 }}>
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>}
                  </div>
                )}

              </div>
            )}
          </>
        )}

        {expanded && viewMode === 'calendar' && (
          <>
            {/* Year navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '0.625rem 1.5rem', borderBottom: '1px solid #f3f4f6', backgroundColor: '#fafafa' }}>
              <button onClick={e => { e.stopPropagation(); setCalYear(y => y - 1); setSelectedDay(null); }} style={{ width: 30, height: 30, border: '1px solid #e5e7eb', borderRadius: '50%', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', flexShrink: 0 }}>‹</button>
              <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827', minWidth: 60, textAlign: 'center' }}>{calYear}</span>
              <button onClick={e => { e.stopPropagation(); if (calYear < now.getFullYear()) { setCalYear(y => y + 1); setSelectedDay(null); } }} disabled={calYear >= now.getFullYear()} style={{ width: 30, height: 30, border: '1px solid #e5e7eb', borderRadius: '50%', backgroundColor: 'white', cursor: calYear >= now.getFullYear() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: calYear >= now.getFullYear() ? '#d1d5db' : '#374151', opacity: calYear >= now.getFullYear() ? 0.5 : 1, flexShrink: 0 }}>›</button>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1.5rem', borderBottom: '1px solid #f3f4f6', backgroundColor: '#fafafa', flexWrap: 'wrap' }}>
              {[
                { bg: '#dcfce7', color: '#16a34a', label: 'Присутній' },
                { bg: '#fee2e2', color: '#dc2626', label: 'Пропуск' },
                { bg: '#fef3c7', color: '#d97706', label: 'Відпрацювання' },
                { bg: '#f3f4f6', color: '#6b7280', label: 'Не відмічено' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: item.bg, border: `1px solid ${item.color}`, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{item.label}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: 'transparent', border: '1.5px solid #6366f1', flexShrink: 0 }} />
                <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>Сьогодні</span>
              </div>
            </div>

            {calLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>Завантаження...</div>
            ) : (
              <div style={{ padding: '1.25rem 1.5rem' }}>
                {/* 12-month grid: 4 columns × 3 rows */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem 1rem' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => renderMiniMonth(m))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Compact view (not expanded, monthly mode) */}
        {!expanded && viewMode === 'monthly' && (
          <div style={{ padding: '0.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>

            {groupLessons.map(g => (
              <div key={g.group_id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minHeight: 34 }}>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600, color: '#374151',
                  minWidth: 110, maxWidth: 110,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
                }} title={g.group_title || ''}>{g.group_title}</span>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', flex: 1 }}>
                  {g.lessons.map(l => (
                    <StatusDot
                      key={l.lesson_id}
                      status={l.attendance_status}
                      size="sm"
                      onClick={onOpenLesson ? () => onOpenLesson(l.lesson_id) : undefined}
                      title={lessonTitle(l)}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  {g.absent > 0 && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'white', backgroundColor: '#dc2626', padding: '1px 6px', borderRadius: 99, lineHeight: 1.6 }}>
                      ✗ {g.absent}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {individualGroup && individualGroup.lessons.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minHeight: 34 }}>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed',
                  minWidth: 110, maxWidth: 110, flexShrink: 0,
                }}>Індивідуальні</span>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', flex: 1 }}>
                  {individualGroup.lessons.map(l => (
                    <StatusDot
                      key={l.lesson_id}
                      status={l.attendance_status}
                      size="sm"
                      onClick={onOpenLesson ? () => onOpenLesson(l.lesson_id) : undefined}
                      title={lessonTitle(l)}
                    />
                  ))}
                </div>
              </div>
            )}

            {makeupGroup && makeupGroup.lessons.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minHeight: 34 }}>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600, color: '#d97706',
                  minWidth: 110, maxWidth: 110, flexShrink: 0,
                }}>Відпрацювання</span>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', flex: 1 }}>
                  {makeupGroup.lessons.map(l => {
                    const orig = originalLessonLabel(l);
                    const tip = `${getWeekday(l.lesson_date)} ${formatDate(l.lesson_date)}${orig ? ' ↩ ' + orig : ''} — відкрити`;
                    return (
                      <StatusDot
                        key={l.lesson_id}
                        status={l.attendance_status}
                        size="sm"
                        onClick={onOpenLesson ? () => onOpenLesson(l.lesson_id) : undefined}
                        title={tip}
                      />
                    );
                  })}
                </div>
              </div>
            )}


          </div>
        )}

      </div>
    </>
  );
}
