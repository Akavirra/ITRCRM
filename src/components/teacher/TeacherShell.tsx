'use client';

/**
 * Обгортка сторінок teacher-портала: header з навігацією + контейнер.
 *
 * Десктоп-first: горизонтальна навігація у header'і. На мобільних — wrap'ається
 * другим рядом + горизонтальний скрол (поки що, без bottom-bar — у викладача
 * вужче меню ніж в учня).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface TeacherInfo {
  id: number;
  full_name: string;
  photoUrl: string | null;
}

interface Props {
  teacher: TeacherInfo;
  children: React.ReactNode;
}

const NAV = [
  { href: '/dashboard', label: 'Головна' },
  { href: '/lessons', label: 'Заняття' },
  { href: '/groups', label: 'Групи' },
  { href: '/students', label: 'Учні' },
  { href: '/profile', label: 'Профіль' },
];

function avatarLetter(name: string): string {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export default function TeacherShell({ teacher, children }: Props) {
  const pathname = usePathname() || '';
  const normalize = (p: string) => p.replace(/^\/t(\/|$)/, '/');
  const currentPath = normalize(pathname);

  return (
    <div className="teacher-app-wrapper">
      <header className="teacher-header">
        <div className="teacher-header__brand">
          <div className="teacher-header__logo">IT</div>
          <div>
            <h1 className="teacher-header__title">ITRobotics</h1>
            <div className="teacher-header__subtitle">Кабінет викладача</div>
          </div>
        </div>

        <nav className="teacher-nav" aria-label="Основна навігація">
          {NAV.map((item) => {
            const active =
              currentPath === item.href || currentPath.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="teacher-header__user">
          <div className="teacher-header__avatar">
            {teacher.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teacher.photoUrl} alt={teacher.full_name} />
            ) : (
              avatarLetter(teacher.full_name)
            )}
          </div>
          <span style={{ display: 'none' }} aria-hidden="false">
            {/* Ім'я залишимо у профілі, в header'і — тільки аватар для компактності */}
          </span>
        </div>
      </header>

      <main className="teacher-container">{children}</main>
    </div>
  );
}
