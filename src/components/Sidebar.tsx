'use client';

import { usePathname } from 'next/navigation';
import { t } from '@/i18n/t';
import {
  Home,
  BookOpen,
  Users,
  User,
  ChalkboardTeacher,
  GraduationCap,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  X
} from 'lucide-react';

interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: 'admin' | 'teacher';
  };
  onClose?: () => void;
}

const menuItems = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: Home },
  { href: '/courses', labelKey: 'nav.courses', icon: BookOpen },
  { href: '/groups', labelKey: 'nav.groups', icon: Users },
  { href: '/students', labelKey: 'nav.students', icon: User },
  { href: '/teachers', labelKey: 'nav.teachers', icon: ChalkboardTeacher },
  { href: '/lessons', labelKey: 'nav.lessons', icon: Calendar },
  { href: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
];

const adminMenuItems = [
  { href: '/users', labelKey: 'nav.users', icon: Settings },
];

export default function Sidebar({ user, onClose }: SidebarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <aside className="h-full w-64 bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{t('app.name')}</h1>
          </div>
        </div>
        {/* Close button for mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{t(item.labelKey)}</span>
            </a>
          );
        })}

        {user.role === 'admin' && (
          <>
            <div className="h-px bg-slate-700/50 my-3" />
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'bg-blue-500/20 text-blue-400' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{t(item.labelKey)}</span>
                </a>
              );
            })}
          </>
        )}
      </nav>

      {/* User info at bottom */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {getInitials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('actions.logout')}</span>
        </button>
      </div>
    </aside>
  );
}
