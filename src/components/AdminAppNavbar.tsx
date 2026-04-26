'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarIcon, BellIcon, UserIcon } from '@/components/Icons';

interface AdminAppNavbarProps {
  unreadCount?: number;
}

export default function AdminAppNavbar({ unreadCount = 0 }: AdminAppNavbarProps) {
  const pathname = usePathname() ?? '';

  const navItems = [
    {
      href: '/admin-app',
      label: 'Розклад',
      icon: CalendarIcon,
      active: pathname === '/admin-app',
    },
    {
      href: '/admin-app/notifications',
      label: 'Сповіщення',
      icon: BellIcon,
      active: pathname === '/admin-app/notifications',
      badge: unreadCount > 0 ? unreadCount : 0,
    },
    {
      href: '/admin-app/profile',
      label: 'Профіль',
      icon: UserIcon,
      active: pathname === '/admin-app/profile',
    },
  ];

  return (
    <>
      <style jsx global>{`
        .admin-navbar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--tg-surface);
          border-top: 1px solid var(--tg-border);
          padding: 8px 16px;
          padding-bottom: max(8px, env(safe-area-inset-bottom));
          display: flex;
          justify-content: space-around;
          z-index: 100;
          box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
        }

        .admin-navbar-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
          border-radius: var(--radius-lg);
          text-decoration: none;
          color: var(--tg-text-secondary);
          transition: all 0.2s ease;
          min-width: 70px;
          position: relative;
        }

        .admin-navbar-item:hover {
          background: var(--tg-primary-bg);
        }

        .admin-navbar-item.active {
          color: var(--tg-link-color);
          background: var(--tg-primary-bg);
        }

        .admin-navbar-icon {
          margin-bottom: 4px;
          position: relative;
        }

        .admin-navbar-label {
          font-size: 11px;
          font-weight: 500;
        }

        .admin-navbar-badge {
          position: absolute;
          top: -4px;
          right: -8px;
          background: var(--tg-danger);
          color: white;
          font-size: 10px;
          font-weight: 700;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .admin-app-layout.has-navbar main {
          padding-bottom: calc(var(--space-xl) + 80px);
        }
      `}</style>

      <nav className="admin-navbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-navbar-item ${item.active ? 'active' : ''}`}
            >
              <span className="admin-navbar-icon">
                <Icon size={22} />
                {item.badge ? (
                  <span className="admin-navbar-badge">{item.badge > 9 ? '9+' : item.badge}</span>
                ) : null}
              </span>
              <span className="admin-navbar-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
