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
  { href: '/schedule', labelKey: 'nav.schedule', icon: 'calendar' },
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
  const [isTablet, setIsTablet] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Check viewport size
  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      setIsDesktop(width >= 1025);
      setIsTablet(width >= 769 && width < 1025);
      setIsMobile(width < 769);
    };
    
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // On desktop, sidebar starts open; on mobile/tablet, starts closed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 1025);
    }
  }, []);

  // Close sidebar on route change for mobile/tablet
  useEffect(() => {
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  }, [pathname, isDesktop]);

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

  // Calculate margin based on sidebar state and viewport
  const getContentMarginLeft = () => {
    if (isMobile || isTablet) return '0px';
    return sidebarOpen ? '272px' : '16px';
  };

  const getContentMarginRight = () => {
    if (isMobile) return '0px';
    if (isTablet) return '8px';
    return '16px';
  };

  const getMainPadding = () => {
    if (isMobile) return '0.75rem';
    if (isTablet) return '1rem';
    return '1.5rem';
  };

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
          isMobile={isMobile}
          isTablet={isTablet}
        />

        {/* Main content */}
        <div 
          style={{
            flex: 1,
            minWidth: 0,
            marginLeft: getContentMarginLeft(),
            marginRight: getContentMarginRight(),
            transition: isDesktop ? 'margin-left 0.3s ease' : 'none',
          }}
        >
          {/* Page header (optional) */}
          {headerActions && (
            <header style={{
              position: 'sticky',
              top: '64px',
              backgroundColor: 'white',
              borderBottom: '1px solid #e5e7eb',
              padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem',
              display: 'flex',
              alignItems: isMobile ? 'flex-start' : 'center',
              justifyContent: 'space-between',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '0.75rem' : '1rem',
              zIndex: 10,
              borderRadius: isMobile ? '0' : '12px',
              marginTop: isMobile ? '0' : '8px',
            }}>
              <h2 style={{ fontSize: isMobile ? '1rem' : '1.125rem', fontWeight: '600', margin: 0 }}>
                {getPageTitle()}
              </h2>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                width: isMobile ? '100%' : 'auto',
                flexWrap: 'wrap',
              }}>
                {headerActions}
              </div>
            </header>
          )}

          {/* Page content */}
          <main style={{ padding: getMainPadding() }}>
            {children}
          </main>
        </div>

        {/* Mobile/Tablet overlay when sidebar is open */}
        {!isDesktop && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 20,
              transition: 'opacity 0.3s ease',
            }}
          />
        )}
      </div>
    </div>
  );
}
