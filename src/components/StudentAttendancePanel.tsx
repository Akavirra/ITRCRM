'use client';

import { useState, useEffect, useCallback } from 'react';

type AttendanceStatus = 'present' | 'absent' | 'makeup_planned' | 'makeup_done';

interface MonthlyLessonItem {
  lesson_id: number;
  lesson_date: string;
  start_datetime: string | null;
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
const MONTH_UK = ['', 'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  } catch { return dateStr; }
}

function formatTime(datetimeStr: string | null): string {
  if (!datetimeStr) return '';
  try {
    const d = new Date(datetimeStr);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  } catch { return ''; }
}

function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  if (!status) return (
    <div title="Не відмічено" style={{
      width: 36, height: 36, borderRadius: '50%',
      backgroundColor: '#f3f4f6', border: '2px solid #e5e7eb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1rem', color: '#9ca3af',
    }}>⬜</div>
  );
  const map: Record<AttendanceStatus, { bg: string; border: string; icon: string; title: string; color: string }> = {
    present:       { bg: '#dcfce7', border: '#86efac', icon: '✓', title: 'Присутній', color: '#16a34a' },
    absent:        { bg: '#fee2e2', border: '#fca5a5', icon: '✗', title: 'Відсутній', color: '#dc2626' },
    makeup_planned:{ bg: '#fef3c7', border: '#fcd34d', icon: '↺', title: 'Відпрацювання', color: '#d97706' },
    makeup_done:   { bg: '#dbeafe', border: '#93c5fd', icon: '✓', title: 'Відпрацьовано', color: '#2563eb' },
  };
  const s = map[status];
  return (
    <div title={s.title} style={{
      width: 36, height: 36, borderRadius: '50%',
      backgroundColor: s.bg, border: `2px solid ${s.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.875rem', fontWeight: 700, color: s.color,
    }}>{s.icon}</div>
  );
}

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${rate}%`, height: '100%', backgroundColor: color, borderRadius: 6 }} />
      </div>
      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>{rate}%</span>
    </div>
  );
}

export default function StudentAttendancePanel({ studentId }: { studentId: number }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groups, setGroups] = useState<MonthlyGroupAttendance[]>([]);
  const [loading, setLoading] = useState(false);

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
  const individualLessons = groups.find(g => g.group_id === null);

  const totalPresent = groups.reduce((sum, g) => sum + g.present, 0);
  const totalLessons = groups.reduce((sum, g) => sum + g.total, 0);
  const overallRate = totalLessons > 0 ? Math.round((totalPresent / totalLessons) * 100) : 0;

  return (
    <div className="card" style={{ marginBottom: '2rem', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--gray-200)' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--gray-800)' }}>
          Відвідуваність учня
        </h2>
        {totalLessons > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 28, height: 28, padding: '0 0.625rem',
            backgroundColor: overallRate >= 80 ? '#16a34a' : overallRate >= 60 ? '#d97706' : '#dc2626',
            color: 'white', borderRadius: 14, fontSize: '0.8125rem', fontWeight: 600,
          }}>
            {overallRate}%
          </span>
        )}
      </div>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem 2rem', borderBottom: '1px solid var(--gray-100)', backgroundColor: '#fafafa' }}>
        <button onClick={prevMonth} style={{ width: 32, height: 32, border: '1px solid #e5e7eb', borderRadius: '50%', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#374151' }}>‹</button>
        <span style={{ fontWeight: 600, fontSize: '1rem', color: '#111827', minWidth: 160, textAlign: 'center' }}>
          {MONTH_UK[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          style={{ width: 32, height: 32, border: '1px solid #e5e7eb', borderRadius: '50%', backgroundColor: 'white', cursor: isCurrentMonth ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: isCurrentMonth ? '#d1d5db' : '#374151', opacity: isCurrentMonth ? 0.5 : 1 }}
        >›</button>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>Завантаження...</div>
      ) : groups.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: '#6b7280', fontSize: '0.9375rem' }}>Занять у цьому місяці немає</p>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.8125rem' }}>Відвідуваність з&apos;явиться після проведення занять</p>
        </div>
      ) : (
        <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Group lessons */}
          {groupLessons.map(g => (
            <div key={g.group_id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.875rem', overflow: 'hidden' }}>
              {/* Group header */}
              <div style={{ padding: '0.875rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>{g.group_title}</div>
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {g.course_title && <span>{g.course_title}</span>}
                    {g.weekly_day && g.start_time && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        padding: '1px 6px', backgroundColor: '#eef2ff', borderRadius: 4,
                        fontSize: '0.75rem', fontWeight: 500, color: '#4f46e5',
                      }}>
                        📅 {WEEKDAY_UK[g.weekly_day]} {g.start_time?.slice(0, 5)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, alignItems: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#dcfce7', color: '#16a34a' }}>✓ {g.present}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#fee2e2', color: '#dc2626' }}>✗ {g.absent}</span>
                  {g.not_marked > 0 && <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f3f4f6', color: '#6b7280' }}>⬜ {g.not_marked}</span>}
                </div>
              </div>
              {/* Lesson dots */}
              <div style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                  {g.lessons.map(l => (
                    <div key={l.lesson_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <StatusBadge status={l.attendance_status} />
                      <span style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 500 }}>{formatDate(l.lesson_date)}</span>
                      {l.topic && (
                        <span style={{ fontSize: '0.625rem', color: '#9ca3af', maxWidth: 56, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.topic}>{l.topic}</span>
                      )}
                    </div>
                  ))}
                </div>
                <RateBar rate={g.rate} />
              </div>
            </div>
          ))}

          {/* Individual lessons */}
          {individualLessons && individualLessons.lessons.length > 0 && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.875rem', overflow: 'hidden' }}>
              <div style={{ padding: '0.875rem 1.25rem', backgroundColor: '#fdf8ff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>Індивідуальні заняття</div>
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                    Персональні заняття
                    <span style={{ marginLeft: 8, padding: '1px 6px', backgroundColor: '#f3e8ff', borderRadius: 4, fontSize: '0.75rem', color: '#7c3aed' }}>
                      {individualLessons.lessons.length} {individualLessons.lessons.length === 1 ? 'заняття' : 'занять'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#dcfce7', color: '#16a34a' }}>✓ {individualLessons.present}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#fee2e2', color: '#dc2626' }}>✗ {individualLessons.absent}</span>
                </div>
              </div>
              <div style={{ padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {individualLessons.lessons.map(l => (
                  <div key={l.lesson_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #f9fafb' }}>
                    <StatusBadge status={l.attendance_status} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>{formatDate(l.lesson_date)}</span>
                        {l.start_datetime && (
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{formatTime(l.start_datetime)}</span>
                        )}
                      </div>
                      {l.topic && <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 1 }}>{l.topic}</div>}
                    </div>
                  </div>
                ))}
              </div>
              {individualLessons.total > 0 && (
                <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f3f4f6' }}>
                  <RateBar rate={individualLessons.rate} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
