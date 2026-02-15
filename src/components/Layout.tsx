'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { t } from '@/i18n/t';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface LayoutProps {
  children: React.ReactNode;
  user: User;
}

const menuItems = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: 'home' },
  { href: '/courses', labelKey: 'nav.courses', icon: 'book' },
  { href: '/groups', labelKey: 'nav.groups', icon: 'users' },
  { href: '/students', labelKey: 'nav.students', icon: 'user' },
  { href: '/lessons', labelKey: 'nav.lessons', icon: 'calendar' },
  { href: '/reports', labelKey: 'nav.reports', icon: 'chart' },
];

const adminMenuItems = [
  { href: '/users', labelKey: 'nav.users', icon: 'settings' },
];

export default function Layout({ children, user }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const getIcon = (icon: string) => {
    switch (icon) {
      case 'home':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        );
      case 'book':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        );
      case 'users':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 'user':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      case 'calendar':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        );
      case 'chart':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        );
      case 'settings':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getPageTitle = () => {
    const menuItem = menuItems.find(m => m.href === pathname);
    if (menuItem) return t(menuItem.labelKey);
    const adminMenuItem = adminMenuItems.find(m => m.href === pathname);
    if (adminMenuItem) return t(adminMenuItem.labelKey);
    return t('app.name');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: sidebarOpen ? 0 : '-256px',
          width: '256px',
          height: '100vh',
          backgroundColor: '#1f2937',
          color: 'white',
          transition: 'left 0.3s ease',
          zIndex: 30,
        }}
      >
        <div style={{ padding: '1rem', borderBottom: '1px solid #374151' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{t('app.name')}</h1>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{t('app.subtitle')}</p>
        </div>

        <nav style={{ padding: '1rem 0' }}>
          {menuItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                color: pathname === item.href ? '#60a5fa' : '#d1d5db',
                backgroundColor: pathname === item.href ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              {getIcon(item.icon)}
              {t(item.labelKey)}
            </a>
          ))}

          {user.role === 'admin' && (
            <>
              <div style={{ height: '1px', backgroundColor: '#374151', margin: '1rem 0' }} />
              {adminMenuItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    color: pathname === item.href ? '#60a5fa' : '#d1d5db',
                    backgroundColor: pathname === item.href ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    textDecoration: 'none',
                  }}
                >
                  {getIcon(item.icon)}
                  {t(item.labelKey)}
                </a>
              ))}
            </>
          )}
        </nav>

        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '1rem',
          borderTop: '1px solid #374151',
        }}>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            <div style={{ fontWeight: '600' }}>{user.name}</div>
            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{user.email}</div>
            <span className={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-gray'}`} style={{ marginTop: '0.25rem' }}>
              {user.role === 'admin' ? t('roles.admin') : t('roles.teacher')}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', color: '#d1d5db', borderColor: '#4b5563' }}
          >
            {t('actions.logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{
        flex: 1,
        marginLeft: sidebarOpen ? '256px' : 0,
        transition: 'margin-left 0.3s ease',
      }}>
        {/* Top bar */}
        <header style={{
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          zIndex: 20,
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#4b5563',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
            {getPageTitle()}
          </h2>
        </header>

        {/* Page content */}
        <main style={{ padding: '1.5rem' }}>
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 20,
          }}
        />
      )}
    </div>
  );
}
