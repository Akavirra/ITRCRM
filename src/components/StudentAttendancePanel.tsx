'use client';

import { useState, useEffect, useCallback } from 'react';

type AttendanceStatus = 'present' | 'absent' | 'makeup_planned' | 'makeup_done';

interface MonthlyLessonItem {
  lesson_id: number;
  lesson_date: string;
  start_datetime: string | null;
  start_time_kyiv: string | null;
  topic: string | null;
  lesson_status: string;
  attendance_status: AttendanceStatus | null;
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
}

const WEEKDAY_UK = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WEEKDAY_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']; // 0=Sun
const MONTH_UK = ['', 'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getWeekday(dateStr: string): string {
  return WEEKDAY_SHORT[new Date(dateStr).getUTCDay()];
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
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groups, setGroups] = useState<MonthlyGroupAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
  const individualGroup = groups.find(g => g.group_id === null);

  const totalPresent = groups.reduce((s, g) => s + g.present, 0);
  const totalAbsent = groups.reduce((s, g) => s + g.absent, 0);
  const totalLessons = groups.reduce((s, g) => s + g.total, 0);
  const overallRate = totalLessons > 0 ? Math.round((totalPresent / totalLessons) * 100) : 0;

  const lessonTitle = (l: MonthlyLessonItem) =>
    `${getWeekday(l.lesson_date)} ${formatDate(l.lesson_date)}${l.topic ? ' — ' + l.topic : ''} — відкрити заняття`;

  return (
    <div className="card" style={{ marginBottom: '2rem', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

      {/* Header — clickable to expand/collapse */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.125rem 1.5rem', borderBottom: expanded ? '1px solid var(--gray-200)' : 'none', cursor: 'pointer', userSelect: 'none', transition: 'background 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--gray-800)' }}>Відвідуваність</h2>
          {!expanded && !isCurrentMonth && (
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>
              {MONTH_UK[month]} {year}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          {totalLessons > 0 && (
            <>
              <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#dcfce7', color: '#16a34a' }}>✓ {totalPresent}</span>
              <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#fee2e2', color: '#dc2626' }}>✗ {totalAbsent}</span>
              <span style={{
                padding: '2px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700,
                backgroundColor: overallRate >= 80 ? '#16a34a' : overallRate >= 60 ? '#d97706' : '#dc2626',
                color: 'white',
              }}>{overallRate}%</span>
            </>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--gray-400)" strokeWidth="2"
            style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>Завантаження...</div>
      ) : groups.length === 0 ? (
        <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
          <p style={{ margin: '0 0 0.375rem 0', color: '#6b7280', fontSize: '0.9375rem' }}>Занять у цьому місяці немає</p>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.8125rem' }}>Відвідуваність з&apos;явиться після проведення занять</p>
        </div>
      ) : expanded ? (

        /* ── EXPANDED VIEW ── */
        <>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '0.625rem 1.5rem', borderBottom: '1px solid #f3f4f6', backgroundColor: '#fafafa' }}>
            <button onClick={prevMonth} style={{ width: 30, height: 30, border: '1px solid #e5e7eb', borderRadius: '50%', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', flexShrink: 0 }}>‹</button>
            <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827', minWidth: 150, textAlign: 'center' }}>
              {MONTH_UK[month]} {year}
            </span>
            <button onClick={nextMonth} disabled={isCurrentMonth} style={{ width: 30, height: 30, border: '1px solid #e5e7eb', borderRadius: '50%', backgroundColor: 'white', cursor: isCurrentMonth ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isCurrentMonth ? '#d1d5db' : '#374151', opacity: isCurrentMonth ? 0.5 : 1, flexShrink: 0 }}>›</button>
          </div>

          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Group lessons */}
            {groupLessons.length > 0 && (
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                  Групові заняття ({groupLessons.length} {groupLessons.length === 1 ? 'група' : groupLessons.length < 5 ? 'групи' : 'груп'})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {groupLessons.map(g => (
                    <div key={g.group_id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden' }}>
                      {/* Group header */}
                      <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
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
                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                          <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#dcfce7', color: '#16a34a' }}>✓ {g.present}</span>
                          <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#fee2e2', color: '#dc2626' }}>✗ {g.absent}</span>
                          {g.not_marked > 0 && <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f3f4f6', color: '#6b7280' }}>○ {g.not_marked}</span>}
                        </div>
                      </div>
                      {/* Lesson dots */}
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Individual lessons */}
            {individualGroup && individualGroup.lessons.length > 0 && (
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                  Індивідуальні заняття ({individualGroup.lessons.length})
                </div>
                <div style={{ border: '1px solid #e8d5ff', borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: '#fdf8ff' }}>
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
                </div>
              </div>
            )}

          </div>
        </>

      ) : (

        /* ── COMPACT VIEW ── */
        <div style={{ padding: '0.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>

          {/* Group lessons — compact dot rows */}
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
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: g.rate >= 80 ? '#16a34a' : g.rate >= 60 ? '#d97706' : '#dc2626', flexShrink: 0 }}>
                {g.rate}%
              </span>
            </div>
          ))}

          {/* Individual lessons — compact dot row */}
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

        </div>
      )}
    </div>
  );
}
