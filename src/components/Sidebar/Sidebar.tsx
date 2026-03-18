'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
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

const adminMenuItems = [
  { href: '/users', labelKey: 'nav.users', icon: Settings },
];

// ── Date/time widget ──────────────────────────────────────────────────────────

const DAYS_UK = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\u2019ятниця', 'Субота'];
const DAYS_SHORT_UK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTHS_UK = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const MONTHS_FULL_UK = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  // Convert to Mon-first: Mon=0 … Sun=6
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function DateTimeWidget() {
  const [now, setNow] = useState<Date | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calYear, setCalYear] = useState(0);
  const [calMonth, setCalMonth] = useState(0);

  useEffect(() => {
    const d = new Date();
    setNow(d);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Close calendar on outside click
  useEffect(() => {
    if (!calOpen) return;
    const handler = (e: MouseEvent) => {
      const el = document.getElementById('dt-widget-root');
      if (el && !el.contains(e.target as Node)) setCalOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calOpen]);

  if (!now) return null;

  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const day = DAYS_UK[now.getDay()];
  const date = `${now.getDate()} ${MONTHS_UK[now.getMonth()]}`;

  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const cells = buildCalendarDays(calYear, calMonth);

  return (
    <div id="dt-widget-root" style={{ margin: '0 12px 14px', flexShrink: 0, position: 'relative' }}>
      {/* Main widget card */}
      <div style={{
        padding: '14px 16px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
        border: '1px solid rgba(59,130,246,0.1)',
      }}>
        {/* Clock */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', lineHeight: 1, marginBottom: '8px' }}>
          <span style={{ fontSize: '26px', fontWeight: '300', color: '#1e3a5f', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
            {h}<span style={{ opacity: 0.4, margin: '0 1px' }}>:</span>{m}
          </span>
          <span style={{ fontSize: '13px', fontWeight: '400', color: '#94a3b8', marginLeft: '3px', fontVariantNumeric: 'tabular-nums' }}>
            {s}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(59,130,246,0.08)', marginBottom: '8px' }} />

        {/* Day + date (date is clickable) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#3b82f6', letterSpacing: '0.02em' }}>
            {day}
          </span>
          <button
            onClick={() => {
              if (!calOpen) { setCalYear(todayY); setCalMonth(todayM); }
              setCalOpen(o => !o);
            }}
            style={{
              fontSize: '12px',
              color: calOpen ? '#3b82f6' : '#94a3b8',
              fontWeight: '400',
              background: 'none',
              border: 'none',
              padding: '2px 6px',
              margin: '-2px -6px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'color 0.15s, background 0.15s',
              backgroundColor: calOpen ? 'rgba(59,130,246,0.08)' : 'transparent',
            }}
            onMouseOver={e => { if (!calOpen) (e.currentTarget.style.color = '#3b82f6'); }}
            onMouseOut={e => { if (!calOpen) (e.currentTarget.style.color = '#94a3b8'); }}
          >
            {date}
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
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button onClick={prevMonth} style={calNavBtn}>‹</button>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e3a5f', letterSpacing: '0.02em' }}>
              {MONTHS_FULL_UK[calMonth]} {calYear}
            </span>
            <button onClick={nextMonth} style={calNavBtn}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {DAYS_SHORT_UK.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: '600', color: '#94a3b8', padding: '2px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {cells.map((day, i) => {
              const isToday = day !== null && day === todayD && calMonth === todayM && calYear === todayY;
              const isWeekend = i % 7 >= 5; // Сб(5), Нд(6)
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
          padding: '1rem', 
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderBottom: '1px solid #f5f5f5',
          minHeight: isSmallScreen ? '64px' : 'auto',
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

          {user.role === 'admin' && (
            <>
              <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '16px 12px' }} />
              {adminMenuItems.map((item) => {
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
            </>
          )}
        </nav>

        {/* Date/time widget */}
        <DateTimeWidget />

      </aside>
    </>
  );
}
