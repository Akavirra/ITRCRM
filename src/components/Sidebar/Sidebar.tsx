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
  LogOut
} from 'lucide-react';

interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: 'admin' | 'teacher';
  };
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const menuItems = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: Home },
  { href: '/courses', labelKey: 'nav.courses', icon: BookOpen },
  { href: '/groups', labelKey: 'nav.groups', icon: Users },
  { href: '/students', labelKey: 'nav.students', icon: User },
  { href: '/teachers', labelKey: 'nav.teachers', icon: GraduationCap },
  { href: '/lessons', labelKey: 'nav.lessons', icon: Calendar },
  { href: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
];

const adminMenuItems = [
  { href: '/users', labelKey: 'nav.users', icon: Settings },
];

export default function Sidebar({ user, isOpen, onClose, onLogout }: SidebarProps) {
  const pathname = usePathname();

  // Calculate sidebar position based on isOpen
  const sidebarLeft = isOpen ? '16px' : '-256px';

  const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    top: '80px',
    left: sidebarLeft,
    width: '240px',
    height: 'calc(100vh - 100px)',
    backgroundColor: '#ffffff',
    color: '#333333',
    transition: 'left 0.3s ease',
    zIndex: 25,
    boxShadow: isOpen ? '0 4px 20px rgba(0, 0, 0, 0.08)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: '16px',
    marginBottom: '16px',
    border: '1px solid #f0f0f0',
  };

  const navItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '12px',
    color: isActive ? '#1565c0' : '#666666',
    backgroundColor: isActive ? '#e3f2fd' : 'transparent',
    textDecoration: 'none',
    fontWeight: isActive ? '600' : '500',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    marginBottom: '4px',
    marginLeft: '12px',
    marginRight: '12px',
    cursor: 'pointer',
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 24,
            display: 'none',
          }}
          className="mobile-overlay"
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
        <nav style={{ padding: '24px 8px', flex: 1, overflowY: 'auto' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <a
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
              </a>
            );
          })}

          {user.role === 'admin' && (
            <>
              <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '16px 12px' }} />
              {adminMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <a
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
                  </a>
                );
              })}
            </>
          )}
        </nav>

        {/* User section at bottom */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid #f5f5f5',
          flexShrink: 0,
        }}>
          <div style={{ 
            marginBottom: '12px', 
            fontSize: '14px',
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: '#f8f9fa',
          }}>
            <div style={{ fontWeight: '600', color: '#333333' }}>{user.name}</div>
            <div style={{ color: '#888888', fontSize: '12px', marginTop: '2px' }}>{user.email}</div>
          </div>
          <button
            onClick={onLogout}
            style={{ 
              width: '100%', 
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              backgroundColor: 'transparent',
              color: '#666666',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#fef2f2';
              e.currentTarget.style.color = '#dc2626';
              e.currentTarget.style.borderColor = '#fecaca';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#666666';
              e.currentTarget.style.borderColor = '#e0e0e0';
            }}
          >
            <LogOut width="18" height="18" />
            {t('actions.logout')}
          </button>
        </div>
      </aside>

      {/* Show overlay on mobile when sidebar is open */}
      <style jsx global>{`
        @media (max-width: 1024px) {
          .mobile-overlay {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
