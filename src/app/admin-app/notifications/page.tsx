'use client';

import { useEffect, useState } from 'react';
import { useTelegramInitData } from '@/components/TelegramWebAppProvider';
import {
  GiftIcon, CheckCircleIcon, BellIcon, FileTextIcon, XCircleIcon,
  CalendarIcon, UsersIcon, DollarIcon, SettingsIcon, ClockIcon,
  CheckIcon, UserPlusIcon, UserMinusIcon, EditIcon, TrashIcon,
} from '@/components/Icons';

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  created_at: string;
  is_read: boolean;
}

const TYPE_ICON: Record<string, React.FC<{ size?: number; color?: string }>> = {
  birthday: GiftIcon,
  lesson_done: CheckCircleIcon,
  note_reminder: BellIcon,
  enrollment_submission: FileTextIcon,
  lesson_canceled: XCircleIcon,
  lesson_rescheduled: CalendarIcon,
  teacher_replaced: UsersIcon,
  trial_lesson_scheduled: UserPlusIcon,
  camp_payment_added: DollarIcon,
  system_settings_updated: SettingsIcon,
  enrollment_approved: CheckIcon,
  enrollment_rejected: XCircleIcon,
  student_added_to_group: UserPlusIcon,
  student_removed_from_group: UserMinusIcon,
  payment_created: DollarIcon,
  payment_updated: EditIcon,
  payment_deleted: TrashIcon,
  lessons_generated: CalendarIcon,
  lesson_stale: ClockIcon,
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'щойно';
  if (diff < 3600) return `${Math.floor(diff / 60)} хв тому`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} год тому`;
  return `${Math.floor(diff / 86400)} дн тому`;
}

export default function AdminNotificationsPage() {
  const { initData, isLoading: initLoading } = useTelegramInitData();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async (iData: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-app/notifications', {
        headers: { 'X-Telegram-Init-Data': iData },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Помилка'); return; }
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setError('Не вдалося завантажити сповіщення');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initLoading && initData) {
      fetchNotifications(initData);
    }
  }, [initData, initLoading]);

  const markAllRead = async () => {
    if (!initData) return;
    await fetch('/api/admin-app/notifications', {
      method: 'POST',
      headers: { 'X-Telegram-Init-Data': initData, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const clearAll = async () => {
    if (!initData) return;
    await fetch('/api/admin-app/notifications', {
      method: 'DELETE',
      headers: { 'X-Telegram-Init-Data': initData },
    });
    setNotifications([]);
    setUnreadCount(0);
  };

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="tg-header-title">
              Сповіщення
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: '8px',
                  background: 'var(--tg-danger)',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
          {notifications.length > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--tg-link-color)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: '4px 8px',
                  }}
                >
                  Прочитати всі
                </button>
              )}
              <button
                onClick={clearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--tg-hint-color)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                Очистити
              </button>
            </div>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="tg-empty">
          <div className="tg-empty-icon"><BellIcon size={40} /></div>
          <div>Сповіщень немає</div>
        </div>
      ) : (
        notifications.map(n => (
          <div
            key={n.id}
            style={{
              background: n.is_read ? 'var(--tg-surface)' : 'var(--tg-primary-bg)',
              border: `1px solid ${n.is_read ? 'var(--tg-border)' : 'var(--tg-link-color)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-sm)',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, color: n.type === 'birthday' ? 'var(--tg-warning)' : 'var(--tg-success)' }}>
                {(() => { const Icon = TYPE_ICON[n.type] || BellIcon; return <Icon size={22} />; })()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: '14px', color: 'var(--tg-text-color)' }}>
                    {n.title}
                  </div>
                  {!n.is_read && (
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: 'var(--tg-link-color)', flexShrink: 0, marginLeft: '8px',
                    }} />
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--tg-text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                  {n.body}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--tg-hint-color)', marginTop: '6px' }}>
                  {timeAgo(n.created_at)}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
