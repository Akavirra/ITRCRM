'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

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

// Extended Telegram WebApp interface
interface TelegramWebAppExtended {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
    };
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
  };
  MainButton: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (callback: () => void) => void;
  };
  showPopup: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: 'default' | 'ok' | 'close' | 'cancel'; text: string }> }) => Promise<string>;
}

export default function LessonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [editingTopic, setEditingTopic] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get Telegram WebApp instance
  const getWebApp = (): TelegramWebAppExtended | null => {
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebAppExtended } }).Telegram?.WebApp;
    return tg || null;
  };

  // Fetch lesson data
  useEffect(() => {
    const fetchLesson = async () => {
      try {
        // Wait for Telegram WebApp to be ready (retry up to 10 times with 300ms delay)
        let tg: TelegramWebAppExtended | null = null;
        let retries = 0;
        const maxRetries = 10;
        
        while (!tg && retries < maxRetries) {
          tg = getWebApp();
          if (!tg) {
            retries++;
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        if (!tg || !tg.initData) {
          setError('Ця сторінка працює тільки в Telegram Mini App');
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/teacher-app/lessons/${lessonId}`, {
          headers: { 'X-Telegram-Init-Data': tg.initData }
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

        // Setup back button
        tg.BackButton.show();
        tg.BackButton.onClick(() => {
          router.push('/teacher-app');
        });

        return () => {
          tg.BackButton.hide();
        };
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Помилка завантаження даних');
        setLoading(false);
      }
    };

    fetchLesson();
  }, [lessonId, router]);

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
    const tg = getWebApp();
    if (!tg) return;

    // Optimistic update
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, attendance_status: status === 'sick' ? 'absent' : status } : s
    ));

    try {
      const response = await fetch(`/api/teacher-app/lessons/${lessonId}/attendance`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': tg.initData 
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
        headers: { 'X-Telegram-Init-Data': tg.initData }
      });
      const data: LessonData = await response.json();
      setStudents(data.students);
    }
  };

  // Save topic/notes
  const saveLessonDetails = async () => {
    const tg = getWebApp();
    if (!tg) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/teacher-app/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': tg.initData 
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
    const tg = getWebApp();
    if (!tg) return;

    // Check if all students have attendance marked
    const unmarkedStudents = students.filter(s => !s.attendance_status);
    if (unmarkedStudents.length > 0) {
      await tg.showPopup({
        title: 'Увага',
        message: `${unmarkedStudents.length} студентів без відмітки. Продовжити?`,
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
          'X-Telegram-Init-Data': tg.initData 
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

      await tg.showPopup({
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
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--tg-text-color)', marginBottom: '16px' }}>
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
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', color: 'var(--tg-hint-color)' }}>
            {formatDate(lesson.lesson_date)}
          </span>
          <span style={{ 
            padding: '4px 10px', 
            borderRadius: '12px', 
            fontSize: '12px',
            background: lesson.status === 'done' ? '#dcfce7' : '#dbeafe',
            color: lesson.status === 'done' ? '#166534' : '#1e40af'
          }}>
            {lesson.status === 'done' ? '✅ Проведено' : '📋 Заплановано'}
          </span>
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
          {formatTime(lesson.start_datetime)} - {formatTime(lesson.end_datetime)}
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--tg-text-color)', marginBottom: '4px' }}>
          {lesson.group_title}
        </p>
        <p style={{ fontSize: '14px', color: 'var(--tg-hint-color)' }}>
          {lesson.course_title}
        </p>
      </div>

      {/* Topic */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>📝 Тема заняття</span>
          {!editingTopic && (
            <button 
              onClick={() => setEditingTopic(true)}
              style={{ fontSize: '12px', color: 'var(--tg-link-color)', background: 'none', border: 'none', cursor: 'pointer' }}
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
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--tg-hint-color)',
                background: 'var(--tg-bg-color)',
                color: 'var(--tg-text-color)',
                fontSize: '14px',
                marginBottom: '8px'
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveLessonDetails} disabled={saving} className="tg-button">
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
          <p style={{ fontSize: '14px', color: topic ? 'var(--tg-text-color)' : 'var(--tg-hint-color)', fontStyle: topic ? 'normal' : 'italic' }}>
            {topic || 'Тема не вказана'}
          </p>
        )}
      </div>

      {/* Notes */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>📋 Нотатка</span>
          {!editingNotes && (
            <button 
              onClick={() => setEditingNotes(true)}
              style={{ fontSize: '12px', color: 'var(--tg-link-color)', background: 'none', border: 'none', cursor: 'pointer' }}
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
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--tg-hint-color)',
                background: 'var(--tg-bg-color)',
                color: 'var(--tg-text-color)',
                fontSize: '14px',
                marginBottom: '8px',
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveLessonDetails} disabled={saving} className="tg-button">
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

      {/* Report info */}
      {lesson.reported_at && (
        <div style={{ 
          background: '#f0fdf4', 
          borderRadius: '8px', 
          padding: '12px', 
          marginBottom: '20px',
          fontSize: '13px',
          color: '#166534'
        }}>
          ✅ Дані збережено: {new Date(lesson.reported_at).toLocaleString('uk-UA')}
          {lesson.reported_via === 'telegram' && ' через Telegram'}
        </div>
      )}

      {/* Students attendance */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          👥 Відвідуваність ({students.length} студентів)
        </h2>
        
        {students.length === 0 ? (
          <p style={{ color: 'var(--tg-hint-color)', fontStyle: 'italic' }}>
            Немає студентів у групі
          </p>
        ) : (
          students.map(student => (
            <div 
              key={student.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.03)',
                marginBottom: '8px'
              }}
            >
              <span style={{ fontSize: '14px' }}>{student.full_name}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => updateAttendance(student.id, 'present')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: student.attendance_status === 'present' ? '#22c55e' : '#e5e7eb',
                    color: student.attendance_status === 'present' ? 'white' : '#374151'
                  }}
                >
                  ✅ Присутній
                </button>
                <button
                  onClick={() => updateAttendance(student.id, 'absent')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: student.attendance_status === 'absent' ? '#ef4444' : '#e5e7eb',
                    color: student.attendance_status === 'absent' ? 'white' : '#374151'
                  }}
                >
                  ❌ Відсутній
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Finish button */}
      {lesson.status !== 'canceled' && (
        <button
          onClick={finishLesson}
          disabled={saving}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--tg-button-color)',
            color: 'var(--tg-button-text-color)',
            fontSize: '15px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1
          }}
        >
          {saving ? '⏳ Збереження...' : '✅ Завершити заняття'}
        </button>
      )}
    </div>
  );
}
