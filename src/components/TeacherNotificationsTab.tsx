'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';

interface TeacherNotifSettings {
  teacher_daily_reminders_enabled: boolean;
  teacher_daily_reminders_time: string;
  teacher_hourly_reminders_enabled: boolean;
  teacher_hourly_reminders_before_minutes: string;
  teacher_new_lesson_notify_enabled: boolean;
}

interface Props {
  initialSettings: TeacherNotifSettings;
}

export default function TeacherNotificationsTab({ initialSettings }: Props) {
  const [settings, setSettings] = useState<TeacherNotifSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_daily_reminders_enabled: settings.teacher_daily_reminders_enabled ? '1' : '0',
          teacher_daily_reminders_time: settings.teacher_daily_reminders_time,
          teacher_hourly_reminders_enabled: settings.teacher_hourly_reminders_enabled ? '1' : '0',
          teacher_hourly_reminders_before_minutes: settings.teacher_hourly_reminders_before_minutes,
          teacher_new_lesson_notify_enabled: settings.teacher_new_lesson_notify_enabled ? '1' : '0',
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{
        padding: '1rem 1.125rem',
        background: '#eff6ff',
        border: '1px solid #93c5fd',
        borderRadius: '0.75rem',
        color: '#1e40af',
      }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.35rem' }}>
          Автоматичні сповіщення в Telegram
        </div>
        <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
          Налаштування надсилаються через GitHub Actions. Для зміни часу щоранкових нагадувань також оновіть cron у файлі .github/workflows/teacher-notifications.yml.
        </div>
      </div>

      <label style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '1rem 1.125rem',
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={settings.teacher_daily_reminders_enabled}
          onChange={(e) => setSettings(prev => ({ ...prev, teacher_daily_reminders_enabled: e.target.checked }))}
          style={{ width: '18px', height: '18px', accentColor: '#2563eb', marginTop: '0.15rem' }}
        />
        <div>
          <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.3rem' }}>
            Щоранкові нагадування
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.6 }}>
            Надсилати викладачам список занять на день.
          </div>
        </div>
      </label>

      <div style={{
        padding: '1rem 1.125rem',
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
      }}>
        <label style={{ display: 'block', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
          Час щоранкових нагадувань
        </label>
        <input
          type="time"
          value={settings.teacher_daily_reminders_time}
          onChange={(e) => setSettings(prev => ({ ...prev, teacher_daily_reminders_time: e.target.value }))}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #d1d5db',
            fontSize: '0.9375rem',
            width: '140px',
          }}
        />
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.35rem' }}>
          Час за київським часом. Переконайтеся, що cron у GitHub Actions відповідає цьому часу.
        </div>
      </div>

      <label style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '1rem 1.125rem',
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={settings.teacher_hourly_reminders_enabled}
          onChange={(e) => setSettings(prev => ({ ...prev, teacher_hourly_reminders_enabled: e.target.checked }))}
          style={{ width: '18px', height: '18px', accentColor: '#2563eb', marginTop: '0.15rem' }}
        />
        <div>
          <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.3rem' }}>
            Нагадування перед заняттям
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.6 }}>
            Надсилати нагадування за певний час до початку заняття.
          </div>
        </div>
      </label>

      <div style={{
        padding: '1rem 1.125rem',
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
      }}>
        <label style={{ display: 'block', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
          За скільки хвилин нагадувати
        </label>
        <input
          type="number"
          min="5"
          max="180"
          value={settings.teacher_hourly_reminders_before_minutes}
          onChange={(e) => setSettings(prev => ({ ...prev, teacher_hourly_reminders_before_minutes: e.target.value }))}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #d1d5db',
            fontSize: '0.9375rem',
            width: '100px',
          }}
        />
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.35rem' }}>
          Рекомендовано: 60 хвилин.
        </div>
      </div>

      <label style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '1rem 1.125rem',
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={settings.teacher_new_lesson_notify_enabled}
          onChange={(e) => setSettings(prev => ({ ...prev, teacher_new_lesson_notify_enabled: e.target.checked }))}
          style={{ width: '18px', height: '18px', accentColor: '#2563eb', marginTop: '0.15rem' }}
        />
        <div>
          <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.3rem' }}>
            Сповіщення про нове заняття
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.6 }}>
            Надсилати викладачу повідомлення при створенні індивідуального або разового заняття.
          </div>
        </div>
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={14} />
          {saving ? 'Збереження...' : saved ? 'Збережено!' : 'Зберегти'}
        </button>
      </div>
    </div>
  );
}
