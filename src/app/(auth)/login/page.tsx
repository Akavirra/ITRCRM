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

// Google-style colored brand letters
function BrandName() {
  const letters = 'ITRobotics';
  return (
    <div className={styles.brandRow}>
      {letters.split('').map((ch, i) => (
        <span key={i} className={styles.brandLetter}>{ch}</span>
      ))}
    </div>
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
          <BrandName />
          <div className={styles.schoolName}>{t('app.schoolName')}</div>
          <p className={styles.subtitle}>
            {step === 'email' ? t('app.loginSubtitle') : t('app.enterPassword')}
          </p>
        </div>

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
                <svg className={styles.errorIcon} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                {error}
              </div>
            )}

            <div className={styles.buttonsRow}>
              <div />
              <button type="submit" className={styles.submitBtn} disabled={!email}>
                <span>{t('common.continue')}</span>
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Password */}
        {step === 'password' && (
          <div className={styles.stepContent}>
            {/* User greeting or email chip */}
            {userPreview?.name ? (
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
                <button type="button" className={styles.emailChip} onClick={goBack}>
                  <span className={styles.emailChipIcon}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                    </svg>
                  </span>
                  {email}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#5f6368">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
              </div>
            ) : (
              <button type="button" className={styles.emailChip} onClick={goBack} style={{ marginBottom: 20 }}>
                <span className={styles.emailChipIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                  </svg>
                </span>
                {email}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#5f6368">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>
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
                  <svg className={styles.errorIcon} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  {error}
                </div>
              )}

              <div className={styles.buttonsRow}>
                <div />
                <button type="submit" className={styles.submitBtn} disabled={loading || !password}>
                  <span>
                    {loading && <div className={styles.spinner} />}
                    {loading ? t('common.loading') : t('actions.login')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.footer}>
          <span>ITRobotics CRM</span>
        </div>
      </div>
    </div>
  );
}
