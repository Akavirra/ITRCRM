'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';

type AttendanceStatus = 'present' | 'absent' | 'makeup_planned' | 'makeup_done';

interface Totals {
  total_lessons: number;
  group_lessons: number;
  individual_lessons: number;
  total_records: number;
  present: number;
  absent: number;
  makeup: number;
  not_marked: number;
  overall_rate: number;
  students_count: number;
}

interface RegisterLesson {
  lesson_id: number;
  lesson_date: string;
  topic: string | null;
}

interface RegisterStudent {
  student_id: number;
  student_name: string;
  attendance: Record<number, AttendanceStatus | null>;
  present: number;
  absent: number;
  not_marked: number;
  rate: number;
}

interface GroupedLesson {
  lesson_id: number;
  lesson_date: string;
  topic: string | null;
}

interface GroupedStudent {
  student_id: number;
  student_name: string;
  attendance: Record<number, AttendanceStatus | null>;
  present: number;
  absent: number;
  rate: number;
}

interface GroupedGroup {
  group_id: number;
  group_title: string;
  course_title: string | null;
  weekly_day: number | null;
  start_time: string | null;
  duration_minutes: number;
  lessons: GroupedLesson[];
  students: GroupedStudent[];
  avg_rate: number;
}

interface IndividualLesson {
  lesson_id: number;
  lesson_date: string;
  start_time: string | null;
  topic: string | null;
  course_title: string | null;
  students: Array<{
    student_id: number;
    student_name: string;
    status: AttendanceStatus | null;
  }>;
}

interface LessonRecord {
  lesson_id: number;
  lesson_date: string;
  start_time: string | null;
  topic: string | null;
  group_id: number | null;
  group_title: string;
  course_title: string | null;
  student_id: number;
  student_name: string;
  status: AttendanceStatus | null;
}

interface Group {
  id: number;
  title: string;
}

const WEEKDAY_UK = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WEEKDAY_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']; // JS 0=Sun
const MONTH_UK = ['', 'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  } catch { return dateStr; }
}

function getWeekdayShort(dateStr: string): string {
  try {
    return WEEKDAY_SHORT[new Date(dateStr).getUTCDay()];
  } catch { return ''; }
}

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 80, height: 5, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${rate}%`, height: '100%', backgroundColor: color, borderRadius: 5 }} />
      </div>
      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color }}>{rate}%</span>
    </div>
  );
}

function AttCell({ status }: { status: AttendanceStatus | null }) {
  if (!status) return <span style={{ color: '#d1d5db', fontSize: '1rem' }}>○</span>;
  if (status === 'present') return <span style={{ color: '#16a34a', fontSize: '1rem', fontWeight: 700 }}>✓</span>;
  if (status === 'absent') return <span style={{ color: '#dc2626', fontSize: '1rem', fontWeight: 700 }}>✗</span>;
  if (status === 'makeup_done') return <span style={{ color: '#2563eb', fontSize: '1rem', fontWeight: 700 }}>✓</span>;
  return <span style={{ color: '#d97706', fontSize: '1rem', fontWeight: 700 }}>↺</span>;
}

function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  if (!status) return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', fontSize: '0.7rem', color: '#9ca3af' }}>○</span>;
  const map: Record<AttendanceStatus, { bg: string; border: string; icon: string; color: string; title: string }> = {
    present:        { bg: '#dcfce7', border: '#86efac', icon: '✓', color: '#16a34a', title: 'Присутній' },
    absent:         { bg: '#fee2e2', border: '#fca5a5', icon: '✗', color: '#dc2626', title: 'Відсутній' },
    makeup_planned: { bg: '#fef3c7', border: '#fcd34d', icon: '↺', color: '#d97706', title: 'Відпрацювання' },
    makeup_done:    { bg: '#dbeafe', border: '#93c5fd', icon: '✓', color: '#2563eb', title: 'Відпрацьовано' },
  };
  const s = map[status];
  return <span title={s.title} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', backgroundColor: s.bg, border: `1px solid ${s.border}`, fontSize: '0.7rem', fontWeight: 700, color: s.color }}>{s.icon}</span>;
}

function StatusLabel({ status }: { status: AttendanceStatus | null }) {
  if (!status) return <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>Не відмічено</span>;
  const map: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
    present:        { label: 'Присутній',    color: '#16a34a', bg: '#dcfce7' },
    absent:         { label: 'Відсутній',    color: '#dc2626', bg: '#fee2e2' },
    makeup_planned: { label: 'Відпрацювання', color: '#d97706', bg: '#fef3c7' },
    makeup_done:    { label: 'Відпрацьовано', color: '#2563eb', bg: '#dbeafe' },
  };
  const s = map[status];
  return <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, color: s.color, backgroundColor: s.bg }}>{s.label}</span>;
}

export default function AttendancePage() {
  const router = useRouter();
  const now = new Date();
  const [user, setUser] = useState<{ id: number; name: string; email: string; role: 'admin' | 'teacher' } | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<'grouped' | 'summary' | 'register'>('grouped');
  const [totals, setTotals] = useState<Totals | null>(null);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [register, setRegister] = useState<{ lessons: RegisterLesson[]; students: RegisterStudent[] } | null>(null);
  const [groupedData, setGroupedData] = useState<{ groups: GroupedGroup[]; individual_lessons: IndividualLesson[] } | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [search, setSearch] = useState('');
  const [allTime, setAllTime] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Auth
  useEffect(() => {
    fetch('/api/auth/me').then(r => { if (!r.ok) { router.push('/login'); return null; } return r.json(); })
      .then(d => d && setUser(d.user));
  }, [router]);

  // Load groups
  useEffect(() => {
    fetch('/api/groups?limit=200').then(r => r.json())
      .then(d => setGroups((d.groups || []).map((g: { id: number; title: string }) => ({ id: g.id, title: g.title }))))
      .catch(() => {});
  }, []);

  // Load data based on view mode (totals are included in grouped response to save an extra round-trip)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === 'register' && selectedGroup) {
        const res = await fetch(`/api/attendance?view=register&year=${year}&month=${month}&groupId=${selectedGroup}`);
        if (res.ok) { const d = await res.json(); setRegister(d.register || null); }
      } else if (viewMode === 'grouped') {
        const params = new URLSearchParams({ view: 'groupedMonthly', year: String(year), month: String(month) });
        if (selectedGroup) params.set('groupId', selectedGroup);
        if (search) params.set('search', search);
        const res = await fetch(`/api/attendance?${params}`);
        if (res.ok) {
          const d = await res.json();
          setGroupedData({ groups: d.groups || [], individual_lessons: d.individual_lessons || [] });
          if (d.totals) setTotals(d.totals); // totals come bundled with grouped response
        }
      } else {
        const params = new URLSearchParams({ view: 'lessonRecords' });
        if (!allTime) { params.set('year', String(year)); params.set('month', String(month)); }
        else { params.set('allTime', 'true'); }
        if (selectedGroup) params.set('groupId', selectedGroup);
        if (search) params.set('search', search);
        // Fetch records + totals in parallel for summary/register views
        const [recordsRes, totalsRes] = await Promise.all([
          fetch(`/api/attendance?${params}`),
          allTime ? Promise.resolve(null) : fetch(`/api/attendance?view=monthlyTotals&year=${year}&month=${month}`),
        ]);
        if (recordsRes.ok) { const d = await recordsRes.json(); setLessonRecords(d.records || []); }
        if (totalsRes?.ok) { const d = await totalsRes.json(); if (d.totals) setTotals(d.totals); }
      }
    } finally {
      setLoading(false);
    }
  }, [year, month, viewMode, selectedGroup, search, allTime]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(loadData, 200);
    return () => clearTimeout(searchTimeout.current);
  }, [loadData]);

  const prevMonth = () => {
    setAllTime(false);
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    setAllTime(false);
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const exportCSV = () => {
    let csvRows: (string | number)[][];
    if (viewMode === 'register' && register) {
      const header = ['Учень', ...register.lessons.map(l => `${getWeekdayShort(l.lesson_date)} ${formatDateShort(l.lesson_date)}`), 'Всього', '%'];
      const data = register.students.map(s => [
        s.student_name,
        ...register.lessons.map(l => {
          const st = s.attendance[l.lesson_id];
          if (!st) return '—';
          if (st === 'present') return 'П';
          if (st === 'absent') return 'В';
          return 'Відп';
        }),
        `${s.present}/${register.lessons.length}`,
        `${s.rate}%`,
      ]);
      csvRows = [header, ...data];
    } else if (viewMode === 'summary') {
      csvRows = [['Дата', 'День', 'Час', 'Група', 'Учень', 'Тема', 'Статус']];
      for (const r of lessonRecords) {
        const statusLabel = r.status === 'present' ? 'Присутній' : r.status === 'absent' ? 'Відсутній' : r.status === 'makeup_done' ? 'Відпрацьовано' : r.status === 'makeup_planned' ? 'Відпрацювання' : 'Не відмічено';
        csvRows.push([formatDateShort(r.lesson_date), getWeekdayShort(r.lesson_date), r.start_time || '', r.group_title, r.student_name, r.topic || '', statusLabel]);
      }
    } else {
      csvRows = [['Тип', 'Група', 'Учень', 'Дата', 'День', 'Статус']];
      if (groupedData) {
        for (const g of groupedData.groups) {
          for (const s of g.students) {
            for (const l of g.lessons) {
              const st = s.attendance[l.lesson_id];
              const statusLabel = st === 'present' ? 'П' : st === 'absent' ? 'В' : st === 'makeup_done' ? 'Відпр' : st === 'makeup_planned' ? 'Відпр' : '—';
              csvRows.push(['Групове', g.group_title, s.student_name, formatDateShort(l.lesson_date), getWeekdayShort(l.lesson_date), statusLabel]);
            }
          }
        }
        for (const il of groupedData.individual_lessons) {
          for (const s of il.students) {
            const statusLabel = s.status === 'present' ? 'П' : s.status === 'absent' ? 'В' : s.status === 'makeup_done' ? 'Відпр' : s.status === 'makeup_planned' ? 'Відпр' : '—';
            csvRows.push(['Індивідуальне', il.topic || '—', s.student_name, formatDateShort(il.lesson_date), getWeekdayShort(il.lesson_date), statusLabel]);
          }
        }
      }
    }
    const csv = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${year}_${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user) return null;

  return (
    <Layout user={user}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--gray-900)' }}>Відвідуваність</h1>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', border: '1px solid #e5e7eb', borderRadius: '0.625rem', backgroundColor: 'white', color: '#374151', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Експорт CSV
          </button>
        </div>

        {/* Month navigation */}
        <div className="card" style={{ padding: '0.875rem 1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', borderRadius: '0.875rem', flexWrap: 'wrap' }}>
          <button onClick={prevMonth} disabled={allTime} style={{ width: 34, height: 34, border: '1px solid #e5e7eb', borderRadius: '50%', backgroundColor: 'white', cursor: allTime ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', color: allTime ? '#d1d5db' : '#374151', opacity: allTime ? 0.4 : 1, flexShrink: 0 }}>‹</button>
          <span style={{ fontWeight: 700, fontSize: '1.125rem', color: '#111827', minWidth: 200, textAlign: 'center' }}>
            {allTime ? 'За весь час' : `${MONTH_UK[month]} ${year}`}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth || allTime} style={{ width: 34, height: 34, border: '1px solid #e5e7eb', borderRadius: '50%', backgroundColor: 'white', cursor: (isCurrentMonth || allTime) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', color: (isCurrentMonth || allTime) ? '#d1d5db' : '#374151', opacity: (isCurrentMonth || allTime) ? 0.4 : 1, flexShrink: 0 }}>›</button>
          <button onClick={() => setAllTime(!allTime)} style={{ marginLeft: '0.25rem', padding: '0.375rem 0.875rem', border: `1px solid ${allTime ? '#1565c0' : '#e5e7eb'}`, borderRadius: '0.5rem', backgroundColor: allTime ? '#1565c0' : 'white', color: allTime ? 'white' : '#374151', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            За весь час
          </button>
        </div>

        {/* KPI cards */}
        {totals && !allTime && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Всього занять', value: totals.total_lessons, color: '#374151', bg: '#f9fafb' },
              { label: 'Групових',      value: totals.group_lessons,      color: '#1d4ed8', bg: '#dbeafe' },
              { label: 'Індивідуальних', value: totals.individual_lessons, color: '#7c3aed', bg: '#ede9fe' },
              { label: 'Пропуски',     value: totals.absent,              color: '#dc2626', bg: '#fee2e2' },
              { label: 'Відпрацювань', value: totals.makeup,              color: '#d97706', bg: '#fef3c7' },
              { label: 'Не відмічено', value: totals.not_marked,          color: '#6b7280', bg: '#f3f4f6' },
              { label: 'Загальний %',  value: `${totals.overall_rate}%`,  color: totals.overall_rate >= 80 ? '#16a34a' : totals.overall_rate >= 60 ? '#d97706' : '#dc2626', bg: '#f9fafb' },
            ].map((kpi, i) => (
              <div key={i} className="card" style={{ padding: '0.875rem 1rem', borderRadius: '0.875rem', backgroundColor: kpi.bg, border: 'none' }}>
                <div style={{ fontSize: '1.375rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: 2 }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* View mode tabs + filters */}
        <div className="card" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '0.625rem', overflow: 'hidden', flexShrink: 0 }}>
              {(['grouped', 'summary', 'register'] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{
                  padding: '0.5rem 1rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
                  backgroundColor: viewMode === mode ? '#1565c0' : 'white',
                  color: viewMode === mode ? 'white' : '#374151',
                }}>
                  {mode === 'grouped' ? 'По групах' : mode === 'summary' ? 'Загальна таблиця' : 'Журнал групи'}
                </button>
              ))}
            </div>

            <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
              style={{ padding: '0.5rem 0.875rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#374151', backgroundColor: 'white' }}>
              <option value="">Всі групи</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>

            {viewMode !== 'register' && (
              <input type="text" placeholder="Пошук учня..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 180, padding: '0.5rem 0.875rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#374151' }} />
            )}

            {viewMode === 'summary' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151', whiteSpace: 'nowrap' as const }}>
                <input type="checkbox" checked={allTime} onChange={e => setAllTime(e.target.checked)} />
                За весь час
              </label>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>Завантаження...</div>
          ) : viewMode === 'grouped' ? (
            renderGroupedView()
          ) : viewMode === 'register' ? (
            renderRegisterView()
          ) : (
            renderSummaryView()
          )}
        </div>
      </div>
    </Layout>
  );

  // ── Grouped view ─────────────────────────────────────────────────────────

  function renderGroupedView() {
    if (!groupedData || (groupedData.groups.length === 0 && groupedData.individual_lessons.length === 0)) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Даних про відвідуваність немає</p>
          <p style={{ margin: 0, fontSize: '0.8125rem' }}>Відвідуваність з&apos;явиться після проведення занять</p>
        </div>
      );
    }

    return (
      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Group sections ── */}
        {groupedData.groups.length > 0 && (
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
              Групові заняття ({groupedData.groups.length} {groupedData.groups.length === 1 ? 'група' : groupedData.groups.length < 5 ? 'групи' : 'груп'})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {groupedData.groups.map(g => (
                <div key={g.group_id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.875rem', overflow: 'hidden' }}>
                  {/* Group header */}
                  <div style={{ padding: '0.875rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1rem', color: '#111827' }}>{g.group_title}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {g.course_title && <span>{g.course_title}</span>}
                        {g.weekly_day && g.start_time && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '2px 8px', backgroundColor: '#eef2ff', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, color: '#4f46e5' }}>
                            📅 Щo{WEEKDAY_UK[g.weekly_day].toLowerCase()} о {g.start_time?.slice(0, 5)}
                          </span>
                        )}
                        <span style={{ padding: '2px 8px', backgroundColor: '#f3f4f6', borderRadius: 6, fontSize: '0.75rem', color: '#6b7280' }}>
                          {g.lessons.length} {g.lessons.length === 1 ? 'заняття' : 'занять'} у місяці
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{g.students.length} учнів</span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 44, height: 26, padding: '0 0.625rem',
                        backgroundColor: g.avg_rate >= 80 ? '#16a34a' : g.avg_rate >= 60 ? '#d97706' : '#dc2626',
                        color: 'white', borderRadius: 13, fontSize: '0.8125rem', fontWeight: 600,
                      }}>
                        {g.avg_rate}%
                      </span>
                    </div>
                  </div>
                  {/* Register matrix */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                          <th style={{ padding: '0.625rem 1.25rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.8125rem', position: 'sticky', left: 0, backgroundColor: '#fafafa', minWidth: 160, whiteSpace: 'nowrap' }}>Учень</th>
                          {g.lessons.map(l => (
                            <th key={l.lesson_id} style={{ padding: '0.375rem 0.625rem', textAlign: 'center', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }} title={l.topic || undefined}>
                              <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 500 }}>{getWeekdayShort(l.lesson_date)}</div>
                              <div style={{ fontSize: '0.75rem' }}>{formatDateShort(l.lesson_date)}</div>
                              {l.topic && <div style={{ fontSize: '0.55rem', color: '#9ca3af', fontWeight: 400, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.topic}</div>}
                            </th>
                          ))}
                          <th style={{ padding: '0.625rem 1rem', textAlign: 'center', fontWeight: 600, color: '#374151', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>Всього</th>
                          <th style={{ padding: '0.625rem 1.25rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.8125rem', minWidth: 110 }}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.students.map(s => (
                          <tr key={s.student_id}
                            style={{ borderBottom: '1px solid #f9fafb', cursor: 'pointer' }}
                            onClick={() => router.push(`/students/${s.student_id}`)}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                            <td style={{ padding: '0.625rem 1.25rem', fontWeight: 500, color: '#111827', position: 'sticky', left: 0, backgroundColor: 'white', whiteSpace: 'nowrap' }}>{s.student_name}</td>
                            {g.lessons.map(l => (
                              <td key={l.lesson_id} style={{ padding: '0.5rem 0.625rem', textAlign: 'center' }}>
                                <AttCell status={s.attendance[l.lesson_id] ?? null} />
                              </td>
                            ))}
                            <td style={{ padding: '0.625rem 1rem', textAlign: 'center', color: '#374151' }}>
                              <span style={{ fontWeight: 600, color: '#16a34a' }}>{s.present}</span>
                              <span style={{ color: '#9ca3af' }}>/{g.lessons.length}</span>
                              {s.absent > 0 && <span style={{ color: '#dc2626', marginLeft: 4, fontSize: '0.8125rem' }}>({s.absent}✗)</span>}
                            </td>
                            <td style={{ padding: '0.625rem 1.25rem' }}><RateBar rate={s.rate} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Individual lessons section ── */}
        {groupedData.individual_lessons.length > 0 && (
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
              Індивідуальні заняття ({groupedData.individual_lessons.length})
            </div>
            <div style={{ border: '1px solid #e8d5ff', borderRadius: '0.875rem', overflow: 'hidden', backgroundColor: '#fdf8ff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5eeff', borderBottom: '1px solid #e8d5ff' }}>
                    <th style={{ padding: '0.625rem 1.25rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>Дата</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>Час</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.8125rem' }}>Учні та відвідуваність</th>
                    <th style={{ padding: '0.625rem 1.25rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.8125rem' }}>Тема</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedData.individual_lessons.map(il => (
                    <tr key={il.lesson_id} style={{ borderBottom: '1px solid #f3e8ff' }}>
                      <td style={{ padding: '0.75rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{formatDateShort(il.lesson_date)}</div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 1 }}>{getWeekdayShort(il.lesson_date)}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.75rem', whiteSpace: 'nowrap' }}>
                        {il.start_time ? (
                          <span style={{ padding: '2px 8px', borderRadius: 6, backgroundColor: '#f3e8ff', color: '#7c3aed', fontSize: '0.8125rem', fontWeight: 600 }}>{il.start_time}</span>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                          {il.students.map(s => (
                            <div key={s.student_id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <StatusBadge status={s.status} />
                              <span
                                style={{ fontSize: '0.8125rem', color: '#1d4ed8', cursor: 'pointer', fontWeight: 500 }}
                                onClick={() => router.push(`/students/${s.student_id}`)}>
                                {s.student_name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1.25rem', color: '#6b7280', fontSize: '0.8125rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={il.topic || undefined}>
                        {il.topic || <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Register (журнал групи) ───────────────────────────────────────────────

  function renderRegisterView() {
    if (!selectedGroup) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Оберіть групу для перегляду журналу</p>
        </div>
      );
    }
    if (!register || register.lessons.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
          <p style={{ margin: 0, fontSize: '0.9375rem' }}>У цьому місяці немає занять для обраної групи</p>
        </div>
      );
    }
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={{ padding: '0.875rem 1.5rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: '#f9fafb', minWidth: 180, whiteSpace: 'nowrap' }}>Учень</th>
              {register.lessons.map(l => (
                <th key={l.lesson_id} style={{ padding: '0.5rem 0.875rem', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }} title={l.topic || undefined}>
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 500 }}>{getWeekdayShort(l.lesson_date)}</div>
                  <div>{formatDateShort(l.lesson_date)}</div>
                  {l.topic && <div style={{ fontSize: '0.6rem', color: '#9ca3af', fontWeight: 400, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.topic}</div>}
                </th>
              ))}
              <th style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>Всього</th>
              <th style={{ padding: '0.875rem 1.5rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', minWidth: 120, whiteSpace: 'nowrap' }}>%</th>
            </tr>
          </thead>
          <tbody>
            {register.students.map(s => (
              <tr key={s.student_id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                onClick={() => router.push(`/students/${s.student_id}`)}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <td style={{ padding: '0.875rem 1.5rem', fontWeight: 500, color: '#111827', position: 'sticky', left: 0, backgroundColor: 'white', whiteSpace: 'nowrap' }}>{s.student_name}</td>
                {register.lessons.map(l => (
                  <td key={l.lesson_id} style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                    <AttCell status={s.attendance[l.lesson_id] ?? null} />
                  </td>
                ))}
                <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: '#374151' }}>
                  <span style={{ fontWeight: 600, color: '#16a34a' }}>{s.present}</span>
                  <span style={{ color: '#9ca3af' }}>/{register.lessons.length}</span>
                  {s.absent > 0 && <span style={{ color: '#dc2626', marginLeft: 6 }}>({s.absent}✗)</span>}
                </td>
                <td style={{ padding: '0.875rem 1.5rem' }}><RateBar rate={s.rate} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Summary (загальна таблиця) ───────────────────────────────────────────

  function renderSummaryView() {
    if (lessonRecords.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Даних про відвідуваність немає</p>
          <p style={{ margin: 0, fontSize: '0.8125rem' }}>Відвідуваність з&apos;явиться після того, як викладач відмітить присутність</p>
        </div>
      );
    }
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Дата</th>
              <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Час</th>
              <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Тип / Група</th>
              <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Учень</th>
              <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Тема</th>
              <th style={{ padding: '0.75rem 1.25rem', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {lessonRecords.map((r, i) => (
              <tr key={`${r.lesson_id}-${r.student_id}-${i}`}
                style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                onClick={() => router.push(`/students/${r.student_id}`)}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <td style={{ padding: '0.625rem 1.25rem', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 500, color: '#111827' }}>{formatDateShort(r.lesson_date)}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{getWeekdayShort(r.lesson_date)}</div>
                </td>
                <td style={{ padding: '0.625rem 0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {r.start_time ? (
                    <span style={{ padding: '1px 7px', borderRadius: 4, backgroundColor: '#f3f4f6', color: '#374151', fontSize: '0.8125rem' }}>{r.start_time}</span>
                  ) : '—'}
                </td>
                <td style={{ padding: '0.625rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                    <span style={{ padding: '1px 7px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, backgroundColor: r.group_id ? '#dbeafe' : '#f3e8ff', color: r.group_id ? '#1d4ed8' : '#7c3aed' }}>
                      {r.group_id ? 'Групове' : 'Індив.'}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>{r.group_title}</span>
                  </div>
                </td>
                <td style={{ padding: '0.625rem 0.75rem', fontWeight: 500, color: '#111827' }}>{r.student_name}</td>
                <td style={{ padding: '0.625rem 0.75rem', color: '#6b7280', fontSize: '0.8125rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.topic || undefined}>{r.topic || '—'}</td>
                <td style={{ padding: '0.625rem 1.25rem', textAlign: 'center' }}>
                  <StatusLabel status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
