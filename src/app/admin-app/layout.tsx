'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { TelegramWebAppProvider, useTelegramWebApp, useTelegramInitData } from '@/components/TelegramWebAppProvider';
import AdminAppNavbar from '@/components/AdminAppNavbar';
import RoleToggle from '@/components/RoleToggle';

function AdminAppContent({ children }: { children: ReactNode }) {
  const { isLoading, colorScheme } = useTelegramWebApp();
  const { initData, isLoading: initLoading } = useTelegramInitData();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!initData) return;
    try {
      const res = await fetch('/api/admin-app/notifications?count=true', {
        headers: { 'X-Telegram-Init-Data': initData },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch { /* ignore */ }
  }, [initData]);

  useEffect(() => {
    if (!initLoading && initData) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [initData, initLoading, fetchUnreadCount]);

  useEffect(() => {
    const root = document.documentElement;

    if (colorScheme === 'dark') {
      root.style.setProperty('--tg-bg-color', '#121212');
      root.style.setProperty('--tg-surface', '#1e1e1e');
      root.style.setProperty('--tg-text-color', '#e8eaed');
      root.style.setProperty('--tg-text-secondary', '#9aa0a6');
      root.style.setProperty('--tg-hint-color', '#5f6368');
      root.style.setProperty('--tg-link-color', '#8ab4f8');
      root.style.setProperty('--tg-primary', '#8ab4f8');
      root.style.setProperty('--tg-primary-bg', '#2d4a7c');
      root.style.setProperty('--tg-button-color', '#8ab4f8');
      root.style.setProperty('--tg-button-text-color', '#121212');
      root.style.setProperty('--tg-border', 'rgba(255, 255, 255, 0.12)');
      root.style.setProperty('--tg-success-bg', '#1a3d2e');
      root.style.setProperty('--tg-success', '#81c995');
      root.style.setProperty('--tg-danger-bg', '#4d2020');
      root.style.setProperty('--tg-danger', '#f28b82');
    } else {
      root.style.setProperty('--tg-bg-color', '#f8fafc');
      root.style.setProperty('--tg-surface', '#ffffff');
      root.style.setProperty('--tg-text-color', '#1e293b');
      root.style.setProperty('--tg-text-secondary', '#64748b');
      root.style.setProperty('--tg-hint-color', '#94a3b8');
      root.style.setProperty('--tg-link-color', '#3b82f6');
      root.style.setProperty('--tg-primary', '#3b82f6');
      root.style.setProperty('--tg-primary-bg', '#eff6ff');
      root.style.setProperty('--tg-button-color', '#3b82f6');
      root.style.setProperty('--tg-button-text-color', '#ffffff');
      root.style.setProperty('--tg-border', 'rgba(0, 0, 0, 0.08)');
      root.style.setProperty('--tg-success-bg', '#ecfdf5');
      root.style.setProperty('--tg-success', '#10b981');
      root.style.setProperty('--tg-danger-bg', '#fef2f2');
      root.style.setProperty('--tg-danger', '#ef4444');
    }
  }, [colorScheme]);

  if (isLoading) {
    return (
      <div className="admin-app-layout has-navbar">
        <div className="tg-loading">
          <div className="tg-spinner"></div>
        </div>
        <style jsx global>{sharedStyles}</style>
      </div>
    );
  }

  return (
    <div className="admin-app-layout has-navbar">
      <main>
        <RoleToggle currentRole="admin" />
        {children}
      </main>
      <AdminAppNavbar unreadCount={unreadCount} />
      <style jsx global>{sharedStyles}</style>
    </div>
  );
}

// Reuse the same CSS variables and utility classes as teacher-app
const sharedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  :root {
    --tg-bg-color: var(--tg-bg-color, #f8fafc);
    --tg-surface: var(--tg-surface, #ffffff);
    --tg-text-color: var(--tg-text-color, #1e293b);
    --tg-text-secondary: var(--tg-text-secondary, #64748b);
    --tg-hint-color: var(--tg-hint-color, #94a3b8);
    --tg-link-color: var(--tg-link-color, #3b82f6);
    --tg-primary: var(--tg-primary, #3b82f6);
    --tg-primary-bg: var(--tg-primary-bg, #eff6ff);
    --tg-button-color: var(--tg-button-color, #3b82f6);
    --tg-button-text-color: var(--tg-button-text-color, #ffffff);
    --tg-border: var(--tg-border, rgba(0, 0, 0, 0.08));
    --tg-success: var(--tg-success, #10b981);
    --tg-success-bg: var(--tg-success-bg, #ecfdf5);
    --tg-danger: var(--tg-danger, #ef4444);
    --tg-danger-bg: var(--tg-danger-bg, #fef2f2);
    --tg-warning: var(--tg-warning, #f59e0b);
    --tg-warning-bg: var(--tg-warning-bg, #fffbeb);
    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 24px;
    --space-xl: 32px;
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-xl: 20px;
    --radius-full: 9999px;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);
  }

  .admin-app-layout {
    min-height: 100vh;
    background-color: var(--tg-bg-color);
    color: var(--tg-text-color);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  .admin-app-layout main {
    padding: var(--space-lg);
    padding-bottom: calc(var(--space-xl) + 70px);
    max-width: 100%;
    min-height: 100vh;
  }

  @media (max-width: 480px) {
    .admin-app-layout main {
      padding: var(--space-md);
    }
  }

  .tg-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }

  .tg-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--tg-border);
    border-top-color: var(--tg-button-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .tg-card {
    background-color: var(--tg-surface);
    border: 1px solid var(--tg-border);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin-bottom: var(--space-md);
    box-shadow: var(--shadow-md);
  }

  .tg-header { margin-bottom: var(--space-xl); }
  .tg-header-title { font-size: 24px; font-weight: 700; color: var(--tg-text-color); margin-bottom: var(--space-xs); letter-spacing: -0.02em; }
  .tg-header-subtitle { font-size: 14px; color: var(--tg-text-secondary); }

  .tg-button {
    background-color: var(--tg-button-color);
    color: var(--tg-button-text-color);
    border: none;
    border-radius: var(--radius-md);
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow-sm);
  }

  .tg-button:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
  .tg-button:active { transform: translateY(0); }
  .tg-button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

  .tg-input {
    width: 100%;
    padding: 14px 16px;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--tg-border);
    background: var(--tg-surface);
    color: var(--tg-text-color);
    font-size: 14px;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .tg-input:focus { outline: none; border-color: var(--tg-link-color); box-shadow: 0 0 0 3px var(--tg-primary-bg); }
  .tg-input::placeholder { color: var(--tg-hint-color); }

  .tg-label { display: block; font-size: 13px; font-weight: 500; color: var(--tg-text-secondary); margin-bottom: var(--space-sm); }

  .tg-empty { text-align: center; padding: var(--space-xl); color: var(--tg-hint-color); }
  .tg-empty-icon { font-size: 48px; margin-bottom: var(--space-md); opacity: 0.6; }

  .tg-divider { height: 1px; background: var(--tg-border); margin: var(--space-lg) 0; }

  .tg-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: var(--radius-full); font-size: 12px; font-weight: 500; }
  .tg-badge-info { background: var(--tg-primary-bg); color: var(--tg-link-color); }
  .tg-badge-success { background: var(--tg-success-bg); color: var(--tg-success); }
  .tg-badge-danger { background: var(--tg-danger-bg); color: var(--tg-danger); }
  .tg-badge-warning { background: var(--tg-warning-bg); color: var(--tg-warning); }

  .tg-lesson-card {
    background: var(--tg-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin-bottom: var(--space-md);
    border: 1px solid var(--tg-border);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tg-lesson-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); border-color: var(--tg-link-color); }

  .tg-hint { color: var(--tg-hint-color); font-size: 13px; line-height: 1.5; }
  .tg-section { margin-bottom: var(--space-xl); }
  .tg-section-title { font-size: 18px; font-weight: 600; color: var(--tg-text-color); margin-bottom: var(--space-md); }

  /* Day selector */
  .tg-day-selector {
    display: flex;
    gap: 6px;
    margin-bottom: var(--space-lg);
  }

  .tg-day-btn {
    flex: 1;
    padding: 8px 4px 10px;
    border-radius: var(--radius-lg);
    background: var(--tg-surface);
    border: 1px solid var(--tg-border);
    cursor: pointer;
    text-align: center;
    transition: all 0.2s ease;
    color: var(--tg-text-color);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .tg-day-btn:hover {
    border-color: var(--tg-link-color);
  }

  .tg-day-btn.active {
    background: var(--tg-button-color);
    color: var(--tg-button-text-color);
    border-color: var(--tg-button-color);
    box-shadow: var(--shadow-md);
  }

  .tg-day-name {
    font-size: 11px;
    font-weight: 500;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .tg-day-num {
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
  }

  .tg-day-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--tg-link-color);
  }

  .tg-day-btn.active .tg-day-dot {
    background: var(--tg-button-text-color);
  }

  .tg-day-count {
    font-size: 10px;
    font-weight: 600;
    opacity: 0.6;
  }

  /* Lesson card details */
  .tg-lesson-time {
    font-size: 17px;
    font-weight: 600;
    color: var(--tg-text-color);
    margin-bottom: var(--space-sm);
  }

  .tg-lesson-group {
    font-size: 15px;
    font-weight: 500;
    color: var(--tg-text-color);
    margin-bottom: var(--space-xs);
  }

  .tg-lesson-course {
    font-size: 13px;
    color: var(--tg-text-secondary);
  }

  .tg-lesson-topic {
    font-size: 13px;
    color: var(--tg-text-color);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--tg-border);
  }
`;

export default function AdminAppLayout({ children }: { children: ReactNode }) {
  return (
    <TelegramWebAppProvider>
      <AdminAppContent>{children}</AdminAppContent>
    </TelegramWebAppProvider>
  );
}
