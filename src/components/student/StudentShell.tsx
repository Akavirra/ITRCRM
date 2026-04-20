/**
 * Обгортка сторінок студентського порталу з bottom-nav.
 * Клієнтський компонент, щоб підсвічувати активний таб через usePathname.
 *
 * ВАЖЛИВО: використовує тільки React + next/navigation — жодних admin-utilities.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface StudentHeaderProps {
  student: { id: number; full_name: string; code: string };
  children: React.ReactNode;
}

const NAV = [
  { href: '/dashboard', label: 'Головна', icon: '🏠' },
  { href: '/groups', label: 'Групи', icon: '📚' },
  { href: '/schedule', label: 'Розклад', icon: '📅' },
  { href: '/attendance', label: 'Відвід.', icon: '⏳' },
  { href: '/profile', label: 'Профіль', icon: '👤' },
];

export default function StudentShell({ student, children }: StudentHeaderProps) {
  const pathname = usePathname() || '';
  const normalize = (p: string) => p.replace(/^\/s(\/|$)/, '/');
  const currentPath = normalize(pathname);

  return (
    <div className="student-app-wrapper">
      <header className="student-header">
        <div className="student-header-logo">
          <h1>ITRobotics</h1>
          <div className="student-code">{student.code}</div>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="student-desktop-nav" aria-label="Навігація для комп'ютера">
          {NAV.map((item) => {
            const active = currentPath === item.href || currentPath.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
                <span className="student-nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="student-header-profile">
          <div style={{ fontWeight: 500 }}>{student.full_name}</div>
        </div>
      </header>

      <main className="student-container">{children}</main>

      {/* Mobile Navigation (Bottom) */}
      <nav className="student-mobile-nav" aria-label="Основна навігація">
        {NAV.map((item) => {
          const active = currentPath === item.href || currentPath.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
              <span className="student-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
