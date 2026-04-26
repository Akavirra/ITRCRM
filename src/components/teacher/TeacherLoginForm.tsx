'use client';

/**
 * Клієнтська форма логіну викладача (email + пароль).
 *
 * Поведінка:
 *   1. POST /api/teacher/auth/login
 *   2. На 200 → window.location.href = redirectTo (full reload, щоб layout
 *      перевірив сесію через server-component)
 *   3. На 401/403/429 → показуємо message з reason-кодом
 */

import { useState } from 'react';

interface Props {
  initialEmail?: string;
  redirectTo: string;
}

export default function TeacherLoginForm({ initialEmail = '', redirectTo }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Введіть email і пароль');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/teacher/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data?.error ||
          (res.status === 429
            ? 'Занадто багато спроб. Спробуйте за 15 хвилин.'
            : 'Невірний email або пароль');
        setError(message);
        setLoading(false);
        return;
      }

      window.location.href = redirectTo;
    } catch {
      setError("Помилка з'єднання. Перевір інтернет.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="teacher-error" role="alert">
          {error}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <label className="teacher-label" htmlFor="teacher-email">
          Email
        </label>
        <input
          id="teacher-email"
          type="email"
          className="teacher-input"
          placeholder="ivan@itrobotics.com.ua"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          disabled={loading}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label className="teacher-label" htmlFor="teacher-password">
          Пароль
        </label>
        <input
          id="teacher-password"
          type="password"
          className="teacher-input"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        className="teacher-primary-btn teacher-primary-btn--full"
        disabled={loading}
      >
        {loading ? 'Вхід…' : 'Увійти'}
      </button>
    </form>
  );
}
