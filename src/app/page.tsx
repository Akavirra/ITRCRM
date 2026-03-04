'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n/t';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/login');
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t('app.name')}</div>
        <div style={{ color: '#6b7280' }}>Перенаправлення на вхід...</div>
      </div>
    </div>
  );
}
