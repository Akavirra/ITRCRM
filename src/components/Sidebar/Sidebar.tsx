'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
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

  // --- Interactive robot logo ---
  const logoRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [robotEmotion, setRobotEmotion] = useState<string | null>(null);
  const [hasNotifications, setHasNotifications] = useState(false);
  const [hasBirthday, setHasBirthday] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const lastMoveRef = useRef(Date.now());
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seasonal detection
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  const hour = now.getHours();
  const isNight = hour >= 22 || hour < 6;
  const isNewYear = (month === 12 && day >= 20) || (month === 1 && day <= 7);
  const isHalloween = month === 10 && day >= 25 && day <= 31;
  const isSep1 = month === 9 && day >= 1 && day <= 3;
  // Easter approximate (for 2026: April 12, show April 5-19; for 2027: May 2)
  const isEaster = (month === 4 && day >= 5 && day <= 19) || (month === 5 && day >= 1 && day <= 5);

  // Poll unread notifications + birthdays
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/notifications?count=true');
        if (res.ok) {
          const data = await res.json();
          setHasNotifications((data.unreadCount ?? 0) > 0);
          setHasBirthday(!!data.hasBirthday);
        }
      } catch {}
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Eyes follow mouse + idle sleep detection
  const handleMouseMove = useCallback((e: MouseEvent) => {
    lastMoveRef.current = Date.now();
    if (isSleeping) setIsSleeping(false);

    if (!logoRef.current) return;
    const rect = logoRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxShift = 2.5;
    const factor = Math.min(dist / 200, 1);
    setEyeOffset({
      x: (dx / (dist || 1)) * maxShift * factor,
      y: (dy / (dist || 1)) * maxShift * factor,
    });
  }, [isSleeping]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // Idle sleep after 30s of no mouse movement
  useEffect(() => {
    const checkIdle = () => {
      if (Date.now() - lastMoveRef.current > 30_000) {
        setIsSleeping(true);
      }
    };
    const interval = setInterval(checkIdle, 5_000);
    return () => clearInterval(interval);
  }, []);

  // Idle blink every 3-5s (not when sleeping)
  useEffect(() => {
    const blink = () => {
      if (!isSleeping) {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 200);
      }
    };
    const schedule = () => {
      const delay = 3000 + Math.random() * 2000;
      return setTimeout(() => { blink(); timerId = schedule(); }, delay);
    };
    let timerId = schedule();
    return () => clearTimeout(timerId);
  }, [isSleeping]);

  // Click = random emotion
  const emotions = [
    { name: 'love', eyeShape: '❤', color: '#f43f5e' },
    { name: 'star', eyeShape: '★', color: '#eab308' },
    { name: 'happy', eyeShape: '◡', color: 'white' },
    { name: 'surprise', eyeShape: '○', color: 'white' },
    { name: 'wink', eyeShape: '−', color: 'white' },
  ];

  const playBeep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.1;
      osc.start();
      osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.1);
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.2);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, []);

  const handleRobotClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSleeping) {
      setIsSleeping(false);
      lastMoveRef.current = Date.now();
      return;
    }
    const emotion = emotions[Math.floor(Math.random() * emotions.length)];
    setRobotEmotion(emotion.name);
    setTimeout(() => setRobotEmotion(null), 1200);
  }, [isSleeping]);

  // Double click = beep + speech bubble
  const bubbles = ['Біп-боп!', 'Привіт! 👋', 'Я робот! 🤖', 'Працюємо! 💪', '01100001'];
  const handleRobotDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    playBeep();
    const msg = bubbles[Math.floor(Math.random() * bubbles.length)];
    setSpeechBubble(msg);
    setTimeout(() => setSpeechBubble(null), 2000);
  }, [playBeep]);

  const getEyeContent = (side: 'l' | 'r') => {
    if (!robotEmotion) return null;
    const em = emotions.find(e => e.name === robotEmotion);
    if (!em) return null;
    const cx = side === 'l' ? 16.5 : 27.5;
    const cy = 20;
    if (em.name === 'wink' && side === 'l') return null;
    return (
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill={em.color}
        fontSize="7"
        style={{ pointerEvents: 'none' }}
      >
        {em.eyeShape}
      </text>
    );
  };

  // Halloween eye color
  const getEyeFill = () => {
    if (isHalloween) return '#f97316';
    return '#1e293b';
  };

  // Seasonal accessory SVG
  const renderAccessory = () => {
    // Birthday party hat
    if (hasBirthday) return (
      <g style={{ transformOrigin: '22px 0px' }}>
        <polygon points="22,0 15,10 29,10" fill="#f43f5e" />
        <polygon points="22,0 18,6 26,6" fill="#fb923c" opacity="0.6" />
        <circle cx="22" cy="-1" r="2" fill="#eab308" />
      </g>
    );
    // New Year — Santa hat
    if (isNewYear) return (
      <g>
        <path d="M10,12 Q22,-4 34,12" fill="#dc2626" />
        <path d="M10,12 Q22,-2 34,12" fill="#dc2626" />
        <rect x="8" y="10" width="28" height="4" rx="2" fill="white" />
        <circle cx="32" cy="0" r="3" fill="white" />
      </g>
    );
    // Halloween — pumpkin beside robot (rendered separately)
    // Sep 1 — graduation cap
    if (isSep1) return (
      <g>
        <rect x="10" y="5" width="24" height="3" rx="1" fill="#1e293b" />
        <rect x="16" y="2" width="12" height="5" rx="1" fill="#1e293b" />
        <line x1="22" y1="2" x2="22" y2="-1" stroke="#eab308" strokeWidth="1.5" />
        <rect x="20" y="-2" width="4" height="2" rx="0.5" fill="#eab308" />
      </g>
    );
    // Easter — bunny ears
    if (isEaster) return (
      <g>
        <ellipse cx="14" cy="2" rx="3.5" ry="8" fill="#fecdd3" />
        <ellipse cx="14" cy="2" rx="2" ry="6" fill="#fda4af" />
        <ellipse cx="30" cy="2" rx="3.5" ry="8" fill="#fecdd3" />
        <ellipse cx="30" cy="2" rx="2" ry="6" fill="#fda4af" />
      </g>
    );
    return null;
  };

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
            .itrcrm-logo { transition: transform 0.3s ease; }
            .itrcrm-logo:hover { transform: scale(1.03); }
            .itrcrm-logo:hover .logo-icon { filter: drop-shadow(0 3px 10px rgba(37,99,235,0.35)); }
            .itrcrm-logo:hover .logo-antenna { animation: logoWiggle 0.6s ease; transform-origin: 50% 100%; }
            .itrcrm-logo:hover .logo-letters { filter: drop-shadow(0 2px 6px rgba(37,99,235,0.2)); }
            @keyframes logoWiggle { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(12deg); } 75% { transform: rotate(-8deg); } }
            .robot-emotion { animation: emotionPop 0.4s ease; }
            @keyframes emotionPop { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
            .logo-antenna-pulse .logo-antenna-tip { animation: antennaPulse 1.5s ease-in-out infinite; }
            @keyframes antennaPulse { 0%,100% { fill: #60a5fa; filter: drop-shadow(0 0 2px #60a5fa); } 50% { fill: #f59e0b; filter: drop-shadow(0 0 8px #f59e0b); } }
            .robot-sleeping .logo-icon { filter: brightness(0.85); transition: filter 1s ease; }
            .robot-zzz { animation: zzzFloat 2s ease-in-out infinite; }
            @keyframes zzzFloat { 0% { opacity: 0; transform: translate(0,0) scale(0.5); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(6px,-12px) scale(1.1); } }
            .robot-speech { animation: speechIn 0.3s ease; position: absolute; top: -8px; right: -12px; background: white; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 3px 8px; font-size: 11px; font-weight: 600; color: #334155; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 10; pointer-events: none; }
            @keyframes speechIn { 0% { opacity: 0; transform: scale(0.5) translateY(4px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
            .robot-night .logo-icon { filter: brightness(0.7) saturate(0.7); }
          `}} />
          <TransitionLink
            href="/dashboard"
            onClick={isSmallScreen ? onClose : undefined}
            style={{ textDecoration: 'none' }}
          >
            <div
              ref={logoRef}
              className={`itrcrm-logo${isSleeping ? ' robot-sleeping' : ''}${isNight ? ' robot-night' : ''}`}
              onClick={handleRobotClick}
              onDoubleClick={handleRobotDoubleClick}
              style={{ display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none', cursor: 'pointer', padding: '4px 0', position: 'relative' }}
            >
              {/* Speech bubble */}
              {speechBubble && <div className="robot-speech">{speechBubble}</div>}
              {/* Robot icon */}
              <svg className="logo-icon" width="52" height="52" viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0, transition: 'filter 0.3s ease' }}>
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="44" y2="44">
                    <stop offset="0%" stopColor={isNight ? '#1e3a5f' : '#3b82f6'} />
                    <stop offset="100%" stopColor={isNight ? '#0f172a' : '#1d4ed8'} />
                  </linearGradient>
                </defs>
                {/* Seasonal accessory (behind antenna) */}
                {renderAccessory()}
                {/* Antenna */}
                <g className={`logo-antenna${hasNotifications ? ' logo-antenna-pulse' : ''}`}>
                  <line x1="22" y1="4" x2="22" y2="10" stroke={isNight ? '#1e40af' : '#3b82f6'} strokeWidth="2" strokeLinecap="round" />
                  <circle className="logo-antenna-tip" cx="22" cy="3" r="2.5" fill={isNight ? '#3b82f6' : '#60a5fa'} />
                </g>
                {/* Head */}
                <rect x="6" y="10" width="32" height="24" rx="7" fill="url(#logoGrad)" />
                {/* Screen / face area */}
                <rect x="10" y="14" width="24" height="12" rx="4" fill={isNight ? 'white' : 'white'} opacity={isNight ? 0.1 : 0.2} />
                {/* Eyes — white sclera */}
                <rect x="13" y="16" width="7" height="8" rx="3.5" fill="white" opacity={isSleeping ? 0.5 : 1} />
                <rect x="24" y="16" width="7" height="8" rx="3.5" fill="white" opacity={isSleeping ? 0.5 : 1} />
                {/* Sleeping — closed eyes (horizontal lines) */}
                {isSleeping && !robotEmotion && (
                  <>
                    <line x1="14" y1="20" x2="19" y2="20" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="25" y1="20" x2="30" y2="20" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                  </>
                )}
                {/* Pupils — follow mouse (not when sleeping) */}
                {!robotEmotion && !isSleeping && (
                  <>
                    <circle
                      cx={16.5 + eyeOffset.x}
                      cy={20 + eyeOffset.y}
                      r="2.2"
                      fill={getEyeFill()}
                      style={{
                        transition: 'cx 0.08s ease, cy 0.08s ease',
                        transform: isBlinking ? 'scaleY(0.1)' : 'scaleY(1)',
                        transformOrigin: '16.5px 20px',
                      }}
                    />
                    <circle
                      cx={27.5 + eyeOffset.x}
                      cy={20 + eyeOffset.y}
                      r="2.2"
                      fill={getEyeFill()}
                      style={{
                        transition: 'cx 0.08s ease, cy 0.08s ease',
                        transform: isBlinking ? 'scaleY(0.1)' : 'scaleY(1)',
                        transformOrigin: '27.5px 20px',
                      }}
                    />
                  </>
                )}
                {/* Emotion overlay */}
                {robotEmotion && (
                  <g className="robot-emotion">
                    {getEyeContent('l')}
                    {getEyeContent('r')}
                  </g>
                )}
                {/* Zzz when sleeping */}
                {isSleeping && (
                  <>
                    <text className="robot-zzz" x="33" y="10" fontSize="7" fill="#94a3b8" fontWeight="bold">z</text>
                    <text className="robot-zzz" x="36" y="5" fontSize="5" fill="#94a3b8" fontWeight="bold" style={{ animationDelay: '0.7s' }}>z</text>
                    <text className="robot-zzz" x="38" y="1" fontSize="4" fill="#94a3b8" fontWeight="bold" style={{ animationDelay: '1.4s' }}>z</text>
                  </>
                )}
                {/* Halloween pumpkin */}
                {isHalloween && (
                  <g transform="translate(35, 28)">
                    <circle cx="4" cy="4" r="5" fill="#f97316" />
                    <rect x="3" y="-2" width="2" height="3" rx="0.5" fill="#65a30d" />
                    <path d="M1.5,3 L2.5,4.5 L3.5,3" fill="#1e293b" />
                    <path d="M4.5,3 L5.5,4.5 L6.5,3" fill="#1e293b" />
                    <path d="M2,6 Q4,7.5 6,6" stroke="#1e293b" strokeWidth="0.8" fill="none" />
                  </g>
                )}
                {/* Ears / connectors */}
                <rect x="2" y="18" width="4" height="8" rx="2" fill="#93c5fd" />
                <rect x="38" y="18" width="4" height="8" rx="2" fill="#93c5fd" />
                {/* Bottom — gear teeth */}
                <rect x="14" y="34" width="4" height="4" rx="1" fill="#93c5fd" />
                <rect x="20" y="34" width="4" height="4" rx="1" fill="#93c5fd" />
                <rect x="26" y="34" width="4" height="4" rx="1" fill="#93c5fd" />
              </svg>
              {/* Text */}
              <div className="logo-letters" style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1, transition: 'filter 0.3s ease', gap: 2 }}>
                <span style={{ fontSize: '1.625rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                  ITR
                </span>
                <span style={{ fontSize: '1.625rem', fontWeight: 800, color: '#2563eb', letterSpacing: '-0.02em', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                  CRM
                </span>
              </div>
            </div>
          </TransitionLink>
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
