'use client';

/**
 * Клієнтська форма логіну учня.
 *
 * Потік:
 *   1. Код учня (R0042) + PIN (6 цифр)
 *   2. POST /api/student/auth/login
 *   3. На 200 → window.location редірект на redirectTo
 *   4. На 401/429 → текст помилки (locked / rate_limit / invalid_credentials),
 *      shake на PIN-полі + автоочищення PIN.
 *
 * Автосабміт: коли учень завершує введення 6-ї цифри PIN і код валідний
 * (R\d+), форма сабмітиться сама — щоб не змушувати тиснути «Увійти».
 */

import { useCallback, useState } from 'react';
import { LogIn } from 'lucide-react';
import PinInput from './ui/PinInput';

interface Props {
  initialCode?: string;
  redirectTo: string;
}

const CODE_REGEX = /^R\d+$/;

export default function StudentLoginForm({ initialCode = '', redirectTo }: Props) {
  const [code, setCode] = useState(initialCode);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Інкрементується при кожній API-помилці → запускає shake на PinInput.
  const [pinErrorCount, setPinErrorCount] = useState(0);

  const submit = useCallback(
    async (currentCode: string, currentPin: string) => {
      if (loading) return;

      setError(null);
      const trimmedCode = currentCode.trim().toUpperCase();
      const pinDigits = currentPin.replace(/\D/g, '');

      if (!CODE_REGEX.test(trimmedCode)) {
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
          setPinErrorCount((n) => n + 1);
          setPin('');
          setLoading(false);
          return;
        }

        window.location.href = redirectTo;
      } catch {
        setError("Помилка з'єднання. Перевірте інтернет.");
        setLoading(false);
      }
    },
    [loading, redirectTo],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit(code, pin);
  }

  function handlePinComplete(completedPin: string) {
    // Автосабміт: код вже валідний + PIN з 6 цифр + не loading.
    if (loading) return;
    if (!CODE_REGEX.test(code.trim().toUpperCase())) return;
    void submit(code, completedPin);
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
        <label className="student-label" id="student-pin-label">PIN (6 цифр)</label>
        <PinInput
          value={pin}
          onChange={setPin}
          length={6}
          disabled={loading}
          ariaLabel="PIN-код учня (6 цифр)"
          errorTrigger={pinErrorCount}
          onComplete={handlePinComplete}
        />
      </div>

      <button type="submit" className="student-primary-btn student-login__submit" disabled={loading}>
        <LogIn size={16} strokeWidth={1.75} />
        {loading ? 'Вхід…' : 'Увійти'}
      </button>
    </form>
  );
}
