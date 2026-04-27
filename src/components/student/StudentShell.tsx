/**
 * Обгортка сторінок студентського порталу.
 * Клієнтський компонент, щоб підсвічувати активний таб через usePathname.
 *
 * ВАЖЛИВО: використовує тільки React + next/navigation — жодних admin-utilities.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  Calendar,
  FileText,
} from 'lucide-react';

interface StudentHeaderProps {
  student: { id: number; full_name: string; code: string; photo: string | null };
  children: React.ReactNode;
}

const NAV = [
  { href: '/dashboard', label: 'Головна', icon: Home },
  { href: '/groups', label: 'Групи', icon: Users },
  { href: '/schedule', label: 'Розклад', icon: Calendar },
  { href: '/works', label: 'Роботи', icon: FileText },
];

function getInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

export default function StudentShell({ student, children }: StudentHeaderProps) {
  const pathname = usePathname() || '';
  const normalize = (p: string) => p.replace(/^\/s(\/|$)/, '/');
  const currentPath = normalize(pathname);
  const profileActive = currentPath === '/profile' || currentPath.startsWith('/profile/');

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
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
                <span className="student-nav-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/profile"
          className={'student-header-profile' + (profileActive ? ' active' : '')}
          aria-label="Відкрити профіль"
        >
          <div className="student-header-avatar" aria-hidden="true">
            {student.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={student.photo} alt="" />
            ) : (
              <span>{getInitials(student.full_name)}</span>
            )}
          </div>
          <span className="student-header-name">{student.full_name}</span>
        </Link>
      </header>

      <main className="student-container">{children}</main>

      {/* Mobile Navigation (Bottom) */}
      <nav className="student-mobile-nav" aria-label="Основна навігація">
        {NAV.map((item) => {
          const active = currentPath === item.href || currentPath.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
              <span className="student-nav-icon" aria-hidden="true">
                <Icon />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
