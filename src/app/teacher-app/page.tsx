'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Teacher {
  id: number;
  name: string;
  telegram_id: string;
  role: string;
}

interface Lesson {
  id: number;
  public_id: string;
  group_id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  status: 'scheduled' | 'done' | 'canceled';
  topic: string | null;
  notes: string | null;
  group_title: string;
  course_title: string;
  student_count: number;
  reported_at: string | null;
  reported_via: string | null;
}

interface ScheduleData {
  teacher: Teacher;
  weekStart: string;
  weekEnd: string;
  lessons: Lesson[];
}

// Extended Telegram WebApp interface
interface TelegramWebAppExtended {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
  };
  colorScheme: 'light' | 'dark';
  showPopup: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: 'default' | 'ok' | 'close' | 'cancel'; text: string }> }) => Promise<string>;
}

export default function TeacherAppPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get Telegram WebApp instance
  const getWebApp = (): TelegramWebAppExtended | null => {
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebAppExtended } }).Telegram?.WebApp;
    return tg || null;
  };

  // Get all dates in the current week
  const getWeekDates = (): string[] => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(today);
    start.setDate(diff);
    
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const day = days[date.getDay()];
    const dateNum = date.getDate();
    return `${day}, ${dateNum}`;
  };

  // Check if date is today
  const isToday = (dateStr: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  // Authenticate and fetch schedule
  useEffect(() => {
    const initApp = async () => {
      try {
        const tg = getWebApp();
        
        if (!tg || !tg.initData) {
          setError('Ця сторінка працює тільки в Telegram Mini App');
          setLoading(false);
          return;
        }

        // Authenticate
        const authResponse = await fetch('/api/teacher-app/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData })
        });

        if (!authResponse.ok) {
          const errorData = await authResponse.json();
          setError(errorData.error || 'Помилка авторизації');
          setLoading(false);
          return;
        }

        setAuthChecked(true);

        // Fetch schedule
        const scheduleResponse = await fetch('/api/teacher-app/schedule', {
          headers: { 'X-Telegram-Init-Data': tg.initData }
        });

        if (!scheduleResponse.ok) {
          throw new Error('Не вдалося завантажити розклад');
        }

        const data: ScheduleData = await scheduleResponse.json();
        setTeacher(data.teacher);
        setLessons(data.lessons);
        
        // Set selected date to today or first lesson date
        const today = new Date().toISOString().split('T')[0];
        const hasLessonsToday = data.lessons.some(l => l.lesson_date === today);
        setSelectedDate(hasLessonsToday ? today : data.weekStart);
        
        setLoading(false);
      } catch (err) {
        console.error('Init error:', err);
        setError('Помилка завантаження даних');
        setLoading(false);
      }
    };

    initApp();
  }, []);

  // Filter lessons for selected date
  const dayLessons = lessons.filter(l => l.lesson_date === selectedDate);

  // Format time from datetime
  const formatTime = (datetime: string): string => {
    const date = new Date(datetime);
    return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  // Get status badge class
  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'done':
        return 'tg-badge-done';
      case 'canceled':
        return 'tg-badge-canceled';
      default:
        return 'tg-badge-scheduled';
    }
  };

  // Get status text
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'done':
        return 'Проведено';
      case 'canceled':
        return 'Скасовано';
      default:
        return 'Заплановано';
    }
  };

  if (loading) {
    return (
      <div className="tg-loading">
        <div className="tg-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--tg-text-color)', marginBottom: '16px' }}>
          {error}
        </p>
      </div>
    );
  }

  const weekDates = getWeekDates();

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ 
          fontSize: '20px', 
          fontWeight: 600, 
          marginBottom: '4px',
          color: 'var(--tg-text-color)'
        }}>
          👋 Вітаю, {teacher?.name}
        </h1>
        <p className="tg-hint">Розклад занять на цей тиждень</p>
      </div>

      {/* Day Selector */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        overflowX: 'auto',
        marginBottom: '20px',
        paddingBottom: '8px'
      }}>
        {weekDates.map(date => (
          <button
            key={date}
            onClick={() => setSelectedDate(date)}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: selectedDate === date ? 'var(--tg-button-color)' : 'transparent',
              color: selectedDate === date ? 'var(--tg-button-text-color)' : 'var(--tg-text-color)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              minWidth: '60px',
              textAlign: 'center',
              border: selectedDate === date ? '1px solid var(--tg-button-color)' : '1px solid var(--tg-hint-color)'
            }}
          >
            <div>{formatDate(date)}</div>
            {isToday(date) && (
              <div style={{ fontSize: '10px', opacity: 0.8 }}>Сьогодні</div>
            )}
          </button>
        ))}
      </div>

      {/* Lessons List */}
      <div>
        {dayLessons.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px',
            color: 'var(--tg-hint-color)'
          }}>
            <p>📅 Немає занять на цей день</p>
          </div>
        ) : (
          dayLessons.map(lesson => (
            <div
              key={lesson.id}
              onClick={() => router.push(`/teacher-app/lesson/${lesson.id}`)}
              className="lesson-card"
              style={{
                background: 'var(--tg-bg-color)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
                cursor: 'pointer',
                transition: 'transform 0.1s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.01)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ 
                    fontSize: '18px', 
                    fontWeight: 600,
                    color: 'var(--tg-text-color)'
                  }}>
                    {formatTime(lesson.start_datetime)} - {formatTime(lesson.end_datetime)}
                  </span>
                </div>
                <span className={`tg-badge ${getStatusBadgeClass(lesson.status)}`}>
                  {getStatusText(lesson.status)}
                </span>
              </div>

              <div style={{ marginBottom: '6px' }}>
                <span style={{ 
                  fontSize: '15px', 
                  fontWeight: 500,
                  color: 'var(--tg-text-color)'
                }}>
                  {lesson.group_title}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="tg-hint" style={{ fontSize: '13px' }}>
                  {lesson.course_title}
                </span>
                <span className="tg-hint" style={{ fontSize: '13px' }}>
                  👥 {lesson.student_count} студентів
                </span>
              </div>

              {lesson.topic && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--tg-text-color)' }}>
                  📝 {lesson.topic}
                </div>
              )}

              {lesson.reported_at && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#22c55e' }}>
                  ✅ Звіт від {new Date(lesson.reported_at).toLocaleDateString('uk-UA')}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
