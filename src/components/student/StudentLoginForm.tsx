/**
 * Клієнтська форма логіну учня.
 *
 * Логіка:
 *   1. Приймає код (R0042) + PIN (6 цифр)
 *   2. POST /api/student/auth/login
 *   3. На 200 → window.location редірект на redirectTo
 *   4. На 401/429 → показує текст помилки (locked/rate_limit/invalid_credentials)
 *
 * PIN-поле: inputMode="numeric", autoComplete="off", показує бульбашки/цифри
 * (просте password-like поле — без "Show/Hide", щоб менше поверхні для leak).
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  initialCode?: string;
  redirectTo: string;
}

export default function StudentLoginForm({ initialCode = '', redirectTo }: Props) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    const trimmedCode = code.trim().toUpperCase();
    const pinDigits = pin.replace(/\D/g, '');

    if (!/^R\d+$/.test(trimmedCode)) {
      setError('Код має бути у форматі R0042');
      return;
    }
    if (pinDigits.length !== 6) {
      setError('PIN має містити 6 цифр');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/student/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode, pin: pinDigits }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data?.error ||
          (res.status === 429
            ? 'Занадто багато спроб. Спробуйте за 15 хвилин.'
            : 'Невірний код або PIN');
        setError(message);
        setLoading(false);
        return;
      }

      // Успіх — cookie встановлена сервером, робимо full reload, щоб
      // серверний layout перевірив сесію і підтягнув дані.
      window.location.href = redirectTo;
    } catch (err) {
      setError('Помилка з\'єднання. Перевірте інтернет.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <div className="student-error" role="alert">{error}</div>}

      <div style={{ marginBottom: 14 }}>
        <label className="student-label" htmlFor="student-code">Код учня</label>
        <input
          id="student-code"
          type="text"
          className="student-input"
          placeholder="R0042"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={12}
          required
          disabled={loading}
          style={{ letterSpacing: '0.05em', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase' }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label className="student-label" htmlFor="student-pin">PIN (6 цифр)</label>
        <input
          id="student-pin"
          type="password"
          className="student-input"
          placeholder="••••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoComplete="off"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          disabled={loading}
          style={{ letterSpacing: '0.25em', fontFamily: 'ui-monospace, monospace', textAlign: 'center', fontSize: 22 }}
        />
      </div>

      <button type="submit" className="student-primary-btn" disabled={loading}>
        {loading ? 'Вхід…' : 'Увійти'}
      </button>
    </form>
  );
}
