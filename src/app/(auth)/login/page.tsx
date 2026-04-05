'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n/t';
import styles from './login.module.css';

interface UserPreview {
  name: string;
  photo_url: string | null;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function RobotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" strokeWidth="2.5" />
      <line x1="16" y1="16" x2="16" y2="16" strokeWidth="2.5" />
      <path d="M9 20v1" />
      <path d="M15 20v1" />
    </svg>
  );
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

  // Lookup user by email with debounce
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
        if (data.user) {
          setUserPreview(data.user);
        } else {
          setUserPreview(null);
        }
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
    setTimeout(() => passwordRef.current?.focus(), 100);
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

  // Focus password on step change
  useEffect(() => {
    if (step === 'password') {
      passwordRef.current?.focus();
    }
  }, [step]);

  return (
    <div className={styles.container}>
      {/* Decorative particles */}
      <div className={styles.particle} />
      <div className={styles.particle} />
      <div className={styles.particle} />
      <div className={styles.particle} />
      <div className={styles.particle} />
      <div className={styles.gridOverlay} />

      <div className={styles.card}>
        {/* Logo & branding */}
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}>
            <RobotIcon />
          </div>
          <div className={styles.schoolName}>{t('app.schoolName')}</div>
          <h1 className={styles.appName}>{t('app.name')}</h1>
          <p className={styles.subtitle}>{t('app.loginSubtitle')}</p>
        </div>

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="email">
                {t('forms.email')}
              </label>
              <div className={styles.inputWrapper}>
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
                <div className={styles.inputIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
              </div>
            </div>

            {error && (
              <div className={styles.errorMessage}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className={styles.submitBtn} disabled={!email}>
              <span>{t('common.continue') || 'Далі'}</span>
            </button>
          </form>
        )}

        {/* Step 2: Password (with greeting) */}
        {step === 'password' && (
          <div>
            {/* User greeting */}
            <div className={styles.userGreeting}>
              {userPreview?.photo_url ? (
                <div className={styles.userAvatar}>
                  <img
                    src={userPreview.photo_url}
                    alt={userPreview.name}
                  />
                </div>
              ) : userPreview?.name ? (
                <div className={styles.avatarInitials}>
                  {getInitials(userPreview.name)}
                </div>
              ) : null}

              {userPreview?.name ? (
                <>
                  <div className={styles.greetingName}>
                    {t('app.welcomeBack')}, {userPreview.name.split(' ')[0]}!
                  </div>
                  <div className={styles.greetingHint}>{t('app.enterPassword')}</div>
                </>
              ) : (
                <div className={styles.greetingHint}>{t('app.enterPassword')}</div>
              )}
            </div>

            <form onSubmit={handlePasswordSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel} htmlFor="password">
                  {t('forms.password')}
                </label>
                <div className={styles.inputWrapper}>
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
                  <div className={styles.inputIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                </div>
              </div>

              {error && (
                <div className={styles.errorMessage}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
