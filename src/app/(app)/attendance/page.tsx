'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { t } from '@/i18n/t';

interface Totals {
  total_lessons: number;
  total_records: number;
  present: number;
  absent: number;
  makeup_planned: number;
  makeup_done: number;
  overall_rate: number;
  students_count: number;
}

interface StatRow {
  student_id: number;
  student_name: string;
  group_id: number | null;
  group_title: string | null;
  total: number;
  present: number;
  absent: number;
  makeup_planned: number;
  makeup_done: number;
  attendance_rate: number;
}

interface Group {
  id: number;
  title: string;
}

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${rate}%`, height: '100%', backgroundColor: color, borderRadius: 6, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color, minWidth: '36px', textAlign: 'right' }}>{rate}%</span>
    </div>
  );
}

export default function AttendancePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; name: string; email: string; role: 'admin' | 'teacher' } | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [rows, setRows] = useState<StatRow[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rate' | 'absent'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [offset, setOffset] = useState(0);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const LIMIT = 50;

  // Auth
  useEffect(() => {
    fetch('/api/auth/me').then(res => {
      if (!res.ok) { router.push('/login'); return; }
      return res.json();
    }).then(data => data && setUser(data.user));
  }, [router]);

  // Load groups for filter
  useEffect(() => {
    fetch('/api/groups?limit=200').then(r => r.json()).then(data => {
      setGroups((data.groups || data || []).map((g: { id: number; title: string }) => ({ id: g.id, title: g.title })));
    }).catch(() => {});
  }, []);

  // Load KPI totals
  useEffect(() => {
    fetch('/api/attendance?view=totals').then(r => r.json()).then(data => {
      if (data.totals) setTotals(data.totals);
    }).catch(() => {});
  }, []);

  const loadRows = useCallback(async (reset = false) => {
    const newOffset = reset ? 0 : offset;
    setLoading(true);
    const params = new URLSearchParams({
      limit: LIMIT.toString(),
      offset: newOffset.toString(),
      sortBy,
      sortDir,
    });
    if (groupId) params.set('groupId', groupId);
    if (search) params.set('search', search);

    const res = await fetch(`/api/attendance?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (reset) {
        setRows(data.rows || []);
        setOffset(LIMIT);
      } else {
        setRows(prev => [...prev, ...(data.rows || [])]);
        setOffset(prev => prev + LIMIT);
      }
      setRowsTotal(data.total || 0);
    }
    setLoading(false);
  }, [offset, sortBy, sortDir, groupId, search]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setOffset(0);
      loadRows(true);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, groupId, sortBy, sortDir]);

  const handleSort = (col: 'name' | 'rate' | 'absent') => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const handleExportCSV = () => {
    const header = [t('table.student'), t('table.group'), t('table.total'), t('table.present'), t('table.absent'), t('table.makeup'), t('table.percent')];
    const csvRows = [header, ...rows.map(r => [
      r.student_name,
      r.group_title || '—',
      r.total,
      r.present,
      r.absent,
      r.makeup_planned + r.makeup_done,
      `${r.attendance_rate}%`,
    ])];
    const csv = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance_global.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: 'name' | 'rate' | 'absent' }) => (
    <span style={{ marginLeft: 4, color: sortBy === col ? '#1565c0' : '#d1d5db', fontSize: '0.75rem' }}>
      {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  if (!user) return null;

  return (
    <Layout user={user}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Page header */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--gray-900)' }}>
              {t('attendance.globalTitle')}
            </h1>
          </div>
          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              border: '1px solid #e5e7eb', borderRadius: '0.625rem',
              backgroundColor: 'white', color: '#374151',
              fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t('attendance.exportCSV')}
          </button>
        </div>

        {/* KPI cards */}
        {totals && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { label: t('attendance.totalLessons'), value: totals.total_lessons, color: '#374151', bg: '#f9fafb' },
              { label: t('attendance.studentsCount'), value: totals.students_count, color: '#1d4ed8', bg: '#dbeafe' },
              { label: t('attendance.attended'), value: totals.present, color: '#16a34a', bg: '#dcfce7' },
              { label: t('attendance.missed'), value: totals.absent, color: '#dc2626', bg: '#fee2e2' },
              { label: t('attendance.makeup'), value: totals.makeup_planned + totals.makeup_done, color: '#d97706', bg: '#fef3c7' },
              { label: t('attendance.overallRate'), value: `${totals.overall_rate}%`, color: totals.overall_rate >= 80 ? '#16a34a' : totals.overall_rate >= 60 ? '#d97706' : '#dc2626', bg: '#f9fafb' },
            ].map((kpi, i) => (
              <div key={i} className="card" style={{ padding: '1.25rem', borderRadius: '0.875rem', backgroundColor: kpi.bg, border: 'none' }}>
                <div style={{ fontSize: '1.625rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 4 }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', borderRadius: '0.875rem' }}>
          <input
            type="text"
            placeholder="Пошук учня..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: '0.5rem 0.875rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#374151' }}
          />
          <select
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            style={{ padding: '0.5rem 0.875rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#374151', backgroundColor: 'white' }}
          >
            <option value="">{t('attendance.allGroups')}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <select
            value={`${sortBy}:${sortDir}`}
            onChange={e => {
              const [col, dir] = e.target.value.split(':');
              setSortBy(col as 'name' | 'rate' | 'absent');
              setSortDir(dir as 'asc' | 'desc');
            }}
            style={{ padding: '0.5rem 0.875rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#374151', backgroundColor: 'white' }}
          >
            <option value="name:asc">{t('attendance.sortName')} (А-Я)</option>
            <option value="name:desc">{t('attendance.sortName')} (Я-А)</option>
            <option value="rate:desc">{t('attendance.sortRate')} ↓</option>
            <option value="rate:asc">{t('attendance.sortRate')} ↑</option>
            <option value="absent:desc">{t('attendance.sortAbsent')} ↓</option>
            <option value="absent:asc">{t('attendance.sortAbsent')} ↑</option>
          </select>
        </div>

        {/* Table */}
        <div className="card" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th
                  onClick={() => handleSort('name')}
                  style={{ padding: '0.875rem 1.5rem', textAlign: 'left', fontWeight: 600, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {t('table.student')}<SortIcon col="name" />
                </th>
                <th style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                  {t('table.group')}
                </th>
                <th style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 600, color: '#374151' }}>
                  {t('table.total')}
                </th>
                <th style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>
                  {t('table.present')}
                </th>
                <th
                  onClick={() => handleSort('absent')}
                  style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 600, color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {t('table.absent')}<SortIcon col="absent" />
                </th>
                <th style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 600, color: '#d97706' }}>
                  {t('table.makeup')}
                </th>
                <th
                  onClick={() => handleSort('rate')}
                  style={{ padding: '0.875rem 1.5rem', textAlign: 'left', fontWeight: 600, color: '#374151', cursor: 'pointer', minWidth: '160px', whiteSpace: 'nowrap' }}
                >
                  {t('table.percent')}<SortIcon col="rate" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                    {t('attendance.noData')}
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr
                    key={`${row.student_id}-${row.group_id}-${i}`}
                    style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                    onClick={() => router.push(`/students/${row.student_id}`)}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '0.875rem 1.5rem', fontWeight: 500, color: '#111827' }}>
                      {row.student_name}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>
                      {row.group_title || '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: '#374151' }}>
                      {row.total}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>
                      {row.present}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: row.absent > 0 ? '#dc2626' : '#9ca3af', fontWeight: row.absent > 0 ? 600 : 400 }}>
                      {row.absent}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: '#d97706' }}>
                      {row.makeup_planned + row.makeup_done > 0 ? row.makeup_planned + row.makeup_done : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.875rem 1.5rem', minWidth: '160px' }}>
                      <RateBar rate={row.attendance_rate} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {loading && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
              Завантаження...
            </div>
          )}

          {!loading && rows.length < rowsTotal && (
            <div style={{ padding: '1rem', textAlign: 'center', borderTop: '1px solid #f3f4f6' }}>
              <button
                onClick={() => loadRows(false)}
                style={{
                  padding: '0.5rem 1.5rem',
                  border: '1px solid #e5e7eb', borderRadius: '0.5rem',
                  backgroundColor: 'white', color: '#374151',
                  fontSize: '0.875rem', cursor: 'pointer',
                }}
              >
                {t('attendance.loadMore')} ({rowsTotal - rows.length})
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
