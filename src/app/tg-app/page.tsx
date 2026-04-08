'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TelegramWebAppProvider, useTelegramInitData, saveInitData } from '@/components/TelegramWebAppProvider';
import { CpuIcon, ShieldIcon, BookOpenIcon, XCircleIcon } from '@/components/Icons';

const ROLE_KEY = 'tg_app_role';
const APP_VERSION = (process.env.NEXT_PUBLIC_TEACHER_APP_VERSION || process.env.NEXT_PUBLIC_APP_VERSION || '1').slice(0, 12);

function RoleSwitcher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initData, isLoading } = useTelegramInitData();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [adminName, setAdminName] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const buildDestination = useMemo(() => {
    return (role: 'admin' | 'teacher') => {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('v', APP_VERSION);
      const targetPath = role === 'admin' ? '/admin-app' : '/teacher-app';
      const query = nextParams.toString();
      return query ? `${targetPath}?${query}` : targetPath;
    };
  }, [searchParams]);

  useEffect(() => {
    if (isLoading || !initData) return;

    const detect = async () => {
      try {
        const res = await fetch('/api/tg-app/auth', {
          headers: { 'X-Telegram-Init-Data': initData },
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Доступ заборонено');
          setLoading(false);
          return;
        }

        const { roles: detectedRoles, adminUser, teacherUser } = data;
        setRoles(detectedRoles || []);
        if (adminUser) setAdminName(adminUser.name || '');
        if (teacherUser) setTeacherName(teacherUser.name || '');

        // Save detected roles for the toggle component
        try { localStorage.setItem('tg_app_roles', JSON.stringify(detectedRoles)); } catch {}

        // If only one role — redirect immediately
        if (detectedRoles.length === 1) {
          if (initData) saveInitData(initData);
          const dest = buildDestination(detectedRoles[0] === 'admin' ? 'admin' : 'teacher');
          router.replace(dest);
          return;
        }

        // If both roles — check saved preference
        if (detectedRoles.length > 1) {
          const saved = localStorage.getItem(ROLE_KEY);
          if (saved === 'admin' || saved === 'teacher') {
            if (initData) saveInitData(initData);
            router.replace(buildDestination(saved));
            return;
          }
        }

        setLoading(false);
      } catch {
        setError('Помилка підключення');
        setLoading(false);
      }
    };

    detect();
  }, [buildDestination, initData, isLoading, router]);

  const choose = (role: 'admin' | 'teacher') => {
    // Explicitly re-save initData before cross-route-group navigation
    // (some WebViews like TDesktop may lose sessionStorage between route groups)
    if (initData) saveInitData(initData);
    localStorage.setItem(ROLE_KEY, role);
    router.push(buildDestination(role));
  };

  if (loading || isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '24px', background: '#f8fafc' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #ef4444', borderRadius: '14px', padding: '24px', textAlign: 'center', maxWidth: '320px' }}>
          <div style={{ marginBottom: '12px', color: '#ef4444' }}><XCircleIcon size={36} /></div>
          <div style={{ fontWeight: 600, color: '#ef4444', fontSize: '16px', marginBottom: '8px' }}>Доступ заборонено</div>
          <div style={{ color: '#9ca3af', fontSize: '14px' }}>{error}</div>
        </div>
      </div>
    );
  }

  // Both roles picker
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '32px', background: '#f8fafc',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{ marginBottom: '16px', color: '#3b82f6' }}><CpuIcon size={44} /></div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>IT Robotics CRM</div>
      <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '40px' }}>Оберіть режим входу</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '320px' }}>
        {roles.includes('admin') && (
          <button
            onClick={() => choose('admin')}
            style={{
              background: '#3b82f6', color: 'white', border: 'none',
              borderRadius: '14px', padding: '20px 24px', cursor: 'pointer',
              textAlign: 'left', transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
          >
            <div style={{ marginBottom: '8px' }}><ShieldIcon size={26} color="white" /></div>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>Адміністратор</div>
            {adminName && <div style={{ fontSize: '13px', opacity: 0.85 }}>{adminName}</div>}
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>Розклад, сповіщення, профіль</div>
          </button>
        )}

        {roles.includes('teacher') && (
          <button
            onClick={() => choose('teacher')}
            style={{
              background: '#10b981', color: 'white', border: 'none',
              borderRadius: '14px', padding: '20px 24px', cursor: 'pointer',
              textAlign: 'left', transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ marginBottom: '8px' }}><BookOpenIcon size={26} color="white" /></div>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>Викладач</div>
            {teacherName && <div style={{ fontSize: '13px', opacity: 0.85 }}>{teacherName}</div>}
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>Мої групи, розклад, заняття</div>
          </button>
        )}
      </div>
    </div>
  );
}

export default function TgAppPage() {
  return (
    <TelegramWebAppProvider>
      <RoleSwitcher />
    </TelegramWebAppProvider>
  );
}
