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
  FolderOpen,
  Wallet,
  FileText,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  Zap,
  EyeOff,
  Gift,
  Flag
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
  { href: '/payments', labelKey: 'nav.payments', icon: Wallet },
  { href: '/enrollment', labelKey: 'nav.enrollment', icon: FileText },
];

const filesMenuItem = { href: '/materials', labelKey: 'nav.materials', icon: FolderOpen };

const reportsMenuItems = [
  { href: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
];


// ── Combined date/time + weather widget ───────────────────────────────────────

const DAYS_UK = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\u2019ятниця', 'Субота'];
const DAYS_SHORT_UK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTHS_UK = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_FULL_UK = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

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

interface SidebarHolidayEvent {
  date: string;
  name: string;
  category: 'state' | 'religious';
  dayDiff: number;
  label: string;
}

interface SidebarBirthdayEvent {
  id: number;
  full_name: string;
  birth_date: string;
  next_birthday: string;
  dayDiff: number;
  age: number;
  ageLabel: string;
  label: string;
}

interface SidebarEventsData {
  today: string;
  holidaysToday: SidebarHolidayEvent[];
  upcomingHolidays: SidebarHolidayEvent[];
  birthdaysToday: SidebarBirthdayEvent[];
  upcomingBirthdays: SidebarBirthdayEvent[];
  calendarHolidays: SidebarHolidayEvent[];
  calendarBirthdays: SidebarBirthdayEvent[];
}

interface SeasonalUiState {
  isNight: boolean;
  isNewYear: boolean;
  isHalloween: boolean;
  isSep1: boolean;
  isEaster: boolean;
}

function getSeasonalUiState(date: Date = new Date()): SeasonalUiState {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const hour = date.getHours();

  return {
    isNight: hour >= 22 || hour < 6,
    isNewYear: (month === 12 && day >= 20) || (month === 1 && day <= 7),
    isHalloween: month === 10 && day >= 25 && day <= 31,
    isSep1: month === 9 && day >= 1 && day <= 3,
    // Easter approximate (for 2026: April 12, show April 5-19; for 2027: May 2)
    isEaster: (month === 4 && day >= 5 && day <= 19) || (month === 5 && day >= 1 && day <= 5),
  };
}

const detailPill: React.CSSProperties = {
  fontSize: '10px',
  color: '#64748b',
  background: '#f0f7ff',
  borderRadius: '6px',
  padding: '2px 7px',
  whiteSpace: 'nowrap',
};

function weatherIcon(code: number, size: number = 18): JSX.Element {
  const iconProps = { size };

  if (code >= 200 && code < 300) return <Zap {...iconProps} />;
  if (code >= 300 && code < 400) return <CloudRain {...iconProps} />;
  if (code >= 500 && code < 600) return <CloudRain {...iconProps} />;
  if (code >= 600 && code < 700) return <CloudSnow {...iconProps} />;
  if (code >= 700 && code < 800) return <EyeOff {...iconProps} />;
  if (code === 800) return <Sun {...iconProps} />;
  if (code === 801) return <Sun {...iconProps} />;
  if (code === 802) return <Cloud {...iconProps} />;
  return <Cloud {...iconProps} />;
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

function eventWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'подій';
  if (mod10 === 1) return 'подія';
  if (mod10 >= 2 && mod10 <= 4) return 'події';
  return 'подій';
}

function padDateValue(value: number): string {
  return String(value).padStart(2, '0');
}

function buildCalendarTooltip(
  holidays: SidebarHolidayEvent[],
  birthdays: SidebarBirthdayEvent[]
): string {
  const holidayLines = holidays.map((holiday) => `Свято: ${holiday.name}`);
  const birthdayLines = birthdays.map((birthday) => `День народження: ${birthday.full_name} (${birthday.ageLabel})`);
  return [...holidayLines, ...birthdayLines].join('\n');
}

// divider removed for minimalist design

function SidebarInfoWidget({ isCompact = false }: { isCompact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calYear, setCalYear] = useState(0);
  const [calMonth, setCalMonth] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [events, setEvents] = useState<SidebarEventsData | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);
  const weatherBtnRef = useRef<HTMLButtonElement>(null);
  const weatherPopRef = useRef<HTMLDivElement>(null);
  const [weatherPopPos, setWeatherPopPos] = useState({ left: 0, bottom: 20 });
  const loadEvents = useCallback((year: number, month: number) => {
    fetch(`/api/sidebar/events?year=${year}&month=${month + 1}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setEvents(d))
      .catch(() => { });
  }, []);

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
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (calYear < 1000) return;
    loadEvents(calYear, calMonth);
    const id = setInterval(() => loadEvents(calYear, calMonth), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [calMonth, calYear, loadEvents]);

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

  useEffect(() => {
    if (!eventsOpen) return;
    const handler = (e: MouseEvent) => {
      const el = document.getElementById('sidebar-info-widget');
      if (el && !el.contains(e.target as Node)) setEventsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [eventsOpen]);

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
  const totalEventsToday = (events?.holidaysToday.length ?? 0) + (events?.birthdaysToday.length ?? 0);
  const nextHoliday = events?.upcomingHolidays[0] ?? null;
  const nextBirthday = events?.upcomingBirthdays[0] ?? null;
  const hasEventSummary = totalEventsToday > 0 || nextHoliday || nextBirthday;
  const holidayDates = new Set([
    ...(events?.calendarHolidays.map((holiday) => holiday.date) ?? []),
  ]);
  const birthdayDates = new Set([
    ...(events?.calendarBirthdays.map((birthday) => birthday.next_birthday) ?? []),
  ]);
  const calendarEventsByDate = new Map<string, { holidays: SidebarHolidayEvent[]; birthdays: SidebarBirthdayEvent[] }>();

  for (const holiday of events?.calendarHolidays ?? []) {
    const existing = calendarEventsByDate.get(holiday.date) ?? { holidays: [], birthdays: [] };
    existing.holidays.push(holiday);
    calendarEventsByDate.set(holiday.date, existing);
  }

  for (const birthday of events?.calendarBirthdays ?? []) {
    const existing = calendarEventsByDate.get(birthday.next_birthday) ?? { holidays: [], birthdays: [] };
    existing.birthdays.push(birthday);
    calendarEventsByDate.set(birthday.next_birthday, existing);
  }

  let eventSummary = 'Подій немає';
  if (totalEventsToday > 0) {
    eventSummary = `${totalEventsToday} ${eventWord(totalEventsToday)} сьогодні`;
  } else if (nextHoliday) {
    eventSummary = `${nextHoliday.label}: ${nextHoliday.name}`;
  } else if (nextBirthday) {
    eventSummary = `${nextBirthday.label}: день народження`;
  }

  const handleWeatherClick = () => {
    if (!weatherOpen && weatherBtnRef.current) {
      const sidebar = weatherBtnRef.current.closest('aside');
      const right = sidebar?.getBoundingClientRect().right ?? weatherBtnRef.current.getBoundingClientRect().right;
      setWeatherPopPos({ left: right + 12, bottom: 20 });
      if (!forecast) {
        fetch('/api/weather/forecast')
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(d => setForecast(d.days))
          .catch(() => { });
      }
    }
    setWeatherOpen(o => !o);
  };

  // Generate dynamic styles based on time & weather
  const getWidgetTheme = () => {
    const bg = 'linear-gradient(135deg, rgba(248, 250, 252, 0.85) 0%, rgba(241, 245, 249, 0.5) 100%)';
    const borderColor = 'rgba(226, 232, 240, 0.6)';
    const shadow = '0 4px 16px -4px rgba(15, 23, 42, 0.04)';
    return { bg, borderColor, shadow };
  };

  const widgetTheme = getWidgetTheme();

  if (isCompact) {
    return (
      <div
        id="sidebar-info-widget"
        style={{
          margin: '0 12px',
          flexShrink: 0,
          position: 'relative',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '16px',
            background: widgetTheme.bg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: `${widgetTheme.shadow}, inset 0 0 0 1px ${widgetTheme.borderColor}`,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            transition: 'background 1s ease, box-shadow 1s ease',
          }}
        >
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span
              style={{
                fontSize: '20px',
                fontWeight: '300',
                color: '#0f172a',
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {h}:{m}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '500',
                color: '#64748b',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {dayName}, {dateStr}
            </span>
          </div>

          {weather ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0,
                padding: '6px 8px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.45)',
              }}
            >
              <span style={{ lineHeight: 1, color: '#3b82f6' }}>{weatherIcon(weather.code, 16)}</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0f172a',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {weather.temp}°
                </span>
                <span style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1 }}>
                  {weather.city}
                </span>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0 }}>
              --
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="sidebar-info-widget" style={{ margin: '0 12px 12px', flexShrink: 0, position: 'relative' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes weatherFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.1); }
        }
        .weather-btn-hover:hover .weather-icon-anim {
          animation: weatherFloat 2s ease-in-out infinite;
          display: inline-block;
        }
      `}} />
      <div style={{
        padding: '10px 14px 9px',
        borderRadius: '18px',
        background: widgetTheme.bg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: `${widgetTheme.shadow}, inset 0 0 0 1px ${widgetTheme.borderColor}`,
        border: 'none',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gridTemplateRows: 'auto auto auto',
        rowGap: '2px',
        columnGap: '8px',
        alignItems: 'center',
        transition: 'background 1s ease, box-shadow 1s ease',
      }}>
        {/* Time — left, row 1 */}
        <div style={{ gridColumn: 1, gridRow: 1, display: 'flex', alignItems: 'baseline', gap: '3px' }}>
          <span style={{ fontSize: '22px', fontWeight: '300', color: '#0f172a', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {h}<span style={{ opacity: 0.3, margin: '0 1px' }}>:</span>{m}
          </span>
          <span style={{ fontSize: '9px', fontWeight: '400', color: '#94a3b8', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {s}
          </span>
        </div>

        {/* Weather — right, spans row 1+2 */}
        {weather ? (
          <button
            className="weather-btn-hover"
            ref={weatherBtnRef}
            onClick={handleWeatherClick}
            style={{
              gridColumn: 2,
              gridRow: '1 / 3',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1px',
              background: weatherOpen ? 'rgba(255, 255, 255, 0.6)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 8px',
              margin: '-6px -8px',
              borderRadius: '12px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: weatherOpen ? 1 : 0.85,
              flexShrink: 0,
            }}
            onMouseOver={e => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.opacity = weatherOpen ? '1' : '0.85';
              e.currentTarget.style.background = weatherOpen ? 'rgba(255, 255, 255, 0.6)' : 'transparent';
            }}
          >
            <span className="weather-icon-anim" style={{ lineHeight: 1, willChange: 'transform' }}>{weatherIcon(weather.code, 18)}</span>
            <span style={{ fontSize: '12px', fontWeight: '400', color: '#0f172a', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {weather.temp}°
            </span>
          </button>
        ) : <span style={{ gridColumn: 2, gridRow: '1 / 3' }} />}

        {/* Day + Date — left, row 2 */}
        <div style={{ gridColumn: 1, gridRow: 2, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: '500', color: '#3b82f6', lineHeight: 1 }}>
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
              padding: 0,
              lineHeight: 1,
              cursor: 'pointer',
              transition: 'color 0.2s',
            }}
            onMouseOver={e => { if (!calOpen) (e.currentTarget.style.color = '#0f172a'); }}
            onMouseOut={e => { if (!calOpen) (e.currentTarget.style.color = calOpen ? '#3b82f6' : '#94a3b8'); }}
          >
            {dateStr}
          </button>
        </div>

        {/* Events row — full width, row 3 */}
        <button
          onClick={() => setEventsOpen(o => !o)}
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '5px',
            padding: '5px 8px',
            borderRadius: '10px',
            border: 'none',
            background: eventsOpen ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.35)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease',
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)'; }}
          onMouseOut={e => { e.currentTarget.style.background = eventsOpen ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.35)'; }}
        >
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '999px',
            background: totalEventsToday > 0 ? '#f97316' : hasEventSummary ? '#3b82f6' : '#cbd5e1',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: '10.5px',
            fontWeight: '500',
            color: totalEventsToday > 0 ? '#0f172a' : '#64748b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {eventSummary}
          </span>
        </button>
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
              const dateKey = day === null
                ? null
                : `${calYear}-${padDateValue(calMonth + 1)}-${padDateValue(day)}`;
              const hasHoliday = dateKey ? holidayDates.has(dateKey) : false;
              const hasBirthday = dateKey ? birthdayDates.has(dateKey) : false;
              const tooltipText = dateKey
                ? buildCalendarTooltip(
                    calendarEventsByDate.get(dateKey)?.holidays ?? [],
                    calendarEventsByDate.get(dateKey)?.birthdays ?? []
                  )
                : '';
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
                  position: 'relative',
                  cursor: tooltipText ? 'help' : 'default',
                }}>
                  <span title={tooltipText || undefined}>
                    {day ?? ''}
                  </span>
                  {day !== null && (hasHoliday || hasBirthday) && (
                    <span style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: '1px',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}>
                      {hasHoliday && (
                        <span style={{
                          width: '4px',
                          height: '4px',
                          borderRadius: '999px',
                          background: isToday ? 'rgba(255,255,255,0.95)' : '#2563eb',
                        }} />
                      )}
                      {hasBirthday && (
                        <span style={{
                          width: '4px',
                          height: '4px',
                          borderRadius: '999px',
                          background: isToday ? 'rgba(255,255,255,0.75)' : '#f97316',
                        }} />
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '8px', fontSize: '9px', color: '#94a3b8' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '999px', background: '#2563eb' }} />
              Свято
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '999px', background: '#f97316' }} />
              День народження
            </span>
          </div>
        </div>
      )}

      {eventsOpen && (
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
          zIndex: 55,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Сьогодні
            </div>
            {events && totalEventsToday > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {events.holidaysToday.map((holiday) => (
                  <div key={`holiday-today-${holiday.date}-${holiday.name}`} style={eventCardStyle}>
                    <Flag size={14} color="#2563eb" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={eventTitleStyle}>{holiday.name}</div>
                      <div style={eventMetaStyle}>Свято України</div>
                    </div>
                  </div>
                ))}
                {events.birthdaysToday.map((birthday) => (
                  <TransitionLink
                    key={`birthday-today-${birthday.id}`}
                    href={`/students/${birthday.id}`}
                    style={{ ...eventCardStyle, textDecoration: 'none' }}
                  >
                    <Gift size={14} color="#f97316" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={eventTitleStyle}>{birthday.full_name}</div>
                      <div style={eventMetaStyle}>{birthday.ageLabel}</div>
                    </div>
                  </TransitionLink>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                На сьогодні подій немає
              </div>
            )}
          </div>

          {events && (events.upcomingHolidays.length > 0 || events.upcomingBirthdays.length > 0) && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Найближчі
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {events.upcomingHolidays.slice(0, 3).map((holiday) => (
                  <div key={`holiday-upcoming-${holiday.date}-${holiday.name}`} style={eventCardStyle}>
                    <Flag size={14} color="#2563eb" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={eventTitleStyle}>{holiday.name}</div>
                      <div style={eventMetaStyle}>{holiday.label}</div>
                    </div>
                  </div>
                ))}
                {events.upcomingBirthdays.slice(0, 4).map((birthday) => (
                  <TransitionLink
                    key={`birthday-upcoming-${birthday.id}`}
                    href={`/students/${birthday.id}`}
                    style={{ ...eventCardStyle, textDecoration: 'none' }}
                  >
                    <Gift size={14} color="#f97316" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={eventTitleStyle}>{birthday.full_name}</div>
                      <div style={eventMetaStyle}>{birthday.label} · {birthday.ageLabel}</div>
                    </div>
                  </TransitionLink>
                ))}
              </div>
            </div>
          )}
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
            <span style={{ lineHeight: 1 }}>{weatherIcon(weather.code, 40)}</span>
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
                  <div style={{ lineHeight: 1, marginBottom: '4px' }}>{weatherIcon(day.code, 16)}</div>
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

const eventCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
  padding: '8px 9px',
  borderRadius: '10px',
  background: '#f8fafc',
  border: '1px solid #eef2ff',
};

const eventTitleStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: '600',
  color: '#0f172a',
  lineHeight: 1.35,
  wordBreak: 'break-word',
};

const eventMetaStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#64748b',
  marginTop: '2px',
  lineHeight: 1.3,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar({ user, isOpen, onClose, isMobile = false, isTablet = false }: SidebarProps) {
  const pathname = usePathname();

  const isSmallScreen = isMobile || isTablet;
  const mobileNavbarHeight = isMobile ? 56 : 64;

  // --- Interactive robot logo ---
  const logoRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [robotEmotion, setRobotEmotion] = useState<string | null>(null);
  const [hasNotifications, setHasNotifications] = useState(false);
  const [hasBirthday, setHasBirthday] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [nightLampOn, setNightLampOn] = useState(false);
  const [birthdayParty, setBirthdayParty] = useState(false);
  const [newYearParty, setNewYearParty] = useState(false);
  const [halloweenParty, setHalloweenParty] = useState(false);
  const [sep1Party, setSep1Party] = useState(false);
  const [easterParty, setEasterParty] = useState(false);
  const [seasonalUi, setSeasonalUi] = useState<SeasonalUiState>({
    isNight: false,
    isNewYear: false,
    isHalloween: false,
    isSep1: false,
    isEaster: false,
  });
  const lastMoveRef = useRef(Date.now());
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isNight, isNewYear, isHalloween, isSep1, isEaster } = seasonalUi;

  useEffect(() => {
    const syncSeasonalUi = () => {
      setSeasonalUi(getSeasonalUiState());
    };

    syncSeasonalUi();
    const interval = window.setInterval(syncSeasonalUi, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  // Sidebar consumes the shared notification state published by the navbar.
  useEffect(() => {
    const handleNotificationUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ unreadCount: number; hasBirthday: boolean }>).detail;
      setHasNotifications((detail?.unreadCount ?? 0) > 0);
      setHasBirthday(Boolean(detail?.hasBirthday));
    };

    window.addEventListener('app:notifications-updated', handleNotificationUpdate as EventListener);

    return () => {
      window.removeEventListener('app:notifications-updated', handleNotificationUpdate as EventListener);
    };
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
    { name: 'angry', eyeShape: '🔥', color: '#ef4444' },
    { name: 'dance', eyeShape: '✨', color: '#a855f7' },
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
    } catch { }
  }, []);

  // Happy Birthday melody (first line)
  const playHappyBirthday = useCallback(() => {
    try {
      const ctx = new AudioContext();
      // "Happy birthday to you" notes: G G A G C B
      const notes = [
        { freq: 392, start: 0, dur: 0.25 }, // Hap-
        { freq: 392, start: 0.3, dur: 0.15 }, // py
        { freq: 440, start: 0.5, dur: 0.35 }, // birth-
        { freq: 392, start: 0.9, dur: 0.35 }, // day
        { freq: 523, start: 1.3, dur: 0.35 }, // to
        { freq: 494, start: 1.7, dur: 0.5 }, // you
        // Second line: "Happy birthday to you"
        { freq: 392, start: 2.4, dur: 0.25 },
        { freq: 392, start: 2.7, dur: 0.15 },
        { freq: 440, start: 2.9, dur: 0.35 },
        { freq: 392, start: 3.3, dur: 0.35 },
        { freq: 587, start: 3.7, dur: 0.35 }, // D5
        { freq: 523, start: 4.1, dur: 0.6 }, // C5
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = n.freq;
        gain.gain.setValueAtTime(0.08, ctx.currentTime + n.start);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + n.start + n.dur);
        osc.start(ctx.currentTime + n.start);
        osc.stop(ctx.currentTime + n.start + n.dur + 0.05);
      }
    } catch { }
  }, []);

  // Jingle Bells melody (first two lines)
  const playJingleBells = useCallback(() => {
    try {
      const ctx = new AudioContext();
      // E E E | E E E | E G C D E
      // F F F F | F E E E | E D D E D G
      const n = (f: number, s: number, d: number) => ({ freq: f, start: s, dur: d });
      const E4 = 330, F4 = 349, G4 = 392, C4 = 262, D4 = 294;
      const notes = [
        n(E4,0,0.2), n(E4,0.25,0.2), n(E4,0.5,0.4),
        n(E4,0.95,0.2), n(E4,1.2,0.2), n(E4,1.45,0.4),
        n(E4,1.9,0.2), n(G4,2.15,0.2), n(C4,2.4,0.3), n(D4,2.75,0.15), n(E4,2.95,0.5),
        n(F4,3.6,0.2), n(F4,3.85,0.2), n(F4,4.1,0.2), n(F4,4.35,0.15),
        n(F4,4.55,0.2), n(E4,4.8,0.2), n(E4,5.05,0.15), n(E4,5.25,0.15),
        n(E4,5.45,0.2), n(D4,5.7,0.2), n(D4,5.95,0.2), n(E4,6.2,0.2), n(D4,6.45,0.3), n(G4,6.8,0.5),
      ];
      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(0.07, ctx.currentTime + note.start);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + note.start + note.dur);
        osc.start(ctx.currentTime + note.start);
        osc.stop(ctx.currentTime + note.start + note.dur + 0.05);
      }
    } catch { }
  }, []);

  // Spooky Halloween melody (descending minor + tritone)
  const playHalloweenMelody = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const notes = [
        { freq: 330, start: 0, dur: 0.3 },     // E4
        { freq: 311, start: 0.35, dur: 0.3 },   // Eb4
        { freq: 330, start: 0.7, dur: 0.3 },    // E4
        { freq: 247, start: 1.05, dur: 0.4 },   // B3
        { freq: 311, start: 1.5, dur: 0.3 },    // Eb4
        { freq: 330, start: 1.85, dur: 0.3 },   // E4
        { freq: 247, start: 2.2, dur: 0.15 },   // B3
        { freq: 262, start: 2.4, dur: 0.15 },   // C4
        { freq: 247, start: 2.6, dur: 0.4 },    // B3
        // Low spooky ending
        { freq: 165, start: 3.1, dur: 0.25 },   // E3
        { freq: 175, start: 3.4, dur: 0.25 },   // F3
        { freq: 233, start: 3.7, dur: 0.5 },    // Bb3 (tritone)
        { freq: 165, start: 4.3, dur: 0.7 },    // E3 final
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = n.freq;
        gain.gain.setValueAtTime(0.04, ctx.currentTime + n.start);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + n.start + n.dur);
        osc.start(ctx.currentTime + n.start);
        osc.stop(ctx.currentTime + n.start + n.dur + 0.05);
      }
    } catch { }
  }, []);

  // School bell melody (cheerful ascending)
  const playSchoolBell = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const notes = [
        { freq: 523, start: 0, dur: 0.15 },    // C5
        { freq: 587, start: 0.18, dur: 0.15 },  // D5
        { freq: 659, start: 0.36, dur: 0.15 },  // E5
        { freq: 523, start: 0.54, dur: 0.15 },  // C5
        { freq: 659, start: 0.75, dur: 0.15 },  // E5
        { freq: 587, start: 0.93, dur: 0.15 },  // D5
        { freq: 523, start: 1.15, dur: 0.2 },   // C5
        { freq: 392, start: 1.4, dur: 0.15 },   // G4
        { freq: 523, start: 1.6, dur: 0.15 },   // C5
        { freq: 587, start: 1.78, dur: 0.15 },  // D5
        { freq: 659, start: 1.96, dur: 0.15 },  // E5
        { freq: 784, start: 2.15, dur: 0.4 },   // G5
        // Bell ring
        { freq: 1047, start: 2.7, dur: 0.1 },   // C6
        { freq: 1047, start: 2.85, dur: 0.1 },  // C6
        { freq: 1047, start: 3.0, dur: 0.3 },   // C6 long
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = n.freq >= 1000 ? 'sine' : 'square';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = n.freq;
        gain.gain.setValueAtTime(n.freq >= 1000 ? 0.05 : 0.04, ctx.currentTime + n.start);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + n.start + n.dur);
        osc.start(ctx.currentTime + n.start);
        osc.stop(ctx.currentTime + n.start + n.dur + 0.05);
      }
    } catch { }
  }, []);

  // Easter bells melody (cheerful church bells + spring chime)
  const playEasterBells = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const notes = [
        // Bell chime pattern — ascending joyful
        { freq: 523, start: 0, dur: 0.3, type: 'sine' as OscillatorType },
        { freq: 659, start: 0.25, dur: 0.3, type: 'sine' as OscillatorType },
        { freq: 784, start: 0.5, dur: 0.3, type: 'sine' as OscillatorType },
        { freq: 1047, start: 0.75, dur: 0.5, type: 'sine' as OscillatorType },
        // Pause + repeat lower
        { freq: 784, start: 1.4, dur: 0.25, type: 'sine' as OscillatorType },
        { freq: 659, start: 1.6, dur: 0.25, type: 'sine' as OscillatorType },
        { freq: 784, start: 1.8, dur: 0.25, type: 'sine' as OscillatorType },
        { freq: 1047, start: 2.0, dur: 0.5, type: 'sine' as OscillatorType },
        // Sparkle high notes
        { freq: 1319, start: 2.6, dur: 0.15, type: 'triangle' as OscillatorType },
        { freq: 1568, start: 2.8, dur: 0.15, type: 'triangle' as OscillatorType },
        { freq: 2093, start: 3.0, dur: 0.4, type: 'triangle' as OscillatorType },
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = n.type;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = n.freq;
        const vol = n.freq >= 1300 ? 0.03 : 0.06;
        gain.gain.setValueAtTime(vol, ctx.currentTime + n.start);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + n.start + n.dur);
        osc.start(ctx.currentTime + n.start);
        osc.stop(ctx.currentTime + n.start + n.dur + 0.05);
      }
    } catch { }
  }, []);

  const handleRobotClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSleeping) {
      setIsSleeping(false);
      lastMoveRef.current = Date.now();
      return;
    }
    // Night mode: toggle lamp
    if (isNight) {
      setNightLampOn(prev => !prev);
      return;
    }
    // New Year: toggle party mode
    if (isNewYear) {
      setNewYearParty(prev => {
        if (!prev) {
          playJingleBells();
          setRobotEmotion('star');
        } else {
          setRobotEmotion(null);
        }
        return !prev;
      });
      return;
    }
    // Birthday: toggle party mode
    if (hasBirthday) {
      setBirthdayParty(prev => {
        if (!prev) {
          playHappyBirthday();
          setRobotEmotion('star');
        } else {
          setRobotEmotion(null);
        }
        return !prev;
      });
      return;
    }
    // Halloween: toggle spooky mode
    if (isHalloween) {
      setHalloweenParty(prev => {
        if (!prev) playHalloweenMelody();
        return !prev;
      });
      return;
    }
    // Sep 1: toggle school mode
    if (isSep1) {
      setSep1Party(prev => {
        if (!prev) playSchoolBell();
        return !prev;
      });
      return;
    }
    // Easter: toggle party mode
    if (isEaster) {
      setEasterParty(prev => {
        if (!prev) playEasterBells();
        return !prev;
      });
      return;
    }
    const emotion = emotions[Math.floor(Math.random() * emotions.length)];
    setRobotEmotion(emotion.name);
    setTimeout(() => setRobotEmotion(null), 1200);
  }, [isSleeping, isNight, nightLampOn, isNewYear, playJingleBells, hasBirthday, playHappyBirthday, isHalloween, playHalloweenMelody, isSep1, playSchoolBell, isEaster, playEasterBells]);

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

  // Whether a seasonal accessory replaces the antenna
  const hasAccessoryHat = hasBirthday || isNewYear || isSep1;

  // Seasonal accessory SVG (replaces antenna)
  const renderAccessory = () => {
    // Birthday — big party hat replaces antenna
    if (hasBirthday) return (
      <g className={birthdayParty ? 'hat-shake' : ''}>
        <polygon points="22,-6 12,11 32,11" fill="#f43f5e" />
        <polygon points="22,-6 16,5 28,5" fill="#fb923c" opacity="0.5" />
        <circle cx="22" cy="-7" r="3" fill="#eab308" className={hasNotifications ? 'hat-star-pulse' : ''} style={{ transformOrigin: '22px -7px' }} />
        {/* Confetti dots */}
        <circle cx="15" cy="3" r="1" fill="#eab308" />
        <circle cx="29" cy="5" r="1" fill="#60a5fa" />
        <circle cx="18" cy="7" r="0.8" fill="#a78bfa" />
      </g>
    );
    // New Year — Santa hat with pompom replaces antenna
    if (isNewYear) return (
      <g className={newYearParty ? 'hat-shake' : ''}>
        <path d="M8,12 Q22,-8 36,12" fill="#dc2626" />
        <rect x="6" y="10" width="32" height="5" rx="2.5" fill="white" />
        <circle cx="34" cy="-4" r="4" fill="white" className={hasNotifications && !newYearParty ? 'hat-star-pulse' : ''} style={{ transformOrigin: '34px -4px' }} />
      </g>
    );
    // Sep 1 — graduation cap replaces antenna
    if (isSep1) return (
      <g className={sep1Party ? 'hat-shake' : ''}>
        <polygon points="22,-2 6,7 38,7" fill="#1e293b" />
        <rect x="12" y="7" width="20" height="4" rx="1" fill="#334155" />
        <line x1="32" y1="4" x2="36" y2="9" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="34" y="9" width="5" height="2" rx="1" fill="#eab308" className={hasNotifications ? 'hat-star-pulse' : ''} style={{ transformOrigin: '36.5px 10px' }} />
      </g>
    );
    // Easter — bunny ears (antenna stays)
    if (isEaster) return (
      <g className={easterParty ? 'bunny-wiggle' : ''}>
        <ellipse cx="13" cy="0" rx="4" ry="10" fill="#fecdd3" />
        <ellipse cx="13" cy="0" rx="2.5" ry="7" fill="#fda4af" />
        <ellipse cx="31" cy="0" rx="4" ry="10" fill="#fecdd3" />
        <ellipse cx="31" cy="0" rx="2.5" ry="7" fill="#fda4af" />
      </g>
    );
    return null;
  };

  // Seasonal side item (cake, tree, backpack, basket, pumpkin)
  const renderSideItem = () => {
    if (hasBirthday) return (
      // Birthday cake
      <g transform="translate(40, 24)">
        {/* Cake base */}
        <rect x="0" y="6" width="12" height="8" rx="2" fill="#fbbf24" />
        <rect x="0" y="6" width="12" height="3" rx="1.5" fill="#f472b6" />
        {/* Frosting drip */}
        <circle cx="3" cy="9" r="1" fill="#f472b6" />
        <circle cx="9" cy="10" r="0.8" fill="#f472b6" />
        {/* Candle */}
        <rect x="5" y="2" width="2" height="5" rx="0.5" fill="#60a5fa" />
        {/* Flame */}
        <ellipse cx="6" cy="1" rx="1.5" ry="2" fill="#fb923c" />
        <ellipse cx="6" cy="0.5" rx="0.8" ry="1.2" fill="#fbbf24" />
      </g>
    );
    if (isNewYear) return (
      // Christmas tree
      <g transform="translate(40, 14)">
        {/* Tree layers */}
        <polygon points="7,-2 1,6 13,6" fill="#16a34a" />
        <polygon points="7,2 0,10 14,10" fill="#15803d" />
        <polygon points="7,6 -1,14 15,14" fill="#166534" />
        {/* Trunk */}
        <rect x="5" y="14" width="4" height="4" rx="1" fill="#92400e" />
        {/* Star */}
        <text x="7" y="0" textAnchor="middle" fontSize="5" fill="#eab308">★</text>
        {/* Ornaments */}
        <circle cx="5" cy="5" r="1.2" fill="#dc2626" />
        <circle cx="9" cy="8" r="1.2" fill="#eab308" />
        <circle cx="4" cy="11" r="1.2" fill="#3b82f6" />
      </g>
    );
    if (isSep1) return (
      // School backpack
      <g transform="translate(40, 20)">
        {/* Backpack body */}
        <rect x="1" y="2" width="11" height="14" rx="3" fill="#3b82f6" />
        {/* Front pocket */}
        <rect x="3" y="8" width="7" height="6" rx="2" fill="#2563eb" />
        {/* Pocket flap */}
        <rect x="3" y="7" width="7" height="3" rx="1.5" fill="#1d4ed8" />
        {/* Straps */}
        <line x1="3" y1="2" x2="2" y2="0" stroke="#1e40af" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="2" x2="11" y2="0" stroke="#1e40af" strokeWidth="1.5" strokeLinecap="round" />
        {/* Buckle */}
        <rect x="5.5" y="8.5" width="2" height="1.5" rx="0.5" fill="#fbbf24" />
      </g>
    );
    if (isEaster) return (
      // Easter basket
      <g transform={easterParty ? undefined : 'translate(38, 26)'} className={easterParty ? 'basket-shake' : ''}>
        {/* Basket */}
        <path d="M0,6 Q1,14 7,14 Q13,14 14,6" fill="#d97706" />
        <path d="M0,6 L14,6" stroke="#b45309" strokeWidth="1" />
        {/* Handle */}
        <path d="M2,6 Q7,-2 12,6" fill="none" stroke="#b45309" strokeWidth="1.5" />
        {/* Eggs */}
        <ellipse cx="4" cy="7" rx="2" ry="2.5" fill="#fecdd3" />
        <ellipse cx="8" cy="6.5" rx="2" ry="2.5" fill="#bfdbfe" />
        <ellipse cx="11" cy="7.5" rx="1.8" ry="2.2" fill="#d9f99d" />
        {/* Egg patterns */}
        <line x1="3" y1="7" x2="5" y2="7" stroke="#f9a8d4" strokeWidth="0.5" />
        <line x1="7" y1="6.5" x2="9" y2="6.5" stroke="#93c5fd" strokeWidth="0.5" />
        {/* Chick hatching from egg */}
        {easterParty && (
          <g className="chick-pop">
            {/* Cracked shell halves */}
            <path d="M6,2 L5,4 L6.5,3.5 L7,4.5 L8,3 L9,4.5" fill="#d9f99d" />
            {/* Chick body */}
            <circle cx="7.5" cy="0.5" r="2.5" fill="#fbbf24" />
            {/* Chick head */}
            <circle cx="7.5" cy="-2" r="1.8" fill="#fbbf24" />
            {/* Eyes */}
            <circle cx="6.8" cy="-2.2" r="0.4" fill="#1e293b" />
            <circle cx="8.2" cy="-2.2" r="0.4" fill="#1e293b" />
            {/* Beak */}
            <path d="M7.5,-1.5 L6.5,-1 L7.5,-0.5" fill="#f97316" />
            {/* Blush */}
            <circle cx="6" cy="-1.2" r="0.5" fill="#fca5a5" opacity="0.5" />
            <circle cx="9" cy="-1.2" r="0.5" fill="#fca5a5" opacity="0.5" />
          </g>
        )}
      </g>
    );
    if (isHalloween) return (
      // Pumpkin — scary glow when party
      <g transform="translate(38, 26)" className={halloweenParty ? 'pumpkin-glow' : ''}>
        <ellipse cx="6" cy="7" rx="7" ry="6" fill="#f97316" />
        <rect x="5" y="-1" width="2" height="4" rx="0.8" fill="#65a30d" />
        {halloweenParty ? (
          <>
            {/* Scary face — angry eyes + evil grin */}
            <path d="M1,4 L3,6 L5,4" fill="#fbbf24" />
            <path d="M7,4 L9,6 L11,4" fill="#fbbf24" />
            <path d="M2,9 L3,8 L4.5,10 L6,8 L7.5,10 L9,8 L10,9" stroke="#fbbf24" strokeWidth="0.7" fill="none" />
          </>
        ) : (
          <>
            {/* Normal cute face */}
            <path d="M2,5 L4,7 L2,7" fill="#1e293b" />
            <path d="M8,7 L10,5 L10,7" fill="#1e293b" />
            <path d="M3,9 Q6,12 9,9" stroke="#1e293b" strokeWidth="0.8" fill="none" />
          </>
        )}
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
    if (isSmallScreen) return `${mobileNavbarHeight}px`;
    return '80px';
  };

  const getSidebarHeight = () => {
    if (isSmallScreen) return `calc(100dvh - ${mobileNavbarHeight}px)`;
    return 'calc(100vh - 100px)';
  };

  const getSidebarWidth = () => {
    if (isMobile) return '280px';
    return '240px';
  };

  const getSidebarBorderRadius = () => {
    if (isSmallScreen) return '0 0 18px 0';
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
    overflow: isSmallScreen ? 'auto' : 'hidden',
    WebkitOverflowScrolling: 'touch',
    borderRadius: getSidebarBorderRadius(),
    marginBottom: isSmallScreen ? '0' : '16px',
    border: isSmallScreen ? 'none' : '1px solid #f0f0f0',
  };

  const navItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: isMobile ? '12px 14px' : '12px 16px',
    borderRadius: '12px',
    color: isActive ? '#1565c0' : '#666666',
    backgroundColor: isActive ? '#e3f2fd' : 'transparent',
    textDecoration: 'none',
    fontWeight: isActive ? '600' : '500',
    fontSize: isMobile ? '14px' : '14px',
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
          padding: isSmallScreen
            ? '0.75rem 1rem'
            : '1rem 1rem 0.875rem',
          backgroundColor: isNight && !nightLampOn ? '#1e293b' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSmallScreen ? 'space-between' : 'center',
          flexShrink: 0,
          borderBottom: '1px solid #f0f0f0',
          minHeight: isSmallScreen ? '52px' : '64px',
          transition: 'background-color 0.5s ease',
        }}>
          {isSmallScreen ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Меню
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                  Навігація CRM
                </span>
              </div>
              <TransitionLink
                href="/dashboard"
                onClick={onClose}
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: '#eff6ff',
                  color: '#2563eb',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                <Home size={16} />
                Головна
              </TransitionLink>
            </>
          ) : (
            <>
              <style dangerouslySetInnerHTML={{
                __html: `
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
                .hat-star-pulse { animation: hatStarPulse 1.5s ease-in-out infinite; }
                @keyframes hatStarPulse { 0%,100% { fill: #eab308; filter: drop-shadow(0 0 2px #eab308); transform: scale(1); } 50% { fill: #f59e0b; filter: drop-shadow(0 0 8px #f59e0b); transform: scale(1.3); } }
                .robot-sleeping .logo-icon { filter: brightness(0.85); transition: filter 1s ease; }
                .robot-zzz { animation: zzzFloat 2s ease-in-out infinite; }
                @keyframes zzzFloat { 0% { opacity: 0; transform: translate(0,0) scale(0.5); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(6px,-12px) scale(1.1); } }
                .robot-speech { animation: speechIn 0.3s ease; position: absolute; top: -8px; right: -12px; background: white; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 3px 8px; font-size: 11px; font-weight: 600; color: #334155; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 10; pointer-events: none; }
                @keyframes speechIn { 0% { opacity: 0; transform: scale(0.5) translateY(4px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
                .robot-night .logo-icon { filter: brightness(0.7) saturate(0.7); }
                .robot-lamp-on .logo-icon { filter: brightness(1) saturate(1) drop-shadow(0 0 12px rgba(251,191,36,0.4)); transition: filter 0.5s ease; }
                .logo-lamp { transition: opacity 0.4s ease; }
                @keyframes lampSwing { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
                .logo-lamp-swing { animation: lampSwing 3s ease-in-out infinite; transform-origin: 50% 0%; }
                @keyframes robotDance { 0%,100% { transform: translateY(0) rotate(0deg); } 15% { transform: translateY(-3px) rotate(-4deg); } 30% { transform: translateY(0) rotate(4deg); } 45% { transform: translateY(-2px) rotate(-3deg); } 60% { transform: translateY(0) rotate(3deg); } 75% { transform: translateY(-3px) rotate(-2deg); } 90% { transform: translateY(0) rotate(2deg); } }
                .robot-dancing { animation: robotDance 0.8s ease-in-out infinite; }
                @keyframes hatShake { 0%,100% { transform: rotate(0deg) translateY(0); } 20% { transform: rotate(-8deg) translateY(-1px); } 40% { transform: rotate(8deg) translateY(0); } 60% { transform: rotate(-6deg) translateY(-1px); } 80% { transform: rotate(5deg) translateY(0); } }
                .hat-shake { animation: hatShake 0.5s ease-in-out infinite; transform-origin: 22px 11px; }
                @keyframes confettiFall { 0% { transform: translateY(-16px) rotate(0deg); opacity: 1; } 100% { transform: translateY(38px) rotate(360deg); opacity: 0; } }
                .confetti-piece { animation: confettiFall 1.8s ease-in forwards; }
                @keyframes fireworkBurst { 0% { transform: scale(0); opacity: 1; } 50% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.3); opacity: 0; } }
                .firework { animation: fireworkBurst 1.2s ease-out infinite; transform-origin: center; }
                @keyframes santaFly { 0% { transform: translateX(60px); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(-60px); opacity: 0; } }
                .santa-sleigh { animation: santaFly 4s linear infinite; }
                @keyframes snowfall { 0% { transform: translateY(-10px); opacity: 0.8; } 100% { transform: translateY(42px); opacity: 0; } }
                .snowflake { animation: snowfall 2s linear infinite; }
                @keyframes scaredShake { 0%,100% { transform: translateX(0); } 10% { transform: translateX(-2px) rotate(-2deg); } 20% { transform: translateX(2px) rotate(2deg); } 30% { transform: translateX(-2px); } 40% { transform: translateX(2px); } 50% { transform: translateX(-1px) rotate(-1deg); } 60% { transform: translateX(1px) rotate(1deg); } 70% { transform: translateX(-1px); } 80% { transform: translateX(1px); } }
                .robot-scared { animation: scaredShake 0.6s ease-in-out infinite; }
                @keyframes ghostFloat { 0% { transform: translate(0,0) scale(0.8); opacity: 0; } 20% { opacity: 0.7; } 50% { transform: translate(var(--gx,5px), var(--gy,-10px)) scale(1); opacity: 0.6; } 80% { opacity: 0.4; } 100% { transform: translate(var(--gx2,10px), var(--gy2,-18px)) scale(0.7); opacity: 0; } }
                .ghost-float { animation: ghostFloat 3s ease-in-out infinite; }
                .pumpkin-glow { filter: drop-shadow(0 0 4px #fbbf24) drop-shadow(0 0 8px #f97316); }
                @keyframes bookFall { 0% { transform: translateY(-14px) rotate(0deg); opacity: 0; } 10% { opacity: 1; } 85% { opacity: 0.8; } 100% { transform: translateY(44px) rotate(var(--br, 180deg)); opacity: 0; } }
                .book-fall { animation: bookFall 3.5s ease-in infinite; }
                @keyframes bunnyWiggle { 0%,100% { transform: rotate(0deg) scaleY(1); } 20% { transform: rotate(-6deg) scaleY(0.95); } 40% { transform: rotate(6deg) scaleY(1.05); } 60% { transform: rotate(-4deg) scaleY(0.97); } 80% { transform: rotate(4deg) scaleY(1.03); } }
                .bunny-wiggle { animation: bunnyWiggle 0.7s ease-in-out infinite; transform-origin: 22px 10px; }
                @keyframes eggBounce { 0% { transform: translateY(0); } 40% { transform: translateY(var(--ey, -8px)); } 60% { transform: translateY(var(--ey, -8px)); } 100% { transform: translateY(0); } }
                .egg-bounce { animation: eggBounce 1.2s ease-in-out infinite; }
                @keyframes chickPop { 0% { transform: scale(0) translateY(4px); opacity: 0; } 30% { transform: scale(1.3) translateY(-2px); opacity: 1; } 50% { transform: scale(0.9) translateY(0); } 70% { transform: scale(1.1) translateY(-1px); } 100% { transform: scale(1) translateY(0); opacity: 1; } }
                .chick-pop { animation: chickPop 0.8s ease forwards; }
                @keyframes basketShake { 0%,100% { transform: translate(38px,26px) rotate(0deg); } 25% { transform: translate(38px,26px) rotate(-3deg); } 75% { transform: translate(38px,26px) rotate(3deg); } }
                .basket-shake { animation: basketShake 0.4s ease-in-out infinite; }
              `}} />
              <TransitionLink
            href="/dashboard"
            onClick={isSmallScreen ? onClose : undefined}
            style={{ textDecoration: 'none' }}
          >
            <div
              ref={logoRef}
              className={`itrcrm-logo${isSleeping ? ' robot-sleeping' : ''}${isNight && !nightLampOn ? ' robot-night' : ''}${isNight && nightLampOn ? ' robot-lamp-on' : ''}`}
              onClick={handleRobotClick}
              onDoubleClick={handleRobotDoubleClick}
              style={{ display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none', cursor: 'pointer', padding: '4px 0', position: 'relative' }}
            >
              {/* Speech bubble */}
              {speechBubble && <div className="robot-speech">{speechBubble}</div>}
              {/* Robot icon */}
              <svg className={`logo-icon${birthdayParty || newYearParty || sep1Party || easterParty ? ' robot-dancing' : ''}${halloweenParty ? ' robot-scared' : ''}`} width="62" height="62" viewBox="-2 -10 58 52" fill="none" style={{ flexShrink: 0, transition: 'filter 0.3s ease', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="44" y2="44">
                    <stop offset="0%" stopColor={isNight && !nightLampOn ? '#1e3a5f' : '#3b82f6'} />
                    <stop offset="100%" stopColor={isNight && !nightLampOn ? '#0f172a' : '#1d4ed8'} />
                  </linearGradient>
                </defs>
                {/* Seasonal accessory (replaces antenna when hat) */}
                {renderAccessory()}
                {/* Antenna — hidden when seasonal hat is on */}
                {!hasAccessoryHat && (
                  <g className={`logo-antenna${hasNotifications ? ' logo-antenna-pulse' : ''}`}>
                    <line x1="22" y1="4" x2="22" y2="10" stroke={isNight && !nightLampOn ? '#1e40af' : '#3b82f6'} strokeWidth="2" strokeLinecap="round" />
                    <circle className="logo-antenna-tip" cx="22" cy="3" r="2.5" fill={isNight && !nightLampOn ? '#3b82f6' : '#60a5fa'} />
                  </g>
                )}
                {/* Night lamp */}
                {isNight && (
                  <g className={`logo-lamp${nightLampOn ? ' logo-lamp-swing' : ''}`} style={{ opacity: nightLampOn ? 1 : 0.3 }}>
                    {/* Lamp arm */}
                    <line x1="42" y1="-6" x2="42" y2="6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="42" y1="-6" x2="48" y2="-6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="48" y1="-6" x2="48" y2="-2" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                    {/* Lamp shade */}
                    <path d="M44,-2 L52,-2 L50,4 L46,4 Z" fill={nightLampOn ? '#fbbf24' : '#64748b'} />
                    {/* Light cone */}
                    {nightLampOn && (
                      <path d="M46,4 L42,18 L54,18 L50,4" fill="#fbbf24" opacity="0.12" />
                    )}
                    {/* Bulb glow */}
                    {nightLampOn && (
                      <circle cx="48" cy="2" r="3" fill="#fbbf24" opacity="0.4" />
                    )}
                    {/* Base */}
                    <rect x="40" y="6" width="4" height="2" rx="1" fill="#94a3b8" />
                  </g>
                )}
                {/* Head */}
                <rect x="6" y="10" width="32" height="24" rx="7" fill="url(#logoGrad)" />
                {/* Screen / face area */}
                <rect x="10" y="14" width="24" height="12" rx="4" fill="white" opacity={isNight && !nightLampOn ? 0.1 : 0.2} />
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
                {/* Halloween scared eyes — small fixed black pupils */}
                {halloweenParty && !robotEmotion && (
                  <>
                    <circle cx="16.5" cy="19" r="1.3" fill="#1e293b" />
                    <circle cx="27.5" cy="19" r="1.3" fill="#1e293b" />
                    {/* Raised eyebrows — scared look */}
                    <line x1="14" y1="15.5" x2="19" y2="16.5" stroke="#1e293b" strokeWidth="1" strokeLinecap="round" />
                    <line x1="25" y1="16.5" x2="30" y2="15.5" stroke="#1e293b" strokeWidth="1" strokeLinecap="round" />
                  </>
                )}
                {/* Sep 1 happy eyes — upward arc smile eyes */}
                {sep1Party && !robotEmotion && (
                  <>
                    <circle cx="16.5" cy="18" r="2" fill="#1e293b" />
                    <circle cx="27.5" cy="18" r="2" fill="#1e293b" />
                    <path d="M14.5,19.5 Q16.5,22 18.5,19.5" stroke="#1e293b" strokeWidth="0.8" fill="none" strokeLinecap="round" />
                    <path d="M25.5,19.5 Q27.5,22 29.5,19.5" stroke="#1e293b" strokeWidth="0.8" fill="none" strokeLinecap="round" />
                  </>
                )}
                {/* Easter party eyes — love hearts */}
                {easterParty && !robotEmotion && (
                  <g className="robot-emotion">
                    <text x="16.5" y="21" textAnchor="middle" dominantBaseline="central" fill="#f43f5e" fontSize="7" style={{ pointerEvents: 'none' }}>❤</text>
                    <text x="27.5" y="21" textAnchor="middle" dominantBaseline="central" fill="#f43f5e" fontSize="7" style={{ pointerEvents: 'none' }}>❤</text>
                  </g>
                )}
                {/* Pupils — follow mouse (not when sleeping) */}
                {!robotEmotion && !isSleeping && !halloweenParty && !sep1Party && !easterParty && (
                  <>
                    <circle
                      cx={16.5 + eyeOffset.x}
                      cy={20 + eyeOffset.y}
                      r={isNight && nightLampOn ? "1.5" : "2.2"}
                      fill={getEyeFill()}
                      style={{
                        transition: 'cx 0.08s ease, cy 0.08s ease, r 0.3s ease',
                        transform: isBlinking ? 'scaleY(0.1)' : 'scaleY(1)',
                        transformOrigin: '16.5px 20px',
                      }}
                    />
                    <circle
                      cx={27.5 + eyeOffset.x}
                      cy={20 + eyeOffset.y}
                      r={isNight && nightLampOn ? "1.5" : "2.2"}
                      fill={getEyeFill()}
                      style={{
                        transition: 'cx 0.08s ease, cy 0.08s ease, r 0.3s ease',
                        transform: isBlinking ? 'scaleY(0.1)' : 'scaleY(1)',
                        transformOrigin: '27.5px 20px',
                      }}
                    />
                    {isNight && nightLampOn && (
                      <g className="robot-emotion" style={{ pointerEvents: 'none' }}>
                        <line x1="13.5" y1="16" x2="19.5" y2="17" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                        <line x1="24.5" y1="17" x2="30.5" y2="16" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                      </g>
                    )}
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
                    <text className="robot-zzz" x="32" y="8" fontSize="10" fill="#94a3b8" fontWeight="bold">Z</text>
                    <text className="robot-zzz" x="37" y="1" fontSize="8" fill="#94a3b8" fontWeight="bold" style={{ animationDelay: '0.7s' }}>Z</text>
                    <text className="robot-zzz" x="41" y="-5" fontSize="6" fill="#94a3b8" fontWeight="bold" style={{ animationDelay: '1.4s' }}>z</text>
                    {/* Pillow */}
                    <g transform="translate(-5, 28)">
                      <ellipse cx="10" cy="6" rx="12" ry="5" fill="#c7d2fe" />
                      <ellipse cx="10" cy="5.5" rx="10" ry="3.5" fill="#e0e7ff" />
                      <ellipse cx="10" cy="5" rx="6" ry="2" fill="#eef2ff" opacity="0.6" />
                    </g>
                  </>
                )}
                {/* Seasonal side item */}
                {renderSideItem()}
                {/* Birthday confetti */}
                {birthdayParty && (
                  <g>
                    {[
                      { x: 5, delay: 0, color: '#f43f5e', size: 2.5 },
                      { x: 12, delay: 0.2, color: '#eab308', size: 2 },
                      { x: 20, delay: 0.5, color: '#60a5fa', size: 2.2 },
                      { x: 28, delay: 0.3, color: '#a78bfa', size: 1.8 },
                      { x: 35, delay: 0.7, color: '#34d399', size: 2 },
                      { x: 8, delay: 0.9, color: '#fb923c', size: 1.5 },
                      { x: 17, delay: 1.1, color: '#f43f5e', size: 2 },
                      { x: 25, delay: 0.6, color: '#eab308', size: 1.8 },
                      { x: 32, delay: 1.0, color: '#a78bfa', size: 2.2 },
                      { x: 40, delay: 0.4, color: '#60a5fa', size: 1.6 },
                      { x: 3, delay: 1.3, color: '#34d399', size: 1.8 },
                      { x: 22, delay: 0.8, color: '#fb923c', size: 2.5 },
                    ].map((c, i) => (
                      <rect
                        key={i}
                        className="confetti-piece"
                        x={c.x}
                        y={-12}
                        width={c.size}
                        height={c.size}
                        rx="0.5"
                        fill={c.color}
                        style={{ animationDelay: `${c.delay}s`, animationIterationCount: 'infinite' }}
                      />
                    ))}
                  </g>
                )}
                {/* New Year party effects */}
                {newYearParty && (
                  <g>
                    {/* Firework bursts */}
                    <g className="firework" style={{ transformOrigin: '-4px -6px' }}>
                      <circle cx="-4" cy="-6" r="1" fill="#f43f5e" />
                      <circle cx="-7" cy="-9" r="0.7" fill="#eab308" />
                      <circle cx="-1" cy="-10" r="0.7" fill="#60a5fa" />
                      <circle cx="-7" cy="-3" r="0.6" fill="#a78bfa" />
                      <circle cx="0" cy="-3" r="0.6" fill="#34d399" />
                      <circle cx="-4" cy="-11" r="0.5" fill="#fb923c" />
                    </g>
                    <g className="firework" style={{ transformOrigin: '48px -4px', animationDelay: '0.6s' }}>
                      <circle cx="48" cy="-4" r="1" fill="#eab308" />
                      <circle cx="45" cy="-7" r="0.7" fill="#f43f5e" />
                      <circle cx="51" cy="-7" r="0.7" fill="#34d399" />
                      <circle cx="45" cy="-1" r="0.6" fill="#60a5fa" />
                      <circle cx="51" cy="-1" r="0.6" fill="#fb923c" />
                      <circle cx="48" cy="-9" r="0.5" fill="#a78bfa" />
                    </g>
                    <g className="firework" style={{ transformOrigin: '22px -14px', animationDelay: '1.0s' }}>
                      <circle cx="22" cy="-14" r="0.8" fill="#60a5fa" />
                      <circle cx="19" cy="-17" r="0.6" fill="#eab308" />
                      <circle cx="25" cy="-17" r="0.6" fill="#f43f5e" />
                      <circle cx="19" cy="-11" r="0.5" fill="#34d399" />
                      <circle cx="25" cy="-11" r="0.5" fill="#a78bfa" />
                    </g>
                    {/* Santa on sleigh with reindeer */}
                    <g className="santa-sleigh">
                      {/* Reindeer */}
                      <g transform="translate(-16, -16)">
                        {/* Body */}
                        <ellipse cx="0" cy="0" rx="3" ry="1.5" fill="#8B4513" />
                        {/* Head */}
                        <circle cx="-3.5" cy="-1" r="1.2" fill="#A0522D" />
                        {/* Antlers */}
                        <line x1="-4" y1="-2" x2="-5.5" y2="-4" stroke="#8B4513" strokeWidth="0.5" />
                        <line x1="-5.5" y1="-4" x2="-6.5" y2="-3.5" stroke="#8B4513" strokeWidth="0.4" />
                        <line x1="-3" y1="-2" x2="-3.5" y2="-4" stroke="#8B4513" strokeWidth="0.5" />
                        <line x1="-3.5" y1="-4" x2="-4.5" y2="-3.5" stroke="#8B4513" strokeWidth="0.4" />
                        {/* Nose */}
                        <circle cx="-4.5" cy="-0.5" r="0.5" fill="#dc2626" />
                        {/* Legs */}
                        <line x1="-1.5" y1="1.5" x2="-2" y2="3" stroke="#8B4513" strokeWidth="0.5" />
                        <line x1="1.5" y1="1.5" x2="2" y2="3" stroke="#8B4513" strokeWidth="0.5" />
                        {/* Harness line */}
                        <line x1="3" y1="0" x2="8" y2="0" stroke="#eab308" strokeWidth="0.4" strokeDasharray="1,1" />
                      </g>
                      {/* Sleigh */}
                      <g transform="translate(-5, -16)">
                        <path d="M0,-1 Q2,-3 6,-3 L8,-3 L8,0 Q6,2 0,2 Z" fill="#dc2626" />
                        {/* Runner */}
                        <path d="M-1,2 Q0,3 8,3 L9,2" fill="none" stroke="#eab308" strokeWidth="0.6" />
                        {/* Santa */}
                        <circle cx="5" cy="-4.5" r="2" fill="#dc2626" />
                        <circle cx="5" cy="-5.5" r="1.3" fill="#fde68a" />
                        {/* Santa hat */}
                        <path d="M4,-6.5 Q5,-9 7,-7" fill="#dc2626" />
                        <circle cx="7" cy="-7" r="0.6" fill="white" />
                        {/* Gift bag */}
                        <ellipse cx="2" cy="-3.5" rx="1.5" ry="2" fill="#16a34a" />
                        <rect x="1" y="-4.5" width="2" height="0.6" rx="0.3" fill="#eab308" />
                      </g>
                    </g>
                    {/* Snowflakes */}
                    {[
                      { x: 2, d: 0 }, { x: 10, d: 0.4 }, { x: 18, d: 0.8 },
                      { x: 26, d: 1.2 }, { x: 34, d: 0.3 }, { x: 42, d: 0.9 },
                      { x: 6, d: 1.5 }, { x: 30, d: 0.6 },
                    ].map((s, i) => (
                      <circle
                        key={i}
                        className="snowflake"
                        cx={s.x}
                        cy={-8}
                        r="0.8"
                        fill="white"
                        opacity="0.7"
                        style={{ animationDelay: `${s.d}s` }}
                      />
                    ))}
                  </g>
                )}
                {/* Halloween party effects — ghosts */}
                {halloweenParty && (
                  <g>
                    {/* Ghost 1 — left */}
                    <g className="ghost-float" style={{ '--gx': '-8px', '--gy': '-12px', '--gx2': '-12px', '--gy2': '-20px' } as React.CSSProperties}>
                      <path d="M-6,8 Q-6,0 -2,0 Q2,0 2,8 L1,6 L0,8 L-1,6 L-2,8 L-3,6 L-4,8 L-5,6 Z" fill="white" opacity="0.8" />
                      <circle cx="-3" cy="3" r="1" fill="#1e293b" />
                      <circle cx="0" cy="3" r="1" fill="#1e293b" />
                      <ellipse cx="-1.5" cy="5.5" rx="1.5" ry="1" fill="#1e293b" />
                    </g>
                    {/* Ghost 2 — right */}
                    <g className="ghost-float" style={{ '--gx': '6px', '--gy': '-14px', '--gx2': '10px', '--gy2': '-22px', animationDelay: '1s' } as React.CSSProperties}>
                      <g transform="translate(46, 4)">
                        <path d="M-3,8 Q-3,1 1,1 Q5,1 5,8 L4,6 L3,8 L2,6 L1,8 L0,6 L-1,8 L-2,6 Z" fill="white" opacity="0.7" />
                        <circle cx="0" cy="3.5" r="0.8" fill="#1e293b" />
                        <circle cx="2.5" cy="3.5" r="0.8" fill="#1e293b" />
                      </g>
                    </g>
                    {/* Ghost 3 — top */}
                    <g className="ghost-float" style={{ '--gx': '3px', '--gy': '-10px', '--gx2': '-3px', '--gy2': '-16px', animationDelay: '1.8s' } as React.CSSProperties}>
                      <g transform="translate(10, -8) scale(0.7)">
                        <path d="M-3,8 Q-3,1 1,1 Q5,1 5,8 L4,6 L3,8 L2,6 L1,8 L0,6 L-1,8 L-2,6 Z" fill="white" opacity="0.6" />
                        <circle cx="0" cy="3.5" r="0.8" fill="#1e293b" />
                        <circle cx="2.5" cy="3.5" r="0.8" fill="#1e293b" />
                      </g>
                    </g>
                  </g>
                )}
                {/* Sep 1 party effects — falling books */}
                {sep1Party && (
                  <g>
                    {[
                      { x: 0, delay: 0, color: '#dc2626', pages: '#fca5a5', rot: 180 },
                      { x: 10, delay: 0.6, color: '#2563eb', pages: '#93c5fd', rot: -120 },
                      { x: 22, delay: 1.2, color: '#16a34a', pages: '#86efac', rot: 200 },
                      { x: 34, delay: 0.3, color: '#9333ea', pages: '#c4b5fd', rot: -160 },
                      { x: 44, delay: 0.9, color: '#ea580c', pages: '#fdba74', rot: 140 },
                      { x: 6, delay: 1.8, color: '#0891b2', pages: '#67e8f9', rot: -200 },
                      { x: 28, delay: 1.5, color: '#ca8a04', pages: '#fde047', rot: 220 },
                      { x: 16, delay: 2.1, color: '#be185d', pages: '#f9a8d4', rot: -140 },
                    ].map((b, i) => (
                      <g key={i} className="book-fall" style={{ animationDelay: `${b.delay}s`, '--br': `${b.rot}deg` } as React.CSSProperties}>
                        <g transform={`translate(${b.x}, -10)`}>
                          {/* Book cover */}
                          <rect x="0" y="0" width="7" height="5" rx="0.5" fill={b.color} />
                          {/* Pages */}
                          <rect x="1" y="0.5" width="5" height="4" rx="0.3" fill={b.pages} />
                          {/* Spine */}
                          <line x1="0.5" y1="0.3" x2="0.5" y2="4.7" stroke={b.color} strokeWidth="0.8" />
                        </g>
                      </g>
                    ))}
                  </g>
                )}
                {/* Easter party effects — bouncing eggs */}
                {easterParty && (
                  <g>
                    {[
                      { x: -4, y: 30, color: '#fecdd3', stripe: '#f9a8d4', delay: 0, ey: -10 },
                      { x: 8, y: -8, color: '#bfdbfe', stripe: '#93c5fd', delay: 0.3, ey: -6 },
                      { x: 36, y: -6, color: '#d9f99d', stripe: '#86efac', delay: 0.6, ey: -8 },
                      { x: 48, y: 28, color: '#fde68a', stripe: '#fbbf24', delay: 0.2, ey: -12 },
                      { x: -2, y: 10, color: '#c4b5fd', stripe: '#a78bfa', delay: 0.8, ey: -7 },
                      { x: 46, y: 12, color: '#fbcfe8', stripe: '#f472b6', delay: 0.5, ey: -9 },
                    ].map((egg, i) => (
                      <g key={i} className="egg-bounce" style={{ animationDelay: `${egg.delay}s`, '--ey': `${egg.ey}px` } as React.CSSProperties}>
                        <g transform={`translate(${egg.x}, ${egg.y})`}>
                          <ellipse cx="0" cy="0" rx="3" ry="3.8" fill={egg.color} />
                          <line x1="-2" y1="0" x2="2" y2="0" stroke={egg.stripe} strokeWidth="0.8" />
                          <line x1="-1.5" y1="1.5" x2="1.5" y2="1.5" stroke={egg.stripe} strokeWidth="0.6" />
                        </g>
                      </g>
                    ))}
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
              <div className="logo-letters" style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1, transition: 'filter 0.3s ease', gap: 2, marginTop: 14 }}>
                <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                  ITR
                </span>
                <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#2563eb', letterSpacing: '-0.02em', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                  CRM
                </span>
              </div>
            </div>
              </TransitionLink>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ padding: isSmallScreen ? '12px 8px' : '24px 8px', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
          {isSmallScreen && (
            <div style={{ padding: '0 16px 10px', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Основне
            </div>
          )}
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <TransitionLink
                key={item.href}
                href={item.href}
                onClick={isSmallScreen ? onClose : undefined}
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
          {isSmallScreen && (
            <div style={{ padding: '0 16px 10px', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Додатково
            </div>
          )}
          {(() => {
            const Icon = filesMenuItem.icon;
            const isActive = pathname === filesMenuItem.href;
            return (
              <TransitionLink
                href={filesMenuItem.href}
                onClick={isSmallScreen ? onClose : undefined}
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
                onClick={isSmallScreen ? onClose : undefined}
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
        <SidebarInfoWidget isCompact={isSmallScreen} />

      </aside>
    </>
  );
}
