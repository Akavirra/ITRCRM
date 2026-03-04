'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Search,
  Settings, 
  Bell, 
  Command,
  ChevronDown
} from 'lucide-react';

interface HeaderProps {
  user: {
    name: string;
    role: string;
  };
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onMenuClick }) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications] = useState(3);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6">
      <div className="flex items-center justify-between w-full gap-4">
        
        {/* Пошук - по центру */}
        <div className="flex-1 flex justify-center max-w-xl mx-auto">
          <div className="w-full">
            <div 
              className={`w-full flex items-center rounded-2xl border transition-all duration-200 
                ${searchFocused 
                  ? 'bg-white border-blue-300 shadow-[0_0_0_3px_rgba(59,130,246,0.1)]' 
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
            >
              <div className="pl-4 flex-shrink-0">
                <Search size={18} className={searchFocused ? 'text-blue-500' : 'text-slate-400'} />
              </div>
              <input
                ref={searchRef}
                type="text"
                placeholder="Пошук по системі..."
                className="flex-1 px-3 py-2.5 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none min-w-0"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              <div className="pr-3 flex-shrink-0 hidden sm:block">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">
                  <Command size={12} className="text-slate-400" />
                  <span className="text-[11px] font-medium text-slate-400">K</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Права частина - дії */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Налаштування */}
          <button 
            className="p-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
            aria-label="Налаштування"
          >
            <Settings size={20} />
          </button>

          {/* Сповіщення */}
          <button 
            className="relative p-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
            aria-label="Сповіщення"
          >
            <Bell size={20} />
            {notifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-amber-400 text-white text-[10px] font-bold rounded-full px-1 shadow-sm">
                {notifications > 9 ? '9+' : notifications}
              </span>
            )}
          </button>

          {/* Роздільник */}
          <div className="h-6 w-px bg-slate-200"></div>

          {/* Профіль користувача */}
          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-2xl transition-all duration-200 
                ${userMenuOpen ? 'bg-slate-100' : 'hover:bg-slate-50'} border border-transparent hover:border-slate-200`}
            >
              {/* Аватар */}
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center ring-2 ring-white shadow-sm">
                <span className="text-sm font-semibold text-white">{getInitials(user.name)}</span>
                {/* Онлайн індикатор */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              
              {/* Ім'я та роль */}
              <div className="text-left hidden md:block">
                <p className="text-sm font-semibold text-slate-700 leading-tight whitespace-nowrap">{user.name}</p>
                <p className="text-xs text-slate-400 whitespace-nowrap">{user.role === 'admin' ? 'Адміністратор' : 'Викладач'}</p>
              </div>
              
              {/* Стрілка */}
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''} hidden md:block`} />
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                <a href="/profile" className="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                  Профіль
                </a>
                <a href="/settings" className="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                  Налаштування
                </a>
                <hr className="my-1 border-slate-100" />
                <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  Вийти
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
