'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTelegramInitData, useTelegramWebApp } from '@/components/TelegramWebAppProvider';

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
  reported_by: number | null;
  reported_by_name: string | null;
  reported_at: string | null;
  reported_via: string | null;
  group_title: string;
  course_title: string;
}

interface Student {
  id: number;
  full_name: string;
  student_public_id: string;
  attendance_status: 'present' | 'absent' | null;
  attendance_updated: string | null;
}

interface LessonData {
  lesson: Lesson;
  students: Student[];
}

export default function LessonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;
  
  const { initData, isLoading: initLoading, error: initError } = useTelegramInitData();
  const { webApp, isInWebView } = useTelegramWebApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [editingTopic, setEditingTopic] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPastLesson, setIsPastLesson] = useState(false);

  // Check if lesson is from a past day
  useEffect(() => {
    if (lesson?.lesson_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lessonDate = new Date(lesson.lesson_date);
      lessonDate.setHours(0, 0, 0, 0);
      setIsPastLesson(lessonDate < today);
    }
  }, [lesson?.lesson_date]);

  // Fetch lesson data
  useEffect(() => {
    const fetchLesson = async () => {
      // Wait for init data
      if (initLoading) {
        return;
      }

      if (!initData) {
        setError(!isInWebView 
          ? 'Ця сторінка працює тільки в Telegram Mini App' 
          : 'Telegram WebApp не ініціалізовано');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/teacher-app/lessons/${lessonId}`, {
          headers: { 'X-Telegram-Init-Data': initData }
        });

        if (!response.ok) {
          throw new Error('Не вдалося завантажити дані заняття');
        }

        const data: LessonData = await response.json();
        setLesson(data.lesson);
        setStudents(data.students);
        setTopic(data.lesson.topic || '');
        setNotes(data.lesson.notes || '');
        setLoading(false);

        // Setup back button if available
        if (webApp?.BackButton) {
          webApp.BackButton.show();
          webApp.BackButton.onClick(() => {
            router.push('/teacher-app');
          });
        }

        return () => {
          if (webApp?.BackButton) {
            webApp.BackButton.hide();
          }
        };
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Помилка завантаження даних');
        setLoading(false);
      }
    };

    fetchLesson();
  }, [lessonId, router, initData, initLoading, initError, isInWebView, webApp]);

  // Format time
  const formatTime = (datetime: string): string => {
    const date = new Date(datetime);
    return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
  };

  // Update attendance
  const updateAttendance = async (studentId: number, status: 'present' | 'absent' | 'sick') => {
    if (!initData) return;

    // Prevent updating attendance for past lessons
    if (isPastLesson) {
      alert('Неможливо редагувати відвідуваність занять минулих днів.');
      return;
    }

    // Optimistic update
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, attendance_status: status === 'sick' ? 'absent' : status } : s
    ));

    try {
      const response = await fetch(`/api/teacher-app/lessons/${lessonId}/attendance`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData 
        },
        body: JSON.stringify({ studentId, status })
      });

      if (!response.ok) {
        throw new Error('Помилка збереження');
      }

      // Update lesson status if needed
      if (lesson && lesson.status === 'scheduled') {
        setLesson({ ...lesson, status: 'done', reported_at: new Date().toISOString() });
      }
    } catch (err) {
      console.error('Attendance error:', err);
      // Revert on error
      const response = await fetch(`/api/teacher-app/lessons/${lessonId}`, {
        headers: { 'X-Telegram-Init-Data': initData }
      });
      const data: LessonData = await response.json();
      setStudents(data.students);
    }
  };

  // Save topic/notes
  const saveLessonDetails = async () => {
    if (!initData) return;

    // Prevent saving for past lessons
    if (isPastLesson) {
      alert('Неможливо редагувати заняття минулих днів.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/teacher-app/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData 
        },
        body: JSON.stringify({ topic, notes })
      });

      if (!response.ok) {
        throw new Error('Помилка збереження');
      }

      const result = await response.json();
      
      if (lesson) {
        setLesson({ 
          ...lesson, 
          topic,
          notes,
          status: 'done',
          reported_at: result.lesson.reported_at,
          reported_via: 'telegram'
        });
      }

      setEditingTopic(false);
      setEditingNotes(false);
    } catch (err) {
      console.error('Save error:', err);
      alert('Помилка збереження даних');
    } finally {
      setSaving(false);
    }
  };

  // Finish lesson
  const finishLesson = async () => {
    if (!initData || !webApp) return;

    // Prevent finishing past lessons
    if (isPastLesson) {
      alert('Неможливо редагувати заняття минулих днів.');
      return;
    }

    // Check if all students have attendance marked
    const unmarkedStudents = students.filter(s => !s.attendance_status);
    if (unmarkedStudents.length > 0) {
      await webApp.showPopup({
        title: 'Увага',
        message: `${unmarkedStudents.length} студентів без віджки. Продовжити?`,
        buttons: [
          { id: 'cancel', type: 'default', text: 'Повернутися' },
          { id: 'continue', type: 'ok', text: 'Продовжити' }
        ]
      });
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/teacher-app/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData 
        },
        body: JSON.stringify({ topic, notes, status: 'done' })
      });

      if (!response.ok) {
        throw new Error('Помилка збереження');
      }

      const result = await response.json();
      
      if (lesson) {
        setLesson({ 
          ...lesson, 
          topic,
          notes,
          status: 'done',
          reported_at: result.lesson.reported_at,
          reported_via: 'telegram'
        });
      }

      await webApp.showPopup({
        title: 'Готово!',
        message: 'Заняття успішно завершено та збережено.',
        buttons: [{ type: 'ok', text: 'OK' }]
      });

      router.push('/teacher-app');
    } catch (err) {
      console.error('Finish error:', err);
      alert('Помилка завершення заняття');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="tg-loading">
        <div className="tg-spinner"></div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
        <p style={{ color: 'var(--tg-text-color)', marginBottom: 'var(--space-md)', fontSize: '15px' }}>
          {error || 'Заняття не знайдено'}
        </p>
        <button onClick={() => router.push('/teacher-app')} className="tg-button">
          ← Назад
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
        <div>
          <button 
            onClick={() => router.push('/teacher-app')}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              color: 'var(--tg-link-color)',
              fontSize: '14px',
              marginBottom: 'var(--space-sm)'
            }}
          >
            ← До розкладу
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: '14px', color: 'var(--tg-text-secondary)' }}>
              {formatDate(lesson.lesson_date)}
            </span>
            <span className={`tg-badge ${lesson.status === 'done' ? 'tg-badge-done' : 'tg-badge-scheduled'}`}>
              {lesson.status === 'done' ? '✅ Проведено' : '📋 Заплановано'}
            </span>
          </div>
        </div>
      </div>

      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: 'var(--space-md)', color: 'var(--tg-text-color)', letterSpacing: '-0.02em' }}>
        🕐 {formatTime(lesson.start_datetime)} - {formatTime(lesson.end_datetime)}
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: '15px', color: 'var(--tg-text-color)', fontWeight: 500 }}>
            👥 {lesson.group_title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: '13px', color: 'var(--tg-text-secondary)' }}>
            📚 {lesson.course_title}
          </span>
        </div>
      </div>

      {/* Past lesson warning */}
      {isPastLesson && (
        <div style={{ 
          background: '#fff3cd', 
          color: '#856404',
          padding: 'var(--space-md)', 
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-xl)',
          fontSize: '14px',
          border: '1px solid #ffeeba'
        }}>
          ⚠️ Це заняття з минулого дня. Редагування теми, приміток та відвідуваності недоступне.
        </div>
      )}

      {/* Topic */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tg-text-color)' }}>📝 Тема заняття</span>
          {!editingTopic && !isPastLesson && (
            <button 
              onClick={() => setEditingTopic(true)}
              style={{ fontSize: '13px', color: 'var(--tg-link-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              ✏️ Редагувати
            </button>
          )}
        </div>
        {editingTopic ? (
          <div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Введіть тему заняття..."
              className="tg-input"
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
              <button onClick={saveLessonDetails} disabled={saving} className="tg-button" style={{ flex: 1 }}>
                {saving ? 'Збереження...' : '💾 Зберегти'}
              </button>
              <button 
                onClick={() => {
                  setTopic(lesson.topic || '');
                  setEditingTopic(false);
                }}
                className="tg-button tg-button-secondary"
              >
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <div style={{ 
            background: 'var(--tg-primary-bg)', 
            padding: 'var(--space-md)', 
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid var(--tg-link-color)'
          }}>
            <p style={{ fontSize: '14px', color: topic ? 'var(--tg-text-color)' : 'var(--tg-hint-color)', fontStyle: topic ? 'normal' : 'italic' }}>
              {topic || 'Тема не вказана'}
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tg-text-color)' }}>📋 Нотатка</span>
          {!editingNotes && !isPastLesson && (
            <button 
              onClick={() => setEditingNotes(true)}
              style={{ fontSize: '13px', color: 'var(--tg-link-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              ✏️ Редагувати
            </button>
          )}
        </div>
        {editingNotes ? (
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Введіть нотатку..."
              rows={3}
              className="tg-input"
              style={{ resize: 'vertical', minHeight: '100px' }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
              <button onClick={saveLessonDetails} disabled={saving} className="tg-button" style={{ flex: 1 }}>
                {saving ? 'Збереження...' : '💾 Зберегти'}
              </button>
              <button 
                onClick={() => {
                  setNotes(lesson.notes || '');
                  setEditingNotes(false);
                }}
                className="tg-button tg-button-secondary"
              >
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '14px', color: notes ? 'var(--tg-text-color)' : 'var(--tg-hint-color)', fontStyle: notes ? 'normal' : 'italic' }}>
            {notes || 'Нотатка відсутня'}
          </p>
        )}
      </div>

      {/* Students attendance */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--tg-text-color)' }}>
          👥 Відвідуваність ({students.length} студентів)
        </h2>
        
        {students.length === 0 ? (
          <p style={{ color: 'var(--tg-hint-color)', fontStyle: 'italic', fontSize: '14px' }}>
            Немає студентів у групі
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {students.map(student => (
              <div 
                key={student.id}
                className="tg-list-item"
              >
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--tg-text-color)' }}>{student.full_name}</span>
                <div className="tg-actions">
                  <button
                    onClick={() => updateAttendance(student.id, 'present')}
                    className={`tg-action-btn tg-action-btn-success ${student.attendance_status === 'present' ? 'active' : ''}`}
                    title="Присутній"
                    disabled={isPastLesson}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => updateAttendance(student.id, 'absent')}
                    className={`tg-action-btn tg-action-btn-danger ${student.attendance_status === 'absent' ? 'active' : ''}`}
                    title="Відсутній"
                    disabled={isPastLesson}
                  >
                    ✗
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report info - shown only after lesson is completed */}
      {lesson.reported_at && (
        <div className="tg-success-message" style={{ marginBottom: 'var(--space-lg)' }}>
          ✅ <strong>Дані збережено:</strong><br/>
          {new Date(lesson.reported_at).toLocaleString('uk-UA')}
          {lesson.reported_via === 'telegram' && ' через Telegram'}
          {lesson.reported_by_name && <><br/>Викладач: {lesson.reported_by_name}</>}
        </div>
      )}
    </div>
  );
}
