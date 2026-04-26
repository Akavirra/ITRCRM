'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { TelegramWebAppProvider, useTelegramWebApp } from '@/components/TelegramWebAppProvider';

type FormState = 'loading' | 'form' | 'submitting' | 'success' | 'error' | 'not_in_telegram';

interface FormData {
  teacher_name: string;
  teacher_email: string;
  teacher_phone: string;
  notes: string;
}

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '';

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (!digits.startsWith('380')) {
    if (digits.startsWith('0')) {
      digits = `38${digits}`;
    } else if (digits.startsWith('80')) {
      digits = `3${digits}`;
    } else if (!digits.startsWith('3')) {
      digits = `380${digits}`;
    }
  }
  digits = digits.slice(0, 12);
  return `+${digits}`;
}

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 3) return `+${digits}`;
  if (digits.length <= 5) return `+${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 8) return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  if (digits.length <= 10) return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function RegisterForm() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const { initData, isLoading: tgLoading, isInWebView, user } = useTelegramWebApp();

  const [state, setState] = useState<FormState>('loading');
  const [errorReason, setErrorReason] = useState('');
  const [formData, setFormData] = useState<FormData>({
    teacher_name: '',
    teacher_email: '',
    teacher_phone: '',
    notes: '',
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [telegramInfo, setTelegramInfo] = useState<{ id: string; username?: string; name?: string } | null>(null);

  useEffect(() => {
    if (tgLoading) return;

    if (!isInWebView || !initData) {
      setState('not_in_telegram');
      return;
    }

    // Validate token
    fetch(`/api/teacher-invites/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setState('form');
          if (user) {
            setTelegramInfo({
              id: user.id.toString(),
              username: user.username,
              name: [user.first_name, user.last_name].filter(Boolean).join(' '),
            });
            // Pre-fill name if empty
            if (user.first_name) {
              setFormData((prev) => ({
                ...prev,
                teacher_name: [user.first_name, user.last_name].filter(Boolean).join(' '),
              }));
            }
          }
        } else {
          setState('error');
          setErrorReason(data.reason || 'unknown');
        }
      })
      .catch(() => {
        setState('error');
        setErrorReason('network');
      });
  }, [token, tgLoading, isInWebView, initData, user]);

  const handlePhoneChange = (value: string) => {
    const normalized = normalizePhone(value);
    setFormData((prev) => ({ ...prev, teacher_phone: normalized }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    const errors: string[] = [];
    if (!formData.teacher_name.trim()) errors.push("Ім'я обов'язкове");
    if (!formData.teacher_email.trim()) errors.push("Email обов'язковий");
    if (formData.teacher_email.trim() && !isValidEmail(formData.teacher_email)) errors.push('Вкажіть коректний email');

    const phoneDigits = formData.teacher_phone.replace(/\D/g, '');
    if (phoneDigits.length > 0 && phoneDigits.length < 12) {
      errors.push('Введіть повний номер телефону');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setState('submitting');

    try {
      const res = await fetch(`/api/teacher-invites/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          teacher_name: formData.teacher_name.trim(),
          teacher_email: formData.teacher_email.trim(),
          teacher_phone: formData.teacher_phone || undefined,
          notes: formData.notes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setState('success');
      } else {
        setState('form');
        setValidationErrors([data.error || 'Помилка при відправці']);
      }
    } catch {
      setState('form');
      setValidationErrors(['Помилка мережі. Спробуйте ще раз.']);
    }
  };

  if (state === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={{ color: '#64748b', textAlign: 'center' }}>Завантаження...</p>
        </div>
      </div>
    );
  }

  if (state === 'not_in_telegram') {
    const deepLink = BOT_USERNAME
      ? `https://t.me/${BOT_USERNAME}?startapp=register_${token}`
      : '';

    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: '64px', height: '64px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
              Відкрийте в Telegram
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Це посилання працює тільки всередині Telegram. Відкрийте його через додаток, щоб автоматично підтягнувся ваш Telegram ID.
            </p>
          </div>
          {deepLink && (
            <a href={deepLink} style={styles.telegramBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              Відкрити в Telegram
            </a>
          )}
        </div>
      </div>
    );
  }

  if (state === 'error') {
    const messages: Record<string, { title: string; desc: string }> = {
      not_found: { title: 'Посилання не знайдено', desc: 'Це посилання недійсне або було видалене.' },
      already_used: { title: 'Запрошення вже використане', desc: 'Це посилання вже було використано.' },
      already_approved: { title: 'Вже затверджено', desc: 'Запрошення вже оброблене адміністратором.' },
      already_rejected: { title: 'Відхилено', desc: 'Це запрошення було відхилено.' },
      expired: { title: 'Посилання застаріло', desc: 'Термін дії цього посилання вичерпано. Зверніться до адміністратора школи.' },
      network: { title: 'Помилка мережі', desc: "Не вдалося підключитися. Перевірте інтернет-з'єднання." },
      unknown: { title: 'Помилка', desc: 'Щось пішло не так. Зверніться до адміністратора школи.' },
    };
    const msg = messages[errorReason] || messages.unknown;

    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: '#fff1f2', color: '#e11d48', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.75rem', fontWeight: 700 }}>×</div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>{msg.title}</h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6 }}>{msg.desc}</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: '#ecfdf3', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.75rem', fontWeight: 700 }}>✓</div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#15803d', margin: '0 0 0.5rem' }}>Дякуємо!</h1>
            <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Анкету надіслано. Адміністратор школи розгляне її та затвердить вашу реєстрацію найближчим часом.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/logo-light.svg" alt="ITRobotics" style={{ height: '40px', marginBottom: '0.75rem' }} />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem' }}>Реєстрація викладача</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>Заповніть дані для створення облікового запису</p>
        </div>

        {telegramInfo && (
          <div style={styles.telegramBadge}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.8125rem' }}>Telegram підключено</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#3b82f6', fontFamily: 'monospace' }}>
              ID: {telegramInfo.id}
              {telegramInfo.username && ` (@${telegramInfo.username})`}
            </span>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div style={styles.errorBox}>
            {validationErrors.map((err, index) => (
              <p key={index} style={{ margin: '0.18rem 0', color: '#be123c', fontSize: '0.85rem' }}>{err}</p>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={styles.field}>
            <label style={styles.label}>Прізвище та ім'я *</label>
            <input
              style={styles.input}
              value={formData.teacher_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, teacher_name: e.target.value }))}
              placeholder="Іваненко Іван"
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email *</label>
            <input
              type="email"
              style={styles.input}
              value={formData.teacher_email}
              onChange={(e) => setFormData((prev) => ({ ...prev, teacher_email: e.target.value }))}
              placeholder="ivan@example.com"
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Телефон</label>
            <input
              type="tel"
              style={styles.input}
              value={formatPhoneDisplay(formData.teacher_phone)}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+380 XX XXX XX XX"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Нотатки</label>
            <textarea
              style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Додаткова інформація (необов'язково)"
            />
          </div>

          <button
            type="submit"
            style={styles.submitBtn}
            disabled={state === 'submitting'}
          >
            {state === 'submitting' ? 'Надсилання...' : 'Надіслати анкету'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #eff6ff 0%, #f0fdf4 52%, #fff7ed 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.25rem',
    fontFamily: '"Segoe UI", Arial, sans-serif',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(16px)',
    borderRadius: '24px',
    padding: '1.75rem',
    maxWidth: '420px',
    width: '100%',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    boxShadow: '0 28px 80px rgba(15, 23, 42, 0.12)',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '2rem auto 1rem',
  },
  telegramBadge: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.75rem 1rem',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '12px',
    marginBottom: '1rem',
  },
  errorBox: {
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    borderRadius: '14px',
    padding: '0.85rem 1rem',
    marginBottom: '0.75rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#334155',
  },
  input: {
    padding: '0.75rem 0.9rem',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    fontSize: '0.95rem',
    lineHeight: 1.4,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 160ms ease-out, box-shadow 160ms ease-out',
    background: '#fff',
  },
  submitBtn: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    padding: '0.95rem 1.1rem',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '0.35rem',
    transition: 'transform 140ms ease-out, box-shadow 160ms ease-out, opacity 160ms ease-out',
    boxShadow: '0 16px 32px rgba(37, 99, 235, 0.22)',
  },
  telegramBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    padding: '0.95rem 1.1rem',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'transform 140ms ease-out, box-shadow 160ms ease-out',
    boxShadow: '0 16px 32px rgba(37, 99, 235, 0.22)',
  },
};

export default function RegisterTeacherPage() {
  return (
    <TelegramWebAppProvider>
      <RegisterForm />
    </TelegramWebAppProvider>
  );
}
