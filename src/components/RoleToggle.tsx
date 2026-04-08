'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveInitData, useTelegramInitData } from '@/components/TelegramWebAppProvider';

const ROLES_KEY = 'tg_app_roles';
const APP_VERSION = (process.env.NEXT_PUBLIC_TEACHER_APP_VERSION || process.env.NEXT_PUBLIC_APP_VERSION || '1').slice(0, 12);

interface RoleToggleProps {
  currentRole: 'admin' | 'teacher';
}

export default function RoleToggle({ currentRole }: RoleToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initData } = useTelegramInitData();
  const [hasBothRoles, setHasBothRoles] = useState(false);
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
    // 1. Check localStorage cache first
    try {
      const raw = localStorage.getItem(ROLES_KEY);
      if (raw) {
        const roles = JSON.parse(raw) as string[];
        if (roles.includes('admin') && roles.includes('teacher')) {
          setHasBothRoles(true);
          return;
        }
      }
    } catch {}

    // 2. No cached roles — fetch from API (only if we have initData)
    if (!initData) return;

    fetch('/api/tg-app/auth', {
      headers: { 'X-Telegram-Init-Data': initData },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.roles) return;
        try { localStorage.setItem(ROLES_KEY, JSON.stringify(data.roles)); } catch {}
        if (data.roles.includes('admin') && data.roles.includes('teacher')) {
          setHasBothRoles(true);
        }
      })
      .catch(() => {});
  }, [initData]);

  if (!hasBothRoles) return null;

  const switchTo = (role: 'admin' | 'teacher') => {
    if (role === currentRole) return;
    if (initData) saveInitData(initData);
    localStorage.setItem('tg_app_role', role);
    router.push(buildDestination(role));
  };

  return (
    <>
      <style jsx>{`
        .role-toggle {
          display: flex;
          background: var(--tg-border);
          border-radius: 20px;
          padding: 3px;
          margin-bottom: 16px;
          position: relative;
        }
        .role-toggle-btn {
          flex: 1;
          padding: 7px 0;
          border: none;
          border-radius: 17px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          background: transparent;
          color: var(--tg-text-secondary);
          text-align: center;
          line-height: 1;
          letter-spacing: 0.01em;
        }
        .role-toggle-btn.active {
          background: var(--tg-surface);
          color: var(--tg-text-color);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .role-toggle-btn:not(.active):hover {
          color: var(--tg-text-color);
        }
      `}</style>
      <div className="role-toggle">
        <button
          className={`role-toggle-btn ${currentRole === 'admin' ? 'active' : ''}`}
          onClick={() => switchTo('admin')}
        >
          Адмін
        </button>
        <button
          className={`role-toggle-btn ${currentRole === 'teacher' ? 'active' : ''}`}
          onClick={() => switchTo('teacher')}
        >
          Викладач
        </button>
      </div>
    </>
  );
}
