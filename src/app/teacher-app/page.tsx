'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramInitData, useTelegramWebApp } from '@/components/TelegramWebAppProvider';

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

export default function TeacherAppPage() {
  const router = useRouter();
  const { initData, isLoading: initLoading, error: initError, refresh } = useTelegramInitData();
  const { isInWebView, retryCount } = useTelegramWebApp();
  
  const [authChecked, setAuthChecked] = useState(false);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

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
      // Wait for Telegram init data
      if (initLoading) {
        return;
      }

      // Debug info
      let debug = 'Checking Telegram WebApp...\n';
      debug += `User Agent: ${navigator.userAgent.substring(0, 50)}...\n`;
      debug += `URL: ${window.location.href.substring(0, 60)}...\n`;
      debug += `Is Telegram WebView: ${isInWebView}\n`;
      debug += `Retry count: ${retryCount}\n`;
      
      // Check if we have initData
      if (!initData) {
        debug += 'ERROR: No initData available\n';
        debug += `Init error: ${initError || 'unknown'}\n`;
        debug += `window.Telegram exists: ${!!(window as unknown as {Telegram?: unknown}).Telegram}\n`;
        debug += `URL hash: ${window.location.hash?.substring(0, 50)}...\n`;
        setDebugInfo(debug);
        
        if (!isInWebView) {
          setError('Ця сторінка працює тільки в Telegram Mini App');
        } else {
          setError(initError || 'Telegram WebApp не ініціалізовано. Спробуйте оновити сторінку.');
        }
        setLoading(false);
        return;
      }
      
      debug += `initData available, length: ${initData.length}\n`;
      debug += `initData first 100 chars: ${initData.substring(0, 100)}...\n`;
      setDebugInfo(debug);

      // Authenticate
      debug += '\nSending auth request...\n';
      let authResponse;
      try {
        authResponse = await fetch('/api/teacher-app/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: initData })
        });
        debug += `Auth response status: ${authResponse.status}\n`;
      } catch (fetchErr) {
        debug += `Auth fetch error: ${fetchErr}\n`;
        setDebugInfo(debug);
        setError('Помилка мережі при авторизації');
        setLoading(false);
        return;
      }

      if (!authResponse.ok) {
        let errorText = 'Помилка авторизації';
        try {
          const errorData = await authResponse.json();
          errorText = errorData.error || `HTTP ${authResponse.status}: ${authResponse.statusText}`;
          debug += `Auth error: ${JSON.stringify(errorData)}\n`;
        } catch (e) {
          errorText = `HTTP ${authResponse.status}: ${authResponse.statusText}`;
        }
        setDebugInfo(debug);
        setError(errorText);
        setLoading(false);
        return;
      }

      setAuthChecked(true);

      // Fetch schedule
      const scheduleResponse = await fetch('/api/teacher-app/schedule', {
        headers: { 'X-Telegram-Init-Data': initData }
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
    };

    initApp();
  }, [initData, initLoading, initError, isInWebView, retryCount]);

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
        <div style={{ 
          background: '#fef3c7', 
          border: '2px solid #f59e0b', 
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <p style={{ 
            color: '#92400e', 
            fontSize: '18px', 
            fontWeight: 600,
            marginBottom: '12px'
          }}>
            ⚠️ Помилка відкриття
          </p>
          <p style={{ color: '#92400e', marginBottom: '16px' }}>
            {!isInWebView 
              ? 'Ця сторінка працює тільки в Telegram додатку.'
              : 'Telegram WebApp не ініціалізовано. Спробуйте оновити сторінку.'
            }
          </p>
          {!isInWebView && (
            <div style={{ textAlign: 'left', color: '#78350f', fontSize: '14px' }}>
              <p style={{ fontWeight: 600, marginBottom: '8px' }}>Як відкрити кабінет викладача:</p>
              <ol style={{ paddingLeft: '20px', margin: 0 }}>
                <li style={{ marginBottom: '6px' }}>Відкрийте Telegram додаток на телефоні або комп'ютері</li>
                <li style={{ marginBottom: '6px' }}>Знайдіть свій бот (@your_bot)</li>
                <li style={{ marginBottom: '6px' }}>Натисніть кнопку "📋 Кабінет викладача" в меню бота</li>
                <li>Або відкрийте через кнопку в повідомленні про нагадування</li>
              </ol>
              <p style={{ marginTop: '12px', fontSize: '13px', color: '#92400e' }}>
                ❌ Не копіюйте посилання в браузер — воно працює тільки в Telegram!
              </p>
            </div>
          )}
          
          {/* Retry button */}
          <button 
            onClick={() => refresh()}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            🔄 Оновити
          </button>
        </div>
        
        {debugInfo && (
          <details style={{ textAlign: 'left' }}>
            <summary style={{ 
              cursor: 'pointer', 
              color: '#6b7280', 
              fontSize: '13px',
              padding: '10px'
            }}>
              Технічна інформація для діагностики
            </summary>
            <pre style={{ 
              fontSize: '11px', 
              textAlign: 'left', 
              background: '#f3f4f6', 
              padding: '10px', 
              borderRadius: '8px',
              overflow: 'auto',
              maxHeight: '200px'
            }}>
              {debugInfo}
            </pre>
          </details>
        )}
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
