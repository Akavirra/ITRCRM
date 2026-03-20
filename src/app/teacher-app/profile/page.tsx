'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTelegramInitData } from '@/components/TelegramWebAppProvider';

interface Teacher {
  id: number;
  name: string;
  telegram_id: string;
  role: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  created_at: string;
}

interface ProfileData {
  teacher: Teacher;
  stats: {
    total_groups: number;
    total_students: number;
    total_lessons: number;
  };
}

interface LessonStat {
  lesson_id: number;
  lesson_date: string;
  group_title: string | null;
  is_individual: boolean;
  is_replacement: boolean;
  present_count: number;
  rate: number;
  salary: number;
}

interface MonthStats {
  year: number;
  month: number;
  lessons_count: number;
  students_count: number;
  salary: number;
  lessons_total: number;
  extras_total: number;
  extra_items: Array<{ id: number; description: string; amount: number }>;
  salary_group_rate: number;
  salary_individual_rate: number;
  lessons: LessonStat[];
}

const MONTH_NAMES = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

const MONTH_NAMES_GENITIVE = [
  'Січня', 'Лютого', 'Березня', 'Квітня', 'Травня', 'Червня',
  'Липня', 'Серпня', 'Вересня', 'Жовтня', 'Листопада', 'Грудня',
];

function formatMoney(amount: number): string {
  return `₴${Math.round(amount).toLocaleString('uk-UA')}`;
}

function formatLessonDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

function getRoleDisplay(role: string): string {
  switch (role) {
    case 'admin': return 'Адміністратор';
    case 'teacher': return 'Викладач';
    case 'manager': return 'Менеджер';
    default: return role;
  }
}

export default function TeacherProfilePage() {
  const router = useRouter();
  const { initData, isLoading: initLoading } = useTelegramInitData();

  // Profile state
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Photo state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Monthly stats state
  const now = new Date();
  const [statsYear, setStatsYear] = useState(now.getFullYear());
  const [statsMonth, setStatsMonth] = useState(now.getMonth() + 1);
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showLessons, setShowLessons] = useState(false);

  // Fetch teacher profile
  useEffect(() => {
    if (initLoading) return;
    if (!initData) {
      setError('Telegram WebApp не ініціалізовано');
      setLoading(false);
      return;
    }

    fetch('/api/teacher-app/groups', {
      headers: { 'X-Telegram-Init-Data': initData },
    })
      .then(r => (r.ok ? r.json() : Promise.reject('Не вдалося завантажити профіль')))
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [initData, initLoading]);

  // Fetch monthly stats whenever month/year or initData changes
  useEffect(() => {
    if (initLoading) return;
    if (!initData) {
      setStatsLoading(false);
      return;
    }

    setStatsLoading(true);
    setShowLessons(false);

    fetch(`/api/teacher-app/stats?year=${statsYear}&month=${statsMonth}`, {
      headers: { 'X-Telegram-Init-Data': initData },
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setMonthStats)
      .catch(() => setMonthStats(null))
      .finally(() => setStatsLoading(false));
  }, [initData, initLoading, statsYear, statsMonth]);

  // Resize image client-side before uploading (max 800×800, JPEG 85%)
  const resizeImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = url;
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !initData) return;
    setPhotoMenu(false);
    setPhotoLoading(true);
    try {
      const base64 = await resizeImage(file);
      const res = await fetch('/api/teacher-app/profile/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData },
        body: JSON.stringify({ photo: base64 }),
      });
      if (!res.ok) throw new Error();
      const { photo_url } = await res.json();
      setData(prev => prev ? { ...prev, teacher: { ...prev.teacher, photo_url } } : prev);
    } catch {
      // upload failed silently — no change to UI
    } finally {
      setPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!initData) return;
    setConfirmDelete(false);
    setPhotoMenu(false);
    setPhotoLoading(true);
    try {
      await fetch('/api/teacher-app/profile/photo', {
        method: 'DELETE',
        headers: { 'X-Telegram-Init-Data': initData },
      });
      setData(prev => prev ? { ...prev, teacher: { ...prev.teacher, photo_url: null } } : prev);
    } finally {
      setPhotoLoading(false);
    }
  };

  const isCurrentMonth = statsYear === now.getFullYear() && statsMonth === now.getMonth() + 1;

  const goToPrevMonth = () => {
    if (statsMonth === 1) {
      setStatsYear(y => y - 1);
      setStatsMonth(12);
    } else {
      setStatsMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (isCurrentMonth) return;
    if (statsMonth === 12) {
      setStatsYear(y => y + 1);
      setStatsMonth(1);
    } else {
      setStatsMonth(m => m + 1);
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
      <div style={{ padding: '20px' }}>
        <div className="tg-error">
          <p className="tg-error-title">⚠️ Помилка</p>
          <p className="tg-error-text">{error}</p>
        </div>
      </div>
    );
  }

  const teacher = data?.teacher;

  return (
    <div>
      {/* Header */}
      <div className="tg-header">
        <h1 className="tg-header-title">👤 Профіль</h1>
        <p className="tg-header-subtitle">Інформація про викладача</p>
      </div>

      {/* Profile Card */}
      <div className="tg-card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
        {/* Avatar with edit button */}
        <div style={{ position: 'relative', width: '100px', margin: '0 auto var(--space-lg)' }}>
          {teacher?.photo_url ? (
            <img
              src={teacher.photo_url}
              alt={teacher.name}
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                objectFit: 'cover',
                display: 'block',
                border: '3px solid var(--tg-border)',
                boxShadow: 'var(--shadow-md)',
              }}
            />
          ) : (
            <div
              className="tg-avatar"
              style={{
                width: '100px',
                height: '100px',
                fontSize: '36px',
                background: 'linear-gradient(135deg, var(--tg-primary-bg), var(--tg-link-color))',
              }}
            >
              {teacher?.name?.split(' ').map(n => n[0]).join('') || '?'}
            </div>
          )}

          {/* Camera edit button */}
          <button
            onClick={() => { setPhotoMenu(v => !v); setConfirmDelete(false); }}
            disabled={photoLoading}
            title="Змінити фото"
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--tg-button-color)',
              color: 'var(--tg-button-text-color)',
              border: '2.5px solid var(--tg-surface)',
              cursor: photoLoading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              boxShadow: 'var(--shadow-md)',
              opacity: photoLoading ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {photoLoading ? '⏳' : '📷'}
          </button>
        </div>

        {/* Photo action menu */}
        {photoMenu && !confirmDelete && (
          <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => { setPhotoMenu(false); fileInputRef.current?.click(); }}
              style={{
                background: 'var(--tg-primary-bg)',
                border: '1px solid var(--tg-link-color)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 16px',
                cursor: 'pointer',
                color: 'var(--tg-link-color)',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              📤 {teacher?.photo_url ? 'Замінити фото' : 'Завантажити фото'}
            </button>
            {teacher?.photo_url && (
              <button
                onClick={() => { setPhotoMenu(false); setConfirmDelete(true); }}
                style={{
                  background: 'var(--tg-danger-bg)',
                  border: '1px solid var(--tg-danger)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--tg-danger)',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                🗑️ Видалити фото
              </button>
            )}
            <button
              onClick={() => setPhotoMenu(false)}
              style={{
                background: 'transparent',
                border: '1px solid var(--tg-border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
                cursor: 'pointer',
                color: 'var(--tg-text-secondary)',
                fontSize: '13px',
              }}
            >
              Скасувати
            </button>
          </div>
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <div style={{
            marginBottom: '16px',
            background: 'var(--tg-danger-bg)',
            border: '1px solid var(--tg-danger)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
          }}>
            <p style={{ fontSize: '14px', color: 'var(--tg-danger)', marginBottom: '12px', fontWeight: 500 }}>
              Видалити фото профілю?
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDeletePhoto}
                style={{
                  flex: 1,
                  background: 'var(--tg-danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Видалити
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: 'var(--tg-text-secondary)',
                  border: '1px solid var(--tg-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Скасувати
              </button>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--tg-text-color)' }}>
          {teacher?.name || 'Невідомо'}
        </h2>

        <span className="tg-badge tg-badge-scheduled" style={{ marginBottom: '16px', display: 'inline-block' }}>
          {getRoleDisplay(teacher?.role || 'teacher')}
        </span>

        {/* All-time stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginTop: 'var(--space-lg)',
          paddingTop: 'var(--space-lg)',
          borderTop: '1px solid var(--tg-border)',
        }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--tg-link-color)' }}>
              {data?.stats.total_groups || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)' }}>Груп</div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--tg-link-color)' }}>
              {data?.stats.total_students || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)' }}>Учнів</div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--tg-link-color)' }}>
              {data?.stats.total_lessons || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)' }}>Занять</div>
          </div>
        </div>
      </div>

      {/* ── Monthly Stats Section ── */}
      <div className="tg-section">
        <h3 className="tg-section-title">📊 Статистика місяця</h3>

        {/* Month Navigator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--tg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--tg-border)',
          padding: '10px 12px',
          marginBottom: 'var(--space-md)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <button
            onClick={goToPrevMonth}
            style={{
              background: 'var(--tg-primary-bg)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--tg-link-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ‹
          </button>

          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--tg-text-color)' }}>
              {MONTH_NAMES[statsMonth - 1]} {statsYear}
            </div>
            {isCurrentMonth && (
              <div style={{ fontSize: '11px', color: 'var(--tg-success)', fontWeight: 500, marginTop: '2px' }}>
                Поточний місяць
              </div>
            )}
          </div>

          <button
            onClick={goToNextMonth}
            disabled={isCurrentMonth}
            style={{
              background: isCurrentMonth ? 'transparent' : 'var(--tg-primary-bg)',
              border: 'none',
              cursor: isCurrentMonth ? 'default' : 'pointer',
              fontSize: '18px',
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              color: isCurrentMonth ? 'var(--tg-border)' : 'var(--tg-link-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              opacity: isCurrentMonth ? 0.4 : 1,
            }}
          >
            ›
          </button>
        </div>

        {/* Stats Cards or Loading */}
        {statsLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
            <div className="tg-spinner" style={{ margin: '0 auto' }}></div>
          </div>
        ) : (
          <>
            {/* 3 Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: 'var(--space-md)' }}>

              {/* Lessons */}
              <div style={{
                background: 'var(--tg-surface)',
                border: '1px solid var(--tg-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 8px',
                textAlign: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ fontSize: '26px', marginBottom: '6px' }}>📚</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--tg-link-color)', lineHeight: 1 }}>
                  {monthStats?.lessons_count ?? 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--tg-text-secondary)', marginTop: '5px', fontWeight: 500 }}>
                  Занять
                </div>
              </div>

              {/* Students */}
              <div style={{
                background: 'var(--tg-surface)',
                border: '1px solid var(--tg-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 8px',
                textAlign: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ fontSize: '26px', marginBottom: '6px' }}>👤</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--tg-link-color)', lineHeight: 1 }}>
                  {monthStats?.students_count ?? 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--tg-text-secondary)', marginTop: '5px', fontWeight: 500 }}>
                  Учнів
                </div>
              </div>

              {/* Salary — highlighted */}
              <div style={{
                background: 'linear-gradient(145deg, var(--tg-success-bg), var(--tg-surface))',
                border: '1px solid var(--tg-success)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 8px',
                textAlign: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ fontSize: '26px', marginBottom: '6px' }}>💰</div>
                <div style={{
                  fontSize: monthStats && monthStats.salary >= 10000 ? '17px' : '22px',
                  fontWeight: 700,
                  color: 'var(--tg-success)',
                  lineHeight: 1,
                }}>
                  {formatMoney(monthStats?.salary ?? 0)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--tg-text-secondary)', marginTop: '5px', fontWeight: 500 }}>
                  Зарплата
                </div>
              </div>
            </div>

            {/* Extras banner */}
            {monthStats && monthStats.extras_total > 0 && (
              <div style={{
                background: 'var(--tg-warning-bg)',
                border: '1px solid var(--tg-warning)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                marginBottom: 'var(--space-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '13px', color: 'var(--tg-warning)', fontWeight: 500 }}>
                  ✨ Додаткові нарахування
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tg-warning)' }}>
                  +{formatMoney(monthStats.extras_total)}
                </span>
              </div>
            )}

            {/* Lessons detail */}
            {monthStats && monthStats.lessons_count > 0 ? (
              <div>
                <button
                  onClick={() => setShowLessons(v => !v)}
                  style={{
                    width: '100%',
                    background: 'var(--tg-surface)',
                    border: '1.5px solid var(--tg-link-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    color: 'var(--tg-link-color)',
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: showLessons ? 'var(--space-md)' : 0,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '12px' }}>{showLessons ? '▲' : '▼'}</span>
                  <span>{showLessons ? 'Сховати заняття' : `Деталі занять (${monthStats.lessons_count})`}</span>
                </button>

                {showLessons && (
                  <div>
                    {monthStats.lessons.map(lesson => (
                      <Link
                        key={lesson.lesson_id}
                        href={`/teacher-app/lesson/${lesson.lesson_id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 14px',
                          background: 'var(--tg-surface)',
                          border: '1px solid var(--tg-border)',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: '8px',
                          textDecoration: 'none',
                          cursor: 'pointer',
                        }}
                        className="tg-lesson-link"
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            color: 'var(--tg-text-color)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flexWrap: 'wrap',
                          }}>
                            {lesson.group_title || (lesson.is_individual ? 'Індивідуальне' : 'Заняття')}
                            {lesson.is_replacement && (
                              <span style={{
                                background: 'var(--tg-primary-bg)',
                                color: 'var(--tg-link-color)',
                                fontSize: '10px',
                                fontWeight: 500,
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-full)',
                              }}>
                                Заміна
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)', marginTop: '3px' }}>
                            {formatLessonDate(lesson.lesson_date)}
                            {' · '}
                            {lesson.present_count} учн. × ₴{lesson.rate}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--tg-success)' }}>
                            {formatMoney(lesson.salary)}
                          </span>
                          <span style={{ fontSize: '16px', color: 'var(--tg-hint-color)' }}>›</span>
                        </div>
                      </Link>
                    ))}

                    {/* Extra items */}
                    {monthStats.extra_items.map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          background: 'var(--tg-warning-bg)',
                          border: '1px solid var(--tg-warning)',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: '8px',
                        }}
                      >
                        <span style={{ fontSize: '13px', color: 'var(--tg-text-color)' }}>
                          ✨ {item.description}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--tg-warning)' }}>
                          +{formatMoney(item.amount)}
                        </span>
                      </div>
                    ))}

                    {/* Month total */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 16px',
                      background: 'linear-gradient(135deg, var(--tg-success-bg), var(--tg-surface))',
                      border: '1.5px solid var(--tg-success)',
                      borderRadius: 'var(--radius-md)',
                      marginTop: '4px',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--tg-text-color)' }}>
                        Разом за {MONTH_NAMES_GENITIVE[statsMonth - 1].toLowerCase()}
                      </span>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--tg-success)' }}>
                        {formatMoney(monthStats.salary)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="tg-empty">
                <div className="tg-empty-icon">📭</div>
                <p>Немає проведених занять за {MONTH_NAMES_GENITIVE[statsMonth - 1].toLowerCase()} {statsYear}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Contact Information */}
      <div className="tg-section">
        <h3 className="tg-section-title">📞 Контактна інформація</h3>
        <div className="tg-card" style={{ padding: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--tg-border)' }}>
            <div style={{ fontSize: '20px' }}>✈️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)', marginBottom: '2px' }}>Telegram</div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                {teacher?.telegram_id ? `@${teacher.telegram_id}` : 'Не вказано'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--tg-border)' }}>
            <div style={{ fontSize: '20px' }}>📱</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)', marginBottom: '2px' }}>Телефон</div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                {teacher?.phone || 'Не вказано'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
            <div style={{ fontSize: '20px' }}>📧</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)', marginBottom: '2px' }}>Email</div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                {teacher?.email || 'Не вказано'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="tg-section">
        <h3 className="tg-section-title">ℹ️ Інформація про акаунт</h3>
        <div className="tg-card" style={{ padding: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
            <div style={{ fontSize: '20px' }}>📅</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)', marginBottom: '2px' }}>Дата реєстрації</div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                {teacher?.created_at
                  ? new Date(teacher.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'Невідомо'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role Switcher */}
      <div style={{ marginTop: '24px' }}>
        <button
          onClick={() => {
            localStorage.removeItem('tg_app_role');
            router.push('/tg-app');
          }}
          style={{
            width: '100%',
            background: 'var(--tg-surface)',
            border: '1.5px solid var(--tg-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span style={{ fontSize: '24px' }}>🔄</span>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--tg-text-color)' }}>Змінити роль</div>
            <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)', marginTop: '2px' }}>Перейти до вибору режиму</div>
          </div>
          <span style={{ fontSize: '16px', color: 'var(--tg-hint-color)' }}>›</span>
        </button>
      </div>

      <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--tg-hint-color)', fontSize: '12px' }}>
        <p>IT Robotics CRM • Кабінет викладача</p>
        <p>Версія 1.0.0</p>
      </div>
    </div>
  );
}
