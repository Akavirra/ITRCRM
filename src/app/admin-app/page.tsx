'use client';

import { useEffect, useState } from 'react';
import { useTelegramInitData } from '@/components/TelegramWebAppProvider';
import { formatTimeKyiv, formatDateKyiv } from '@/lib/date-utils';
import { CalendarIcon, UserIcon, UsersIcon, FileTextIcon } from '@/components/Icons';

interface Lesson {
  id: number;
  public_id: string;
  group_id: number | null;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  status: 'scheduled' | 'done' | 'canceled';
  topic: string | null;
  group_title: string | null;
  course_title: string | null;
  teacher_name: string | null;
  student_count: number;
  is_makeup: boolean;
  is_trial: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Заплановано',
  done: 'Проведено',
  canceled: 'Скасовано',
};

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'tg-badge-info',
  done: 'tg-badge-success',
  canceled: 'tg-badge-danger',
};

export default function AdminAppSchedulePage() {
  const { initData, isLoading: initLoading } = useTelegramInitData();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'today' | 'week'>('today');
  const [today, setToday] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const fetchSchedule = async (v: 'today' | 'week', iData: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-app/schedule?view=${v}`, {
        headers: { 'X-Telegram-Init-Data': iData },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Помилка'); return; }
      setLessons(data.lessons || []);
      setToday(data.today || '');
      setWeekStart(data.weekStart || '');
      setWeekEnd(data.weekEnd || '');
      setSelectedDate(data.today || '');
    } catch {
      setError('Не вдалося завантажити розклад');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initLoading && initData) {
      fetchSchedule(view, initData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData, initLoading, view]);

  // Build unique dates for week view day selector
  const weekDates = (() => {
    const dates: string[] = [];
    if (!weekStart) return dates;
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  })();

  const getDayParts = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return { dayName: days[d.getDay()], dateNum: d.getDate() };
  };

  const getDateKey = (d: string) => (d || '').slice(0, 10);

  const displayedLessons = view === 'week'
    ? lessons.filter(l => getDateKey(l.lesson_date) === selectedDate)
    : lessons;

  if (initLoading) {
    return (
      <div className="tg-loading">
        <div className="tg-spinner"></div>
      </div>
    );
  }

  if (!initData && !loading) {
    return (
      <div className="tg-error">
        <div className="tg-error-title">Помилка</div>
        <div className="tg-error-text">Не вдалося отримати дані Telegram. Спробуйте закрити та відкрити додаток.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="tg-loading">
        <div className="tg-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tg-error">
        <div className="tg-error-title">Помилка</div>
        <div className="tg-error-text">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="tg-header">
        <div className="tg-header-title">Розклад</div>
        <div className="tg-header-subtitle">
          {view === 'today' ? `Сьогодні, ${today ? formatDateKyiv(today + 'T00:00:00') : ''}` : 'Тиждень'}
        </div>
      </div>

      {/* View switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className="tg-button"
          onClick={() => setView('today')}
          style={{
            flex: 1,
            padding: '10px',
            fontSize: '13px',
            background: view === 'today' ? 'var(--tg-button-color)' : 'var(--tg-surface)',
            color: view === 'today' ? 'var(--tg-button-text-color)' : 'var(--tg-text-secondary)',
            border: `1.5px solid ${view === 'today' ? 'var(--tg-button-color)' : 'var(--tg-border)'}`,
          }}
        >
          Сьогодні
        </button>
        <button
          className="tg-button"
          onClick={() => { setView('week'); setSelectedDate(today); }}
          style={{
            flex: 1,
            padding: '10px',
            fontSize: '13px',
            background: view === 'week' ? 'var(--tg-button-color)' : 'var(--tg-surface)',
            color: view === 'week' ? 'var(--tg-button-text-color)' : 'var(--tg-text-secondary)',
            border: `1.5px solid ${view === 'week' ? 'var(--tg-button-color)' : 'var(--tg-border)'}`,
          }}
        >
          Тиждень
        </button>
      </div>

      {/* Day selector for week view */}
      {view === 'week' && (
        <div className="tg-day-selector">
          {weekDates.map(date => {
            const { dayName, dateNum } = getDayParts(date);
            const count = lessons.filter(l => getDateKey(l.lesson_date) === date).length;
            return (
              <button
                key={date}
                className={`tg-day-btn ${selectedDate === date ? 'active' : ''}`}
                onClick={() => setSelectedDate(date)}
              >
                <div className="tg-day-name">{dayName}</div>
                <div className="tg-day-num">{dateNum}</div>
                {date === today && <div className="tg-day-dot"></div>}
                {count > 0 && (
                  <div className="tg-day-count">{count}</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Lessons */}
      {displayedLessons.length === 0 ? (
        <div className="tg-empty">
          <div className="tg-empty-icon"><CalendarIcon size={40} /></div>
          <div>Занять немає</div>
        </div>
      ) : (
        displayedLessons.map(lesson => {
          const isIndividual = !lesson.group_id;
          return (
            <div key={lesson.id} className="tg-lesson-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div className="tg-lesson-time">
                  {formatTimeKyiv(lesson.start_datetime)} – {formatTimeKyiv(lesson.end_datetime)}
                </div>
                <span className={`tg-badge ${STATUS_BADGE[lesson.status] || 'tg-badge-info'}`}>
                  {STATUS_LABELS[lesson.status] || lesson.status}
                </span>
              </div>
              <div className="tg-lesson-group">
                {lesson.group_title || lesson.course_title || 'Без назви'}
              </div>
              {/* Lesson type badges */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span className="tg-badge" style={{
                  background: isIndividual ? '#f5f3ff' : 'var(--tg-primary-bg)',
                  color: isIndividual ? '#7c3aed' : 'var(--tg-link-color)',
                  fontSize: '11px',
                }}>
                  {isIndividual ? 'Індивідуальне' : 'Групове'}
                </span>
                {lesson.is_makeup && (
                  <span className="tg-badge tg-badge-warning" style={{ fontSize: '11px' }}>
                    Відпрацювання
                  </span>
                )}
                {lesson.is_trial && (
                  <span className="tg-badge" style={{ background: '#fdf4ff', color: '#a855f7', fontSize: '11px' }}>
                    Пробне
                  </span>
                )}
              </div>
              {lesson.teacher_name && (
                <div className="tg-lesson-course" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <UserIcon size={13} /> {lesson.teacher_name}
                </div>
              )}
              <div className="tg-lesson-course" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <UsersIcon size={13} /> {lesson.student_count} учн.
                {view === 'week' && (
                  <span style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <CalendarIcon size={12} /> {formatDateKyiv(lesson.lesson_date)}
                  </span>
                )}
              </div>
              {lesson.topic && (
                <div className="tg-lesson-topic" style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                  <FileTextIcon size={13} style={{ marginTop: '1px' }} /> {lesson.topic}
                </div>
              )}
            </div>
          );
        }))
      }
    </div>
  );
}
