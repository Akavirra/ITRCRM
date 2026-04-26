'use client';

/**
 * Phase E.1.1: панель керування доступом викладача до веб-кабінету
 * (teacher.itrobotics.com.ua).
 *
 * Що тут робить адмін:
 *   - "Скинути пароль" — генерує тимчасовий пароль або приймає ввід владника
 *   - При reset також інвалідує всі активні teacher_sessions (зроблено в API)
 *
 * Гейтинг:
 *   - Кнопка показана тільки якщо переглядаємо викладача (teacher.role==='teacher')
 *   - API вимагає is_owner на сервері — якщо адмін не owner, дістане 403 з UI-friendly месиджем
 *
 * UX:
 *   - Тимчасовий пароль показуємо з copy-to-clipboard
 *   - Радимо передати пароль викладачу через захищений канал (Telegram особисто)
 */

import { useState } from 'react';

interface Props {
  teacherId: number;
  teacherName: string;
  teacherEmail: string;
}

export default function TeacherWebPortalAccess({ teacherId, teacherName, teacherEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setOpen(false);
    setCustomPassword('');
    setError(null);
    setResetResult(null);
    setCopied(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${teacherId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          customPassword.trim() ? { temporaryPassword: customPassword.trim() } : {},
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Помилка ${res.status}`);
        return;
      }
      setResetResult({ password: data.temporaryPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка зʼєднання');
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* старі браузери — ігноруємо */
    }
  }

  return (
    <div
      style={{
        marginTop: '1.5rem',
        padding: '1rem 1.25rem',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '1.5rem' }}>🌐</div>
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>Доступ до веб-кабінету</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            teacher.itrobotics.com.ua — окремий портал для викладача
          </div>
        </div>
      </div>

      {!open && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              padding: '0.5rem 1rem',
              background: '#ffffff',
              border: '1px solid #c7d2fe',
              color: '#4338ca',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            🔑 Скинути пароль викладача
          </button>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', alignSelf: 'center' }}>
            Викладач увійде email&apos;ом {teacherEmail} і новим паролем
          </span>
        </div>
      )}

      {open && !resetResult && (
        <form
          onSubmit={handleSubmit}
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.5rem',
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: '#334155',
                marginBottom: '0.25rem',
              }}
            >
              Свій пароль (необовʼязково)
            </label>
            <input
              type="text"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
              placeholder="Залиш пустим — згенеруємо випадковий"
              minLength={8}
              maxLength={128}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontFamily: 'ui-monospace, monospace',
              }}
              disabled={loading}
            />
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Мінімум 8 символів. Випадковий пароль безпечніший.
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                borderRadius: '0.375rem',
                fontSize: '0.85rem',
                marginBottom: '0.75rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Скидаємо…' : 'Скинути та видати тимчасовий пароль'}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#475569',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Скасувати
            </button>
          </div>
        </form>
      )}

      {resetResult && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '1rem',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '0.5rem',
          }}
        >
          <div style={{ fontWeight: 600, color: '#047857', marginBottom: '0.5rem' }}>
            ✅ Пароль для {teacherName} оновлено
          </div>
          <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '0.75rem' }}>
            Активні веб-сесії викладача знято. Передай йому пароль <strong>через захищений канал</strong>{' '}
            (Telegram особисто, не груповий чат).
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <code
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                background: '#ffffff',
                border: '1px solid #d1fae5',
                borderRadius: '0.375rem',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: '1rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: '#0f172a',
                userSelect: 'all',
              }}
            >
              {resetResult.password}
            </code>
            <button
              type="button"
              onClick={copyToClipboard}
              style={{
                padding: '0.5rem 0.75rem',
                background: copied ? '#047857' : '#ffffff',
                color: copied ? '#ffffff' : '#047857',
                border: '1px solid #047857',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {copied ? '✓ Скопійовано' : '📋 Копіювати'}
            </button>
          </div>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '0.75rem',
              padding: '0.4rem 0.85rem',
              background: 'transparent',
              border: 'none',
              color: '#475569',
              cursor: 'pointer',
              fontSize: '0.8rem',
              textDecoration: 'underline',
            }}
          >
            Готово, закрити
          </button>
        </div>
      )}
    </div>
  );
}
