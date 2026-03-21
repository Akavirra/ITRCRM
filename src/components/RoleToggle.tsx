'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveInitData, useTelegramInitData } from '@/components/TelegramWebAppProvider';

interface RoleToggleProps {
  currentRole: 'admin' | 'teacher';
}

export default function RoleToggle({ currentRole }: RoleToggleProps) {
  const router = useRouter();
  const { initData } = useTelegramInitData();
  const [hasBothRoles, setHasBothRoles] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('tg_app_roles');
      if (raw) {
        const roles = JSON.parse(raw) as string[];
        setHasBothRoles(roles.includes('admin') && roles.includes('teacher'));
      }
    } catch {}
  }, []);

  if (!hasBothRoles) return null;

  const switchTo = (role: 'admin' | 'teacher') => {
    if (role === currentRole) return;
    if (initData) saveInitData(initData);
    localStorage.setItem('tg_app_role', role);
    router.push(role === 'admin' ? '/admin-app' : '/teacher-app');
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
