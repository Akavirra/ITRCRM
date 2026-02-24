'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

// Telegram WebApp types
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        close: () => void;
        showAlert: (message: string) => void;
        expand: () => void;
        initData?: string;
      };
    };
  }
}

interface LessonData {
  id: number;
  groupId: number;
  groupTitle: string;
  courseTitle: string;
  teacherId: number;
  teacherName: string;
  startTime: string;
  endTime: string;
  lessonDate: string;
  status: 'scheduled' | 'done' | 'canceled';
  topic: string | null;
  notes: string | null;
  topicSetBy: string | null;
  topicSetAt: string | null;
  notesSetBy: string | null;
  notesSetAt: string | null;
}

interface Student {
  student_id: number;
  student_name: string;
  status: 'present' | 'absent' | null;
}

export default function TelegramLessonPage() {
  const params = useParams();
  const lessonId = parseInt(params.id as string);
  
  console.log('[TelegramLessonPage] params.id:', params.id, 'lessonId:', lessonId);
  
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  
  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
    // Only load data if lessonId is valid
    if (lessonId > 0) {
      loadData();
    }
  }, [lessonId]);
  
  const loadData = async () => {
    // Validate lessonId first
    if (isNaN(lessonId)) {
      setError('Невірний ID заняття: ' + params.id);
      setLoading(false);
      return;
    }
    
    try {
      // Pass Telegram initData for authentication
      const telegramInitData = window.Telegram?.WebApp?.initData || '';
      
      const [lessonRes, studentsRes] = await Promise.all([
        fetch(`/api/telegram/lesson/${lessonId}?initData=${encodeURIComponent(telegramInitData)}`),
        fetch(`/api/telegram/lesson/${lessonId}/attendance?initData=${encodeURIComponent(telegramInitData)}`)
      ]);
      
      if (lessonRes.ok) {
        const data = await lessonRes.json();
        if (data.lesson) {
          setLesson(data.lesson);
          setTopic(data.lesson.topic || '');
          setNotes(data.lesson.notes || '');
        } else {
          setError(data.error || 'Заняття не знайдено' + (data.debug ? ` (ID: ${data.debug.lessonId})` : ''));
        }
      } else {
        // Show full error details
        const data = await lessonRes.json();
        setError(`Status: ${lessonRes.status}, Error: ${JSON.stringify(data)}`);
      }
      
      if (studentsRes.ok) {
        const data = await studentsRes.json();
        setStudents(data.attendance || []);
      }
    } catch (err) {
      setError('Помилка завантаження даних');
    } finally {
      setLoading(false);
    }
  };
  
  const saveData = async () => {
    setSaving(true);
    setError('');
    
    try {
      const telegramInitData = window.Telegram?.WebApp?.initData || '';
      
      const response = await fetch(`/api/telegram/lesson/${lessonId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-telegram-init-data': telegramInitData
        },
        body: JSON.stringify({ topic, notes })
      });
      
      if (response.ok) {
        const data = await response.json();
        setLesson(data.lesson);
        // Notify Telegram that data was saved
        if (window.Telegram && window.Telegram.WebApp) {
          window.Telegram.WebApp.showAlert('✅ Дані збережено!');
        }
      } else {
        setError('Помилка збереження');
      }
    } catch (err) {
      setError('Помилка збереження');
    } finally {
      setSaving(false);
    }
  };
  
  const setAttendance = async (studentId: number, status: 'present' | 'absent') => {
    try {
      const telegramInitData = window.Telegram?.WebApp?.initData || '';
      
      const response = await fetch(`/api/telegram/lesson/${lessonId}/attendance`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-telegram-init-data': telegramInitData
        },
        body: JSON.stringify({ action: 'set', studentId, status })
      });
      
      if (response.ok) {
        setStudents(prev => prev.map(s => 
          s.student_id === studentId ? { ...s, status } : s
        ));
      }
    } catch (err) {
      console.error('Error setting attendance:', err);
    }
  };
  
  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Завантаження...</p>
      </div>
    );
  }
  
  if (!lesson) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <p>Заняття не знайдено</p>
      </div>
    );
  }
  
  return (
    <div style={{ 
      padding: '16px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '100%',
      backgroundColor: '#fff'
    }}>
      <style>{`
        body { margin: 0; padding: 0; }
        .btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; }
        .btn-primary { background: #0088cc; color: white; }
        .btn-success { background: #4CAF50; color: white; }
        .btn-danger { background: #f44336; color: white; }
        .btn-outline { background: transparent; border: 1px solid #ccc; color: #333; }
        .input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
        .textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; min-height: 80px; resize: vertical; box-sizing: border-box; }
        .card { background: #f5f5f5; border-radius: 12px; padding: 12px; margin-bottom: 12px; }
        .student-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee; }
        .student-name { font-size: 14px; }
        .btn-sm { padding: 6px 12px; font-size: 12px; }
      `}</style>
      
      <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#333' }}>
        📚 {lesson.groupTitle}
      </h2>
      
      <div className="card">
        <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>
          <strong>Курс:</strong> {lesson.courseTitle}
        </p>
        <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>
          <strong>Дата:</strong> {lesson.lessonDate}
        </p>
        <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>
          <strong>Час:</strong> {lesson.startTime} - {lesson.endTime}
        </p>
      </div>
      
      <h3 style={{ margin: '16px 0 8px 0', fontSize: '15px', color: '#333' }}>
        📝 Тема заняття
      </h3>
      <input
        className="input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Введіть тему заняття..."
      />
      {lesson.topicSetBy && (
        <p style={{ margin: '4px 0', fontSize: '11px', color: '#888' }}>
          Встановлено: {lesson.topicSetBy} ({lesson.topicSetAt})
        </p>
      )}
      
      <h3 style={{ margin: '16px 0 8px 0', fontSize: '15px', color: '#333' }}>
        📋 Нотатки
      </h3>
      <textarea
        className="textarea"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Введіть нотатки до заняття..."
      />
      {lesson.notesSetBy && (
        <p style={{ margin: '4px 0', fontSize: '11px', color: '#888' }}>
          Встановлено: {lesson.notesSetBy} ({lesson.notesSetAt})
        </p>
      )}
      
      <button 
        className="btn btn-primary" 
        style={{ width: '100%', marginTop: '16px' }}
        onClick={saveData}
        disabled={saving}
      >
        {saving ? 'Збереження...' : '💾 Зберегти'}
      </button>
      
      {error && (
        <p style={{ color: 'red', marginTop: '8px', fontSize: '13px' }}>{error}</p>
      )}
      
      <h3 style={{ margin: '24px 0 8px 0', fontSize: '15px', color: '#333' }}>
        👥 Відвідуваність ({students.filter(s => s.status === 'present').length}/{students.length})
      </h3>
      
      {students.length === 0 ? (
        <p style={{ color: '#888', fontSize: '13px' }}>Немає учнів у групі</p>
      ) : (
        <div className="card">
          {students.map((student) => (
            <div key={student.student_id} className="student-row">
              <span className="student-name">{student.student_name}</span>
              <div>
                <button
                  className={`btn btn-sm ${student.status === 'present' ? 'btn-success' : 'btn-outline'}`}
                  onClick={() => setAttendance(student.student_id, 'present')}
                  style={{ marginRight: '4px' }}
                >
                  ✅
                </button>
                <button
                  className={`btn btn-sm ${student.status === 'absent' ? 'btn-danger' : 'btn-outline'}`}
                  onClick={() => setAttendance(student.student_id, 'absent')}
                >
                  ❌
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
