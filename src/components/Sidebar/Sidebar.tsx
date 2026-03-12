'use client';

import { usePathname } from 'next/navigation';
import { t } from '@/i18n/t';
import {
  Home,
  BookOpen,
  Users,
  User,
  GraduationCap,
  Calendar,
  BarChart3,
  Settings,
  ClipboardList
} from 'lucide-react';
import TransitionLink from '@/components/TransitionLink';

interface SidebarProps {
  user: {
    role: 'admin' | 'teacher';
  };
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  isTablet?: boolean;
}

const menuItems = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: Home },
  { href: '/schedule', labelKey: 'nav.schedule', icon: Calendar },
  { href: '/courses', labelKey: 'nav.courses', icon: BookOpen },
  { href: '/groups', labelKey: 'nav.groups', icon: Users },
  { href: '/students', labelKey: 'nav.students', icon: User },
  { href: '/teachers', labelKey: 'nav.teachers', icon: GraduationCap },
  { href: '/attendance', labelKey: 'nav.attendance', icon: ClipboardList },
  { href: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
];

const adminMenuItems = [
  { href: '/users', labelKey: 'nav.users', icon: Settings },
];

export default function Sidebar({ user, isOpen, onClose, isMobile = false, isTablet = false }: SidebarProps) {
  const pathname = usePathname();

  const isSmallScreen = isMobile || isTablet;

  // On mobile/tablet, sidebar slides from left as overlay
  // On desktop, sidebar is fixed in place
  const getSidebarLeft = () => {
    if (isSmallScreen) {
      return isOpen ? '0px' : '-280px';
    }
    return isOpen ? '16px' : '-256px';
  };

  const getSidebarTop = () => {
    if (isSmallScreen) return '0px';
    return '80px';
  };

  const getSidebarHeight = () => {
    if (isSmallScreen) return '100vh';
    return 'calc(100vh - 100px)';
  };

  const getSidebarWidth = () => {
    if (isMobile) return '280px';
    return '240px';
  };

  const getSidebarBorderRadius = () => {
    if (isSmallScreen) return '0 16px 16px 0';
    return '16px';
  };

  const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    top: getSidebarTop(),
    left: getSidebarLeft(),
    width: getSidebarWidth(),
    height: getSidebarHeight(),
    backgroundColor: '#ffffff',
    color: '#333333',
    transition: 'left 0.3s ease',
    zIndex: isSmallScreen ? 30 : 25,
    boxShadow: isOpen ? '0 4px 20px rgba(0, 0, 0, 0.08)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: getSidebarBorderRadius(),
    marginBottom: isSmallScreen ? '0' : '16px',
    border: isSmallScreen ? 'none' : '1px solid #f0f0f0',
  };

  const navItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: isMobile ? '14px 16px' : '12px 16px',
    borderRadius: '12px',
    color: isActive ? '#1565c0' : '#666666',
    backgroundColor: isActive ? '#e3f2fd' : 'transparent',
    textDecoration: 'none',
    fontWeight: isActive ? '600' : '500',
    fontSize: isMobile ? '15px' : '14px',
    transition: 'all 0.2s ease',
    marginBottom: '4px',
    marginLeft: '12px',
    marginRight: '12px',
    cursor: 'pointer',
  });

  return (
    <>
      {/* Mobile/Tablet overlay */}
      {isSmallScreen && isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 29,
          }}
        />
      )}

      <aside style={sidebarStyle}>
        {/* Logo area */}
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderBottom: '1px solid #f5f5f5',
          minHeight: isSmallScreen ? '64px' : 'auto',
        }}>
          <img 
            src="/logo.svg" 
            alt="IT Robotics" 
            style={{ 
              width: '100%', 
              maxWidth: '160px', 
              height: 'auto', 
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
            }}
          />
        </div>

        {/* Navigation */}
        <nav style={{ padding: '24px 8px', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <TransitionLink
                key={item.href}
                href={item.href}
                onClick={onClose}
                style={navItemStyle(isActive)}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                    e.currentTarget.style.color = '#333333';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#666666';
                  }
                }}
              >
                <Icon width="20" height="20" style={{ color: isActive ? '#1565c0' : '#666666', flexShrink: 0 }} />
                {t(item.labelKey)}
              </TransitionLink>
            );
          })}

          {user.role === 'admin' && (
            <>
              <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '16px 12px' }} />
              {adminMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <TransitionLink
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    style={navItemStyle(isActive)}
                    onMouseOver={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                        e.currentTarget.style.color = '#333333';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#666666';
                      }
                    }}
                  >
                    <Icon width="20" height="20" style={{ color: isActive ? '#1565c0' : '#666666', flexShrink: 0 }} />
                    {t(item.labelKey)}
                  </TransitionLink>
                );
              })}
            </>
          )}
        </nav>

      </aside>
    </>
  );
}
