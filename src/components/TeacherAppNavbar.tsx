'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavbarProps {
  teacherName?: string;
}

export default function TeacherAppNavbar({ teacherName }: NavbarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/teacher-app',
      label: 'Розклад',
      icon: '📅',
      active: pathname === '/teacher-app',
    },
    {
      href: '/teacher-app/groups',
      label: 'Групи',
      icon: '📚',
      active: pathname === '/teacher-app/groups',
    },
    {
      href: '/teacher-app/profile',
      label: 'Профіль',
      icon: '👤',
      active: pathname === '/teacher-app/profile',
    },
  ];

  return (
    <>
      <style jsx global>{`
        .teacher-navbar {
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

        .teacher-navbar-item {
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
        }

        .teacher-navbar-item:hover {
          background: var(--tg-primary-bg);
        }

        .teacher-navbar-item.active {
          color: var(--tg-link-color);
          background: var(--tg-primary-bg);
        }

        .teacher-navbar-icon {
          font-size: 20px;
          margin-bottom: 4px;
        }

        .teacher-navbar-label {
          font-size: 11px;
          font-weight: 500;
        }

        /* Main content padding for navbar */
        .teacher-app-layout.has-navbar main {
          padding-bottom: calc(var(--space-xl) + 60px);
        }
      `}</style>

      <nav className="teacher-navbar">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`teacher-navbar-item ${item.active ? 'active' : ''}`}
          >
            <span className="teacher-navbar-icon">{item.icon}</span>
            <span className="teacher-navbar-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
