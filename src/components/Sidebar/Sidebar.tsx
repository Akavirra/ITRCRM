'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { t } from '@/i18n/t';
import {
  Home,
  BookOpen,
  Users,
  User,
  GraduationCap,
  Calendar,
  BarChart3,
  ClipboardList,
  FolderOpen
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
];

const filesMenuItem = { href: '/materials', labelKey: 'nav.materials', icon: FolderOpen };

const reportsMenuItems = [
  { href: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
];


// ── Combined date/time + weather widget ───────────────────────────────────────

const DAYS_UK = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\u2019ятниця', 'Субота'];
const DAYS_SHORT_UK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTHS_UK = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const MONTHS_FULL_UK = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

interface WeatherData {
  city: string;
  temp: number;
  feels_like: number;
  description: string;
  humidity: number;
  wind: number;
  code: number;
}

interface ForecastDay {
  date: string;
  weekday: string;
  temp_min: number;
  temp_max: number;
  code: number;
}

const detailPill: React.CSSProperties = {
  fontSize: '10px',
  color: '#64748b',
  background: '#f0f7ff',
  borderRadius: '6px',
  padding: '2px 7px',
  whiteSpace: 'nowrap',
};

function weatherIcon(code: number): string {
  if (code >= 200 && code < 300) return '⛈';
  if (code >= 300 && code < 400) return '🌦';
  if (code >= 500 && code < 600) return '🌧';
  if (code >= 600 && code < 700) return '❄';
  if (code >= 700 && code < 800) return '🌫';
  if (code === 800) return '☀';
  if (code === 801) return '🌤';
  if (code === 802) return '⛅';
  return '☁';
}

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const divider = (
  <div style={{ height: '1px', background: 'rgba(59,130,246,0.08)', margin: '5px 0' }} />
);

function SidebarInfoWidget() {
  const [now, setNow] = useState<Date | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calYear, setCalYear] = useState(0);
  const [calMonth, setCalMonth] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const weatherBtnRef = useRef<HTMLButtonElement>(null);
  const weatherPopRef = useRef<HTMLDivElement>(null);
  const [weatherPopPos, setWeatherPopPos] = useState({ left: 0, bottom: 20 });

  useEffect(() => {
    const d = new Date();
    setNow(d);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setWeather(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!calOpen) return;
    const handler = (e: MouseEvent) => {
      const el = document.getElementById('sidebar-info-widget');
      if (el && !el.contains(e.target as Node)) setCalOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calOpen]);

  useEffect(() => {
    if (!weatherOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        weatherBtnRef.current?.contains(e.target as Node) ||
        weatherPopRef.current?.contains(e.target as Node)
      ) return;
      setWeatherOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [weatherOpen]);

  if (!now) return null;

  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const dayName = DAYS_UK[now.getDay()];
  const dateStr = `${now.getDate()} ${MONTHS_UK[now.getMonth()]}`;
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(mo => mo - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(mo => mo + 1);
  };

  const cells = buildCalendarDays(calYear, calMonth);
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  const handleWeatherClick = () => {
    if (!weatherOpen && weatherBtnRef.current) {
      const sidebar = weatherBtnRef.current.closest('aside');
      const right = sidebar?.getBoundingClientRect().right ?? weatherBtnRef.current.getBoundingClientRect().right;
      setWeatherPopPos({ left: right + 12, bottom: 20 });
      if (!forecast) {
        fetch('/api/weather/forecast')
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(d => setForecast(d.days))
          .catch(() => {});
      }
    }
    setWeatherOpen(o => !o);
  };

  return (
    <div id="sidebar-info-widget" style={{ margin: '0 12px 12px', flexShrink: 0, position: 'relative' }}>
      <div style={{
        padding: '9px 12px',
        borderRadius: '12px',
        background: '#f0f7ff',
        border: '1px solid rgba(59,130,246,0.1)',
      }}>

        {/* Row 1: time (left) + weather icon+temp clickable (right) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
            <span style={{ fontSize: '22px', fontWeight: '300', color: '#1e3a5f', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {h}<span style={{ opacity: 0.35, margin: '0 1px' }}>:</span>{m}
            </span>
            <span style={{ fontSize: '11px', color: '#b0bec5', marginLeft: '3px', fontVariantNumeric: 'tabular-nums' }}>
              {s}
            </span>
          </div>
          {weather && (
            <button
              ref={weatherBtnRef}
              onClick={handleWeatherClick}
              style={{
                display: 'flex', alignItems: 'center', gap: '3px',
                background: weatherOpen ? 'rgba(59,130,246,0.1)' : 'transparent',
                border: 'none', cursor: 'pointer',
                padding: '2px 5px', margin: '-2px -5px',
                borderRadius: '7px', transition: 'background 0.15s',
              }}
              onMouseOver={e => { if (!weatherOpen) e.currentTarget.style.background = 'rgba(59,130,246,0.07)'; }}
              onMouseOut={e => { if (!weatherOpen) e.currentTarget.style.background = weatherOpen ? 'rgba(59,130,246,0.1)' : 'transparent'; }}
            >
              <span style={{ fontSize: '14px', lineHeight: 1 }}>{weatherIcon(weather.code)}</span>
              <span style={{ fontSize: '16px', fontWeight: '400', color: '#1e3a5f', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
                {weather.temp}°
              </span>
            </button>
          )}
        </div>

        {divider}

        {/* Row 2: day name (left) + date (right) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#3b82f6' }}>
            {dayName}
          </span>
          <button
            onClick={() => {
              if (!calOpen) { setCalYear(todayY); setCalMonth(todayM); }
              setCalOpen(o => !o);
            }}
            style={{
              fontSize: '11px',
              color: calOpen ? '#3b82f6' : '#94a3b8',
              fontWeight: '400',
              background: 'none',
              border: 'none',
              padding: '1px 4px',
              margin: '-1px -4px',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'color 0.15s',
              backgroundColor: calOpen ? 'rgba(59,130,246,0.08)' : 'transparent',
            }}
            onMouseOver={e => { if (!calOpen) (e.currentTarget.style.color = '#3b82f6'); }}
            onMouseOut={e => { if (!calOpen) (e.currentTarget.style.color = '#94a3b8'); }}
          >
            {dateStr}
          </button>
        </div>
      </div>

      {/* Calendar popover */}
      {calOpen && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          background: '#fff',
          borderRadius: '14px',
          boxShadow: '0 8px 32px rgba(30,58,95,0.12), 0 1px 4px rgba(30,58,95,0.06)',
          border: '1px solid rgba(59,130,246,0.1)',
          padding: '12px',
          zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button onClick={prevMonth} style={calNavBtn}>‹</button>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e3a5f', letterSpacing: '0.02em' }}>
              {MONTHS_FULL_UK[calMonth]} {calYear}
            </span>
            <button onClick={nextMonth} style={calNavBtn}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {DAYS_SHORT_UK.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: '600', color: '#94a3b8', padding: '2px 0' }}>
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {cells.map((day, i) => {
              const isToday = day !== null && day === todayD && calMonth === todayM && calYear === todayY;
              const isWeekend = i % 7 >= 5;
              return (
                <div key={i} style={{
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: isToday ? '700' : '400',
                  color: isToday ? '#fff' : day === null ? 'transparent' : isWeekend ? '#94a3b8' : '#334155',
                  background: isToday ? '#3b82f6' : 'transparent',
                  borderRadius: '6px',
                  padding: '4px 2px',
                  lineHeight: '16px',
                  minWidth: 0,
                }}>
                  {day ?? ''}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weather detail popover — fixed to the right of sidebar */}
      {weatherOpen && weather && (
        <div
          ref={weatherPopRef}
          style={{
            position: 'fixed',
            left: weatherPopPos.left,
            bottom: weatherPopPos.bottom,
            width: '240px',
            background: '#fff',
            border: '1px solid #e8f0fe',
            borderRadius: '16px',
            padding: '16px',
            zIndex: 100,
            boxShadow: '0 2px 24px rgba(30,58,95,0.07)',
          }}
        >
          {/* City */}
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#3b82f6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
            {weather.city}
          </div>

          {/* Today: icon + temp + description */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <span style={{ fontSize: '40px', lineHeight: 1 }}>{weatherIcon(weather.code)}</span>
            <div>
              <div style={{ fontSize: '32px', fontWeight: '300', color: '#1e3a5f', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {weather.temp}°
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                {capitalize(weather.description)}
              </div>
            </div>
          </div>

          {/* Detail pills */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <span style={detailPill}>відч. {weather.feels_like}°</span>
            <span style={detailPill}>💧 {weather.humidity}%</span>
            <span style={detailPill}>💨 {weather.wind} м/с</span>
          </div>

          {/* 5-day forecast */}
          <div style={{ height: '1px', background: '#f0f4ff', marginBottom: '12px' }} />
          {forecast ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px' }}>
              {forecast.map(day => (
                <div key={day.date} style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '4px', fontWeight: '500', letterSpacing: '0.02em' }}>
                    {day.weekday}
                  </div>
                  <div style={{ fontSize: '16px', lineHeight: 1, marginBottom: '4px' }}>{weatherIcon(day.code)}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#1e3a5f' }}>{day.temp_max}°</div>
                  <div style={{ fontSize: '10px', color: '#b0bec5' }}>{day.temp_min}°</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', padding: '4px 0' }}>
              Завантаження...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const calNavBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '16px',
  color: '#64748b',
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: '6px',
  lineHeight: 1,
  transition: 'background 0.15s, color 0.15s',
};

// ── Component ─────────────────────────────────────────────────────────────────

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
          padding: '1rem 1rem 0.875rem',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderBottom: '1px solid #f0f0f0',
          minHeight: isSmallScreen ? '64px' : 'auto',
        }}>
          <style dangerouslySetInnerHTML={{ __html: `
            .itrcrm-logo { cursor: default; transition: transform 0.3s ease; }
            .itrcrm-logo:hover { transform: scale(1.04); }
            .itrcrm-logo:hover .logo-dot { animation: logoPulse 1.2s ease-in-out infinite; }
            .itrcrm-logo:hover .logo-letters { filter: drop-shadow(0 2px 8px rgba(37,99,235,0.25)); }
            .itrcrm-logo:hover .logo-accent { animation: logoShift 0.6s ease forwards; }
            @keyframes logoPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.4); } }
            @keyframes logoShift { 0% { transform: translateX(0); } 100% { transform: translateX(2px); } }
          `}} />
          <div className="itrcrm-logo" style={{ display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
            {/* Icon mark */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
              <rect width="32" height="32" rx="9" fill="url(#logoGrad)" />
              <path d="M9 11h14M9 16h10M9 21h7" stroke="white" strokeWidth="2.2" strokeLinecap="round" className="logo-accent" />
              <circle cx="24" cy="21" r="3" fill="white" opacity="0.9" className="logo-dot" />
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
            </svg>
            {/* Text */}
            <div className="logo-letters" style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1, transition: 'filter 0.3s ease' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                ITR
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb', letterSpacing: '-0.02em', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                CRM
              </span>
            </div>
          </div>
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

          {/* Files section */}
          <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '16px 12px' }} />
          {(() => {
            const Icon = filesMenuItem.icon;
            const isActive = pathname === filesMenuItem.href;
            return (
              <TransitionLink
                href={filesMenuItem.href}
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
                {t(filesMenuItem.labelKey)}
              </TransitionLink>
            );
          })()}
          <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '16px 12px' }} />

          {/* Reports */}
          {reportsMenuItems.map((item) => {
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

        </nav>

        {/* Date / time / weather widget */}
        <SidebarInfoWidget />

      </aside>
    </>
  );
}
