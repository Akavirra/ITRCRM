'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { t } from '@/i18n/t';
import Sidebar from './Sidebar/Sidebar';
import Navbar from './Navbar/Navbar';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  headerActions?: React.ReactNode;
  hideNavbar?: boolean;
}

const menuItems = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: 'home' },
  { href: '/courses', labelKey: 'nav.courses', icon: 'book' },
  { href: '/groups', labelKey: 'nav.groups', icon: 'users' },
  { href: '/students', labelKey: 'nav.students', icon: 'user' },
  { href: '/teachers', labelKey: 'nav.teachers', icon: 'teacher' },
  { href: '/lessons', labelKey: 'nav.lessons', icon: 'calendar' },
  { href: '/reports', labelKey: 'nav.reports', icon: 'chart' },
];

const adminMenuItems = [
  { href: '/users', labelKey: 'nav.users', icon: 'settings' },
];

export default function Layout({ children, user, headerActions, hideNavbar }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDesktop, setIsDesktop] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Check if we're on desktop
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1025);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // On desktop, sidebar starts open; on mobile, starts closed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 1025);
    }
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const getPageTitle = () => {
    const menuItem = menuItems.find(m => m.href === pathname);
    if (menuItem) return t(menuItem.labelKey);
    const adminMenuItem = adminMenuItems.find(m => m.href === pathname);
    if (adminMenuItem) return t(adminMenuItem.labelKey);
    return t('app.name');
  };

  // Calculate margin based on sidebar state
  const contentMarginLeft = sidebarOpen ? '272px' : '16px';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar - fixed at top, full width */}
      {!hideNavbar && (
        <Navbar 
          user={{ name: user.name, role: user.role }} 
          withSidebar={true}
          onMenuClick={handleMenuClick}
        />
      )}

      <div style={{ display: 'flex', flex: 1, paddingTop: hideNavbar ? 0 : '64px' }}>
        {/* Sidebar */}
        <Sidebar
          user={user}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />

        {/* Main content */}
        <div 
          style={{
            flex: 1,
            minWidth: 0,
            marginLeft: contentMarginLeft,
            marginRight: '16px',
            transition: 'margin-left 0.3s ease',
          }}
        >
          {/* Page header (optional) */}
          {headerActions && (
            <header style={{
              position: 'sticky',
              top: '64px',
              backgroundColor: 'white',
              borderBottom: '1px solid #e5e7eb',
              padding: '1rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              zIndex: 10,
              borderRadius: '12px',
              marginTop: '8px',
            }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
                {getPageTitle()}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {headerActions}
              </div>
            </header>
          )}

          {/* Page content */}
          <main style={{ padding: '1.5rem' }}>
            {children}
          </main>
        </div>

        {/* Mobile overlay when sidebar is open on mobile */}
        {!isDesktop && sidebarOpen && (
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
    </div>
  );
}
