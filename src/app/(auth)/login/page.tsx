'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n/t';
import styles from './login.module.css';

interface UserPreview {
  name: string;
  photo_url: string | null;
}

function getDicebearUrl(name: string): string {
  let seed = '';
  try {
    seed = localStorage.getItem('itrobot-avatar-seed') || '';
  } catch {}
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed || name)}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userPreview, setUserPreview] = useState<UserPreview | null>(null);
  const [step, setStep] = useState<'email' | 'password'>('email');
  const passwordRef = useRef<HTMLInputElement>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout>>();

  const lookupUser = useCallback((emailValue: string) => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);

    if (!emailValue || !emailValue.includes('@')) {
      setUserPreview(null);
      return;
    }

    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailValue }),
        });
        const data = await res.json();
        setUserPreview(data.user || null);
      } catch {
        setUserPreview(null);
      }
    }, 400);
  }, []);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setError('');
    lookupUser(value);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStep('password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('auth.loginFailed'));
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch {
      setError(t('toasts.networkError'));
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep('email');
    setPassword('');
    setError('');
  };

  useEffect(() => {
    if (step === 'password') {
      passwordRef.current?.focus();
    }
  }, [step]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logoArea}>
          <h1 className={styles.appName}>{t('app.name')}</h1>
          <div className={styles.schoolName}>{t('app.schoolName')}</div>
          <p className={styles.subtitle}>
            {step === 'email' ? t('app.loginSubtitle') : t('app.enterPassword')}
          </p>
        </div>

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="email">
                {t('forms.email')}
              </label>
              <input
                id="email"
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder={t('forms.emailPlaceholder')}
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className={styles.errorMessage}>{error}</div>
            )}

            <button type="submit" className={styles.submitBtn} disabled={!email}>
              <span>{t('common.continue')}</span>
            </button>
          </form>
        )}

        {/* Step 2: Password */}
        {step === 'password' && (
          <div>
            {userPreview?.name && (
              <div className={styles.userGreeting}>
                <div className={styles.userAvatar}>
                  <img
                    src={userPreview.photo_url || getDicebearUrl(userPreview.name)}
                    alt={userPreview.name}
                  />
                </div>
                <div className={styles.greetingName}>
                  {t('app.welcomeBack')}, {userPreview.name.split(' ')[0]}!
                </div>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel} htmlFor="password">
                  {t('forms.password')}
                </label>
                <input
                  ref={passwordRef}
                  id="password"
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder={t('forms.passwordPlaceholder')}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <div className={styles.errorMessage}>{error}</div>
              )}

              <button type="submit" className={styles.submitBtn} disabled={loading || !password}>
                <span>
                  {loading && <div className={styles.spinner} />}
                  {loading ? t('common.loading') : t('actions.login')}
                </span>
              </button>
            </form>

            <button type="button" className={styles.backLink} onClick={goBack}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              {t('forms.email')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
