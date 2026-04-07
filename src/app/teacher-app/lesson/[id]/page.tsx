'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTelegramInitData, useTelegramWebApp } from '@/components/TelegramWebAppProvider';
import { formatTimeKyiv, formatDateKyiv, formatDateTimeKyiv } from '@/lib/date-utils';
import { splitFilesIntoUploadBatches, getUploadErrorMessage, prepareImageFilesForUpload } from '@/lib/client-photo-upload';
import {
  CheckCircleIcon, ClipboardIcon, ClockIcon, RefreshIcon, UsersIcon,
  BookOpenIcon, AlertTriangleIcon, FileTextIcon, EditIcon, SaveIcon,
  ArrowLeftIcon, UploadIcon, CameraIcon
} from '@/components/Icons';

interface Lesson {
  id: number;
  public_id: string;
  group_id: number | null;
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
  is_makeup: boolean;
  group_title: string;
  course_title: string;
}

interface Student {
  id: number;
  full_name: string;
  student_public_id: string;
  attendance_status: 'present' | 'absent' | null;
  attendance_updated: string | null;
  original_lesson_id?: number | null;
  original_lesson_date?: string | null;
  original_lesson_topic?: string | null;
  original_group_title?: string | null;
  original_course_title?: string | null;
}

interface LessonData {
  lesson: Lesson;
  students: Student[];
  photoFolder?: {
    id: string;
    name: string;
    url: string;
    exists: boolean;
  } | null;
  photos?: LessonPhoto[];
  canManagePhotos?: boolean;
}

interface LessonPhoto {
  id: number;
  driveFileId: string;
  url: string;
  thumbnailUrl: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  uploadedAt: string;
  uploadedBy: string | null;
  uploadedVia: 'admin' | 'telegram';
}

interface PendingPhotoPreview {
  id: string;
  file: File;
  previewUrl: string;
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
  const [photoFolder, setPhotoFolder] = useState<LessonData['photoFolder']>(null);
  const [photos, setPhotos] = useState<LessonPhoto[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhotoPreview[]>([]);
  const pendingPhotosRef = useRef<PendingPhotoPreview[]>([]);

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
        setPhotoFolder(data.photoFolder || null);
        setPhotos(data.photos || []);
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

  useEffect(() => {
    pendingPhotosRef.current = pendingPhotos;
  }, [pendingPhotos]);

  useEffect(() => {
    return () => {
      pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  // Format time - use proper timezone handling
  const formatTime = (datetime: string): string => {
    return formatTimeKyiv(datetime);
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    return formatDateKyiv(dateStr);
  };

  // Update attendance
  const updateAttendance = async (studentId: number, status: 'present' | 'absent' | 'sick') => {
    if (!initData) return;

    if (isPastLesson) return;

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
      setPhotoFolder(result.photoFolder || null);
      setPhotos(result.photos || []);

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
      setPhotoFolder(result.photoFolder || null);
      setPhotos(result.photos || []);

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

  const handlePhotoSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const nextItems = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingPhotos((prev) => [...prev, ...nextItems]);
    event.target.value = '';
  };

  const removePendingPhoto = (previewId: string) => {
    setPendingPhotos((prev) => {
      const item = prev.find((photo) => photo.id === previewId);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((photo) => photo.id !== previewId);
    });
  };

  const uploadSelectedPhotos = async () => {
    if (!initData || pendingPhotos.length === 0) return;

    setUploadingPhotos(true);

    try {
      const preparedPhotos = await prepareImageFilesForUpload(pendingPhotos.map((photo) => photo.file));
      const batches = splitFilesIntoUploadBatches(preparedPhotos, (file) => file.size);
      let latestResult: { photoFolder?: LessonData['photoFolder']; photos?: LessonPhoto[] } | null = null;

      for (const batch of batches) {
        const formData = new FormData();
        batch.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetch(`/api/teacher-app/lessons/${lessonId}/photos`, {
          method: 'POST',
          headers: {
            'X-Telegram-Init-Data': initData,
          },
          body: formData,
        });

        const errorData = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status === 413) {
            throw new Error('Забагато фото за один пакет. Спробуйте ще раз: система відправить їх меншими частинами.');
          }
          throw new Error(getUploadErrorMessage(errorData, 'Помилка завантаження фото'));
        }

        latestResult = errorData;
      }

      setPhotoFolder(latestResult?.photoFolder || null);
      setPhotos(latestResult?.photos || []);
      pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setPendingPhotos([]);
    } catch (uploadError) {
      console.error('Photo upload error:', uploadError);
      alert(uploadError instanceof Error ? uploadError.message : 'Не вдалося завантажити фото заняття');
    } finally {
      setUploadingPhotos(false);
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
        <button onClick={() => router.push('/teacher-app')} className="tg-button" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}>
          <ArrowLeftIcon size={16} /> Назад
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
            <ArrowLeftIcon size={14} /> До розкладу
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: '14px', color: 'var(--tg-text-secondary)' }}>
              {formatDate(lesson.lesson_date)}
            </span>
            <span className={`tg-badge ${lesson.status === 'done' ? 'tg-badge-done' : 'tg-badge-scheduled'}`}>
              {lesson.status === 'done' ? 'Проведено' : 'Заплановано'}
            </span>
          </div>
        </div>
      </div>

      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: 'var(--space-md)', color: 'var(--tg-text-color)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ClockIcon size={22} /> {formatTime(lesson.start_datetime)} - {formatTime(lesson.end_datetime)}
      </h1>
      {lesson.is_makeup ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
          <span style={{ fontSize: '15px', color: 'var(--tg-text-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshIcon size={16} /> Відпрацювання
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: '15px', color: 'var(--tg-text-color)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UsersIcon size={16} /> {lesson.group_title}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: '13px', color: 'var(--tg-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <BookOpenIcon size={14} /> {lesson.course_title}
            </span>
          </div>
        </div>
      )}

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
          Це заняття з минулого дня. Редагування теми, приміток та відвідуваності недоступне.
        </div>
      )}

      {/* Topic - hidden for makeup lessons */}
      {!lesson.is_makeup && (<div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tg-text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}><FileTextIcon size={16} /> Тема заняття</span>
          {!editingTopic && !isPastLesson && (
            <button 
              onClick={() => setEditingTopic(true)}
              style={{ fontSize: '13px', color: 'var(--tg-link-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              Редагувати
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
                {saving ? 'Збереження...' : 'Зберегти'}
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
      </div>)}

      {/* Notes */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tg-text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}><ClipboardIcon size={16} /> Нотатка</span>
          {!editingNotes && !isPastLesson && (
            <button 
              onClick={() => setEditingNotes(true)}
              style={{ fontSize: '13px', color: 'var(--tg-link-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              Редагувати
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
                {saving ? 'Збереження...' : 'Зберегти'}
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

      {lesson.group_id !== null && (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tg-text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CameraIcon size={16} /> Фото заняття
            </span>
            {photoFolder?.url ? (
              <a
                href={photoFolder.url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '13px', color: 'var(--tg-link-color)', textDecoration: 'none', fontWeight: 500 }}
              >
                Відкрити папку
              </a>
            ) : null}
          </div>

          {!topic.trim() && (
            <div style={{
              marginBottom: 'var(--space-md)',
              padding: 'var(--space-md)',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: 'var(--radius-md)',
              color: '#9a3412',
              fontSize: '13px',
            }}>
              Папка заняття буде створена з тимчасовою назвою <strong>{lesson.lesson_date ? 'Без теми' : 'Без теми'}</strong>, а після збереження теми автоматично перейменується.
            </div>
          )}

          <div style={{
            background: 'var(--tg-primary-bg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--tg-border)',
            padding: 'var(--space-md)',
            marginBottom: 'var(--space-md)',
          }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--tg-link-color)',
                color: 'var(--tg-link-color)',
                cursor: uploadingPhotos ? 'not-allowed' : 'pointer',
                opacity: uploadingPhotos ? 0.6 : 1,
                marginBottom: pendingPhotos.length > 0 ? '12px' : 0,
              }}
            >
              <UploadIcon size={16} />
              <span>{pendingPhotos.length > 0 ? 'Додати ще фото' : 'Вибрати фото'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelection}
                disabled={uploadingPhotos}
                style={{ display: 'none' }}
              />
            </label>

            {pendingPhotos.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  {pendingPhotos.map((photo) => (
                    <div key={photo.id} style={{ position: 'relative' }}>
                      <img
                        src={photo.previewUrl}
                        alt={photo.file.name}
                        style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--tg-border)' }}
                      />
                      <button
                        type="button"
                        onClick={() => removePendingPhoto(photo.id)}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          border: 'none',
                          borderRadius: '999px',
                          width: '22px',
                          height: '22px',
                          background: 'rgba(0,0,0,0.65)',
                          color: 'white',
                          cursor: 'pointer',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={uploadSelectedPhotos}
                  disabled={uploadingPhotos}
                  className="tg-button"
                  style={{ width: '100%', marginTop: '12px' }}
                >
                  {uploadingPhotos ? 'Завантаження фото...' : `Завантажити фото (${pendingPhotos.length})`}
                </button>
              </div>
            )}

            {photos.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                {photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.fileName}
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--tg-border)' }}
                    />
                  </a>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--tg-hint-color)', fontStyle: 'italic' }}>
                Фото ще не завантажені.
              </p>
            )}

            {photos.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--tg-text-secondary)' }}>
                Завантажено: {photos.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Students attendance */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--tg-text-color)' }}>
          Відвідуваність ({students.length})
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
                style={{
                  background: 'var(--tg-surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  border: '1px solid var(--tg-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                {lesson.is_makeup && student.original_lesson_date && (
                  <div style={{
                    marginTop: 'var(--space-sm)',
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'var(--tg-primary-bg)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--tg-link-color)',
                    fontSize: '12px',
                    color: 'var(--tg-text-secondary)',
                  }}>
                    <div style={{ marginBottom: '2px' }}>
                      <strong>Відпрацьовує:</strong> {formatDate(student.original_lesson_date)}
                    </div>
                    {student.original_course_title && (
                      <div style={{ marginBottom: '2px' }}>{student.original_course_title}</div>
                    )}
                    {student.original_lesson_topic ? (
                      <div>{student.original_lesson_topic}</div>
                    ) : (
                      <div style={{ fontStyle: 'italic' }}>Тема не вказана</div>
                    )}
                  </div>
                )}
                {lesson.is_makeup && !student.original_lesson_date && (
                  <div style={{ marginTop: 'var(--space-sm)', fontSize: '12px', color: 'var(--tg-hint-color)', fontStyle: 'italic' }}>
                    Оригінальне заняття не вказано
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report info - shown only after lesson is completed */}
      {lesson.reported_at && (
        <div className="tg-success-message" style={{ marginBottom: 'var(--space-lg)' }}>
          <CheckCircleIcon size={16} /> <strong>Дані збережено:</strong><br/>
          {formatDateTimeKyiv(lesson.reported_at)}
          {lesson.reported_via === 'telegram' && ' через Telegram'}
          {lesson.reported_by_name && <><br/>Викладач: {lesson.reported_by_name}</>}
        </div>
      )}
    </div>
  );
}
