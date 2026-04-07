'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n/t';
import styles from './login.module.css';

interface UserPreview {
  photo_url: string | null;
}

function getDicebearUrl(seedOrName: string): string {
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seedOrName)}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [userPreview, setUserPreview] = useState<UserPreview | null>(null);
  const [loggedInName, setLoggedInName] = useState('');
  const [step, setStep] = useState<'email' | 'password' | 'welcome'>('email');
  const [avatarSeed, setAvatarSeed] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout>>();

  const lookupUser = useCallback((emailValue: string) => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!emailValue || !emailValue.includes('@')) { setUserPreview(null); return; }

    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailValue }),
        });
        const data = await res.json();
        setUserPreview(data.user || null);
      } catch { setUserPreview(null); }
    }, 400);
  }, []);

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
      if (!res.ok) { setError(data.error || t('auth.loginFailed')); setLoading(false); return; }
      setLoggedInName(data.user?.name || '');
      setStep('welcome');
      setTimeout(() => router.push('/dashboard'), 2200);
    } catch {
      setError(t('toasts.networkError'));
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 'password') setTimeout(() => passwordRef.current?.focus(), 50);
  }, [step]);

  useEffect(() => {
    try {
      setAvatarSeed(localStorage.getItem('itrobot-avatar-seed') || '');
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!cancelled && res.ok) {
          router.replace('/dashboard');
          return;
        }
      } catch {}

      if (!cancelled) {
        setCheckingSession(false);
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const avatarSrc = userPreview?.photo_url || getDicebearUrl(avatarSeed || email);
  const firstName = loggedInName?.split(' ')[0] || '';

  if (checkingSession) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p className={styles.subtitle}>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (step === 'welcome') {
    return (
      <div className={`${styles.container} ${styles.welcomeContainer}`}>
        <div className={styles.welcomeScreen}>
          <div className={styles.welcomeAvatar}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc} alt={firstName || email} />
          </div>
          <div className={styles.welcomeText}>
            <div className={styles.welcomeTitle}>
              {firstName ? `${t('app.welcomeBack')}, ${firstName}!` : t('app.welcomeBack') + '!'}
            </div>
            <div className={styles.welcomeSubtitle}>{t('app.redirecting')}</div>
          </div>
          <div className={styles.welcomeProgress}>
            <div className={styles.welcomeProgressBar} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logoArea}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light.svg" alt="ITRobotics" className={styles.logo} />
        </div>

        <p className={styles.subtitle}>
          {step === 'email' ? t('app.loginSubtitle') : t('app.enterPassword')}
        </p>

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className={styles.stepContent}>
              <div className={styles.inputGroup}>
                <label htmlFor="email" className={styles.inputLabel}>Email</label>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); lookupUser(e.target.value); }}
                  placeholder="name@school.ua"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              {error && (
                <div className={styles.errorMessage}>
                  <svg className={styles.errorIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <button type="submit" className={styles.submitBtn} disabled={!email}>
                <span>{t('common.continue')}</span>
              </button>
            </form>
          )}

          {step === 'password' && (
            <div className={styles.stepContent}>
              <div className={styles.userGreeting}>
                <div className={styles.userAvatar}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarSrc} alt={email} />
                </div>
                <div>
                  <div className={styles.emailDisplay}>
                    {email}
                    <button type="button" className={styles.changeBtn} onClick={() => { setStep('email'); setPassword(''); setError(''); }}>
                      змінити
                    </button>
                  </div>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit}>
                <div className={styles.inputGroup}>
                  <label htmlFor="password" className={styles.inputLabel}>{t('forms.password')}</label>
                  <input
                    ref={passwordRef}
                    id="password"
                    type="password"
                    className={styles.input}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••"
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error && (
                  <div className={styles.errorMessage}>
                    <svg className={styles.errorIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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

