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
      setTimeout(() => passwordRef.current?.focus(), 50);
    }
  }, [step]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Brand */}
        <div className={styles.logoArea}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="ITRobotics" className={styles.logo} />
        </div>

        <div className={styles.divider} />

        <p className={styles.subtitle}>
          {step === 'email' ? t('app.loginSubtitle') : t('app.enterPassword')}
        </p>

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className={styles.stepContent}>
            <div className={styles.inputGroup}>
              <input
                id="email"
                type="email"
                className={styles.floatingInput}
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder=" "
                autoComplete="email"
                autoFocus
                required
              />
              <label htmlFor="email" className={styles.floatingLabel}>
                {t('forms.email')}
              </label>
            </div>

            {error && (
              <div className={styles.errorMessage}>
                <svg className={styles.errorIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className={styles.submitBtn} disabled={!email}>
              <span>{t('common.continue')}</span>
            </button>
          </form>
        )}

        {/* Step 2: Password */}
        {step === 'password' && (
          <div className={styles.stepContent}>
            {userPreview?.name ? (
              <div className={styles.userGreeting}>
                <div className={styles.userAvatar}>
                  <img
                    src={userPreview.photo_url || getDicebearUrl(userPreview.name)}
                    alt={userPreview.name}
                  />
                </div>
                <div>
                  <div className={styles.greetingName}>
                    {t('app.welcomeBack')}, {userPreview.name.split(' ')[0]}!
                  </div>
                  <button type="button" className={styles.emailLink} onClick={goBack}>
                    {email}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.emailRow}>
                <button type="button" className={styles.emailLink} onClick={goBack}>
                  ← {email}
                </button>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              <div className={styles.inputGroup}>
                <input
                  ref={passwordRef}
                  id="password"
                  type="password"
                  className={styles.floatingInput}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder=" "
                  autoComplete="current-password"
                  required
                />
                <label htmlFor="password" className={styles.floatingLabel}>
                  {t('forms.password')}
                </label>
              </div>

              {error && (
                <div className={styles.errorMessage}>
                  <svg className={styles.errorIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" className={styles.submitBtn} disabled={loading || !password}>
                <span>
                  {loading && <div className={styles.spinner} />}
                  {loading ? t('common.loading') : t('actions.login')}
                </span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
