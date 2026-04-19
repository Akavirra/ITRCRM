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
  { href: '/schedule', label: 'Розклад', icon: '📅' },
  { href: '/profile', label: 'Профіль', icon: '👤' },
];

export default function StudentShell({ student, children }: StudentHeaderProps) {
  const pathname = usePathname() || '';
  // Користувач бачить /dashboard, але middleware вже rewrite'нуло на /s/dashboard
  const normalize = (p: string) => p.replace(/^\/s(\/|$)/, '/');
  const currentPath = normalize(pathname);

  return (
    <>
      <header className="student-header">
        <div>
          <h1>ITRobotics</h1>
          <div className="student-code">{student.code}</div>
        </div>
        <div style={{ fontSize: 13, textAlign: 'right' }}>
          <div style={{ fontWeight: 500 }}>{student.full_name}</div>
        </div>
      </header>

      <div className="student-container">{children}</div>

      <nav className="student-nav" aria-label="Основна навігація">
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
    </>
  );
}
