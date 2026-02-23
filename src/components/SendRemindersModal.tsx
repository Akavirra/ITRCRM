'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TodayLesson {
  id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  group_title: string;
  course_title: string;
  teacher_name: string;
  replacement_teacher_name?: string;
}

interface SendRemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SendRemindersModal({ isOpen, onClose, onSuccess }: SendRemindersModalProps) {
  const [lessons, setLessons] = useState<TodayLesson[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: Array<{ lessonId: number; teacherName: string; groupName: string }>;
    skipped: Array<{ lessonId: number; reason: string }>;
  } | null>(null);

  // Fetch today's lessons
  const fetchTodayLessons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lessons?today=true');
      const data = await res.json();
      setLessons(data.lessons || []);
      // Auto-select all by default
      setSelectedIds(new Set((data.lessons || []).map((l: TodayLesson) => l.id)));
    } catch (error) {
      console.error('Failed to fetch today lessons:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTodayLessons();
      setResult(null);
    }
  }, [isOpen, fetchTodayLessons]);

  const handleToggle = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(lessons.map(l => l.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      alert('Оберіть хоча б одне заняття');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/notifications/send-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      setResult(data);
      if (data.sent && data.sent.length > 0 && onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to send reminders:', error);
      alert('Помилка при надсиланні нагадувань');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const formatTime = (datetime: string) => {
    return new Date(datetime).toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (!isOpen) return null;

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            📢 Надіслати нагадування
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '1.5rem',
          flex: 1,
          overflowY: 'auto',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              Завантаження...
            </div>
          ) : result ? (
            <div>
              {result.sent.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ color: '#16a34a', marginBottom: '0.5rem' }}>✅ Надіслано:</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {result.sent.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>
                        {item.groupName} → {item.teacherName}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.skipped.length > 0 && (
                <div>
                  <h3 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>⚠️ Пропущено:</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {result.skipped.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem', color: '#dc2626' }}>
                        ID {item.lessonId}: {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : lessons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              Немає занять на сьогодні
            </div>
          ) : (
            <div>
              {/* Selection controls */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}>
                <button
                  onClick={handleSelectAll}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                >
                  Обрати всі
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                >
                  Зняти всі
                </button>
              </div>

              {/* Lessons list */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}>
                {lessons.map(lesson => (
                  <div
                    key={lesson.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lesson.id)}
                      onChange={() => handleToggle(lesson.id)}
                      style={{
                        marginTop: '0.25rem',
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 600,
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}>
                        {lesson.group_title}
                        {lesson.replacement_teacher_name && (
                          <span style={{
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                          }}>
                            Заміна
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem 1rem',
                      }}>
                        <span>📚 {lesson.course_title}</span>
                        <span>🕐 {formatTime(lesson.start_datetime)} - {formatTime(lesson.end_datetime)}</span>
                        <span>👤 {lesson.replacement_teacher_name || lesson.teacher_name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
        }}>
          <button
            onClick={handleClose}
            className="btn btn-secondary"
          >
            {result ? 'Закрити' : 'Скасувати'}
          </button>
          {!result && (
            <button
              onClick={handleSend}
              disabled={sending || selectedIds.size === 0 || lessons.length === 0}
              className="btn btn-primary"
              style={{
                opacity: sending || selectedIds.size === 0 || lessons.length === 0 ? 0.6 : 1,
              }}
            >
              {sending ? 'Надсилаємо...' : `Надіслати нагадування (${selectedIds.size})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;

  return createPortal(modalContent, document.body);
}
