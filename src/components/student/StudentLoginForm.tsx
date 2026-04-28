'use client';

/**
 * Клієнтська форма логіну учня.
 *
 * Потік:
 *   1. Код учня (R0042) + PIN (6 цифр)
 *   2. POST /api/student/auth/login
 *   3. На 200 → window.location редірект на redirectTo
 *   4. На 401/429 → текст помилки (locked / rate_limit / invalid_credentials)
 */

import { useState } from 'react';
import { LogIn } from 'lucide-react';

interface Props {
  initialCode?: string;
  redirectTo: string;
}

export default function StudentLoginForm({ initialCode = '', redirectTo }: Props) {
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

      window.location.href = redirectTo;
    } catch {
      setError("Помилка з'єднання. Перевірте інтернет.");
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
          className="student-input student-login__code-input"
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
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label className="student-label" htmlFor="student-pin">PIN (6 цифр)</label>
        <input
          id="student-pin"
          type="password"
          className="student-input student-login__pin-input"
          placeholder="••••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoComplete="off"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          disabled={loading}
        />
      </div>

      <button type="submit" className="student-primary-btn student-login__submit" disabled={loading}>
        <LogIn size={16} strokeWidth={1.75} />
        {loading ? 'Вхід…' : 'Увійти'}
      </button>
    </form>
  );
}
