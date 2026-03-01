'use client';

import { useEffect, useState } from 'react';
import { useTelegramInitData, useTelegramWebApp } from '@/components/TelegramWebAppProvider';

interface Teacher {
  id: number;
  name: string;
  telegram_id: string;
  role: string;
  phone: string | null;
  email: string | null;
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

export default function TeacherProfilePage() {
  const { initData, isLoading: initLoading, error: initError } = useTelegramInitData();
  const { isInWebView } = useTelegramWebApp();
  
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authenticate and fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (initLoading) return;
      
      if (!initData) {
        setError('Telegram WebApp не ініціалізовано');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/teacher-app/groups', {
          headers: { 'X-Telegram-Init-Data': initData }
        });

        if (!response.ok) {
          throw new Error('Не вдалося завантажити профіль');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Помилка');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [initData, initLoading]);

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  // Get role display
  const getRoleDisplay = (role: string): string => {
    switch (role) {
      case 'admin':
        return 'Адміністратор';
      case 'teacher':
        return 'Викладач';
      case 'manager':
        return 'Менеджер';
      default:
        return role;
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
        {/* Avatar */}
        <div 
          className="tg-avatar" 
          style={{ 
            width: '100px', 
            height: '100px', 
            fontSize: '36px', 
            margin: '0 auto var(--space-lg)',
            background: 'linear-gradient(135deg, var(--tg-primary-bg), var(--tg-link-color))',
          }}
        >
          {teacher?.name?.split(' ').map(n => n[0]).join('') || '?'}
        </div>

        {/* Name */}
        <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--tg-text-color)' }}>
          {teacher?.name || 'Невідомо'}
        </h2>

        {/* Role Badge */}
        <span 
          className="tg-badge tg-badge-scheduled" 
          style={{ marginBottom: '16px', display: 'inline-block' }}
        >
          {getRoleDisplay(teacher?.role || 'teacher')}
        </span>

        {/* Stats Row */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '12px',
          marginTop: 'var(--space-lg)',
          paddingTop: 'var(--space-lg)',
          borderTop: '1px solid var(--tg-border)'
        }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--tg-link-color)' }}>
              {data?.stats.total_groups || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)' }}>
              Груп
            </div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--tg-link-color)' }}>
              {data?.stats.total_students || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)' }}>
              Учнів
            </div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--tg-link-color)' }}>
              {data?.stats.total_lessons || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)' }}>
              Занять
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="tg-section">
        <h3 className="tg-section-title">📞 Контактна інформація</h3>
        
        <div className="tg-card" style={{ padding: 'var(--space-md)' }}>
          {/* Telegram ID */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--tg-border)' }}>
            <div style={{ fontSize: '20px' }}>✈️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)', marginBottom: '2px' }}>Telegram</div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                {teacher?.telegram_id ? `@${teacher.telegram_id}` : 'Не вказано'}
              </div>
            </div>
          </div>

          {/* Phone */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--tg-border)' }}>
            <div style={{ fontSize: '20px' }}>📱</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)', marginBottom: '2px' }}>Телефон</div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                {teacher?.phone || 'Не вказано'}
              </div>
            </div>
          </div>

          {/* Email */}
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
                {teacher?.created_at ? formatDate(teacher.created_at) : 'Невідомо'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--tg-hint-color)', fontSize: '12px' }}>
        <p>IT Robotics CRM • Кабінет викладача</p>
        <p>Версія 1.0.0</p>
      </div>
    </div>
  );
}
