'use client';

import { useState, useEffect, useCallback } from 'react';
import { t } from '@/i18n/t';

interface LessonRow {
  lesson_id: number;
  lesson_date: string;
  start_datetime: string | null;
  group_id: number | null;
  group_title: string | null;
  course_title: string | null;
  topic: string | null;
  status: 'present' | 'absent' | 'makeup_planned' | 'makeup_done' | null;
}

interface GroupStat {
  group_id: number;
  group_title: string;
  course_title: string | null;
  total: number;
  present: number;
  absent: number;
  makeup_planned: number;
  makeup_done: number;
  attendance_rate: number;
}

interface Summary {
  total: number;
  present: number;
  absent: number;
  makeup_planned: number;
  makeup_done: number;
  attendance_rate: number;
}

const STATUS_COLOR: Record<string, string> = {
  present: '#16a34a',
  absent: '#dc2626',
  makeup_planned: '#d97706',
  makeup_done: '#2563eb',
};

const STATUS_BG: Record<string, string> = {
  present: '#dcfce7',
  absent: '#fee2e2',
  makeup_planned: '#fef3c7',
  makeup_done: '#dbeafe',
};

const STATUS_LABEL: Record<string, string> = {
  present: t('attendance.present'),
  absent: t('attendance.absent'),
  makeup_planned: t('attendance.makeupPlanned'),
  makeup_done: t('attendance.makeupDone'),
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function RateBar({ rate, size = 'md' }: { rate: number; size?: 'sm' | 'md' }) {
  const color = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';
  const height = size === 'sm' ? 4 : 6;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        flex: 1,
        height,
        backgroundColor: '#e5e7eb',
        borderRadius: height,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${rate}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: height,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: size === 'sm' ? '0.75rem' : '0.8125rem', fontWeight: 600, color, minWidth: '36px', textAlign: 'right' }}>
        {rate}%
      </span>
    </div>
  );
}

export default function StudentAttendancePanel({ studentId }: { studentId: number }) {
  const [tab, setTab] = useState<'summary' | 'lessons'>('summary');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [groups, setGroups] = useState<GroupStat[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const LIMIT = 20;

  const loadSummary = useCallback(async () => {
    const [summaryRes, groupsRes] = await Promise.all([
      fetch(`/api/students/${studentId}/attendance?view=summary`),
      fetch(`/api/students/${studentId}/attendance?view=byGroup`),
    ]);
    if (summaryRes.ok) {
      const data = await summaryRes.json();
      setSummary(data.summary);
    }
    if (groupsRes.ok) {
      const data = await groupsRes.json();
      setGroups(data.groups || []);
    }
  }, [studentId]);

  const loadLessons = useCallback(async (reset = false) => {
    const newOffset = reset ? 0 : offset;
    setLoading(true);
    const params = new URLSearchParams({
      limit: LIMIT.toString(),
      offset: newOffset.toString(),
    });
    if (filterStatus) params.set('status', filterStatus);
    if (filterGroup) params.set('groupId', filterGroup);

    const res = await fetch(`/api/students/${studentId}/attendance?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (reset) {
        setLessons(data.lessons || []);
        setOffset(LIMIT);
      } else {
        setLessons(prev => [...prev, ...(data.lessons || [])]);
        setOffset(prev => prev + LIMIT);
      }
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [studentId, offset, filterStatus, filterGroup]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (tab === 'lessons') {
      setOffset(0);
      loadLessons(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filterStatus, filterGroup, studentId]);

  const handleExportCSV = () => {
    const params = new URLSearchParams({ limit: '9999', offset: '0' });
    if (filterStatus) params.set('status', filterStatus);
    if (filterGroup) params.set('groupId', filterGroup);

    const rows: string[][] = [[
      t('table.date'), t('table.group'), t('table.topic'), t('attendance.rate'),
    ]];
    lessons.forEach(l => {
      rows.push([
        formatDate(l.lesson_date),
        l.group_title || '—',
        l.topic || '—',
        l.status ? (STATUS_LABEL[l.status] || l.status) : '—',
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${studentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card" style={{
      marginBottom: '2rem',
      borderRadius: '1rem',
      overflow: 'hidden',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.5rem 2rem',
        borderBottom: '1px solid var(--gray-200)',
      }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--gray-800)', letterSpacing: '-0.025em' }}>
          {t('attendance.panel')}
        </h2>
        {summary && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 28, height: 28, padding: '0 0.625rem',
            backgroundColor: summary.attendance_rate >= 80 ? '#16a34a' : summary.attendance_rate >= 60 ? '#d97706' : '#dc2626',
            color: 'white', borderRadius: 14, fontSize: '0.8125rem', fontWeight: 600,
          }}>
            {summary.attendance_rate}%
          </span>
        )}
      </div>

      {/* Summary KPI row */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0,
          borderBottom: '1px solid var(--gray-100)',
        }}>
          {[
            { label: t('attendance.totalLessons'), value: summary.total, color: '#374151' },
            { label: t('attendance.attended'), value: summary.present, color: '#16a34a' },
            { label: t('attendance.missed'), value: summary.absent, color: '#dc2626' },
            { label: t('attendance.makeup'), value: summary.makeup_planned + summary.makeup_done, color: '#d97706' },
          ].map((kpi, i) => (
            <div key={i} style={{
              padding: '1rem 1.5rem',
              borderRight: i < 3 ? '1px solid var(--gray-100)' : 'none',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', paddingLeft: '1rem' }}>
        {(['summary', 'lessons'] as const).map((t_) => (
          <button
            key={t_}
            onClick={() => setTab(t_)}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '0.875rem',
              fontWeight: tab === t_ ? 600 : 400,
              color: tab === t_ ? 'var(--primary)' : '#6b7280',
              borderBottom: tab === t_ ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t_ === 'summary' ? t('attendance.byGroup') : t('attendance.lessonHistory')}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'summary' && (
        <div style={{ padding: '1.5rem 2rem' }}>
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>{t('attendance.noData')}</p>
              <p style={{ margin: 0, fontSize: '0.8125rem' }}>{t('attendance.noDataHint')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {groups.map(g => (
                <div key={g.group_id} style={{
                  padding: '1rem 1.25rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.75rem',
                  border: '1px solid #e5e7eb',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>{g.group_title}</div>
                      {g.course_title && <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{g.course_title}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <span title={t('attendance.attended')} style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#dcfce7', color: '#16a34a' }}>✓ {g.present}</span>
                      <span title={t('attendance.missed')} style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#fee2e2', color: '#dc2626' }}>✗ {g.absent}</span>
                      {(g.makeup_planned + g.makeup_done) > 0 && (
                        <span title={t('attendance.makeup')} style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#fef3c7', color: '#d97706' }}>↺ {g.makeup_planned + g.makeup_done}</span>
                      )}
                    </div>
                  </div>
                  <RateBar rate={g.attendance_rate} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'lessons' && (
        <div>
          {/* Filters + Export */}
          <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem 2rem', flexWrap: 'wrap', borderBottom: '1px solid var(--gray-100)', alignItems: 'center' }}>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '0.375rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#374151', backgroundColor: 'white' }}
            >
              <option value="">{t('attendance.allStatuses')}</option>
              <option value="present">{t('attendance.present')}</option>
              <option value="absent">{t('attendance.absent')}</option>
              <option value="makeup_planned">{t('attendance.makeupPlanned')}</option>
              <option value="makeup_done">{t('attendance.makeupDone')}</option>
            </select>
            {groups.length > 0 && (
              <select
                value={filterGroup}
                onChange={e => setFilterGroup(e.target.value)}
                style={{ padding: '0.375rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#374151', backgroundColor: 'white' }}
              >
                <option value="">{t('attendance.allGroups')}</option>
                {groups.map(g => (
                  <option key={g.group_id} value={g.group_id}>{g.group_title}</option>
                ))}
              </select>
            )}
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={handleExportCSV}
                style={{
                  padding: '0.375rem 0.875rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {t('attendance.exportCSV')}
              </button>
            </div>
          </div>

          {/* Table */}
          {lessons.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
              <p style={{ margin: 0 }}>{t('attendance.noData')}</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{t('table.date')}</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{t('table.group')}</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{t('table.topic')}</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{t('attendance.title')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map(lesson => (
                    <tr key={lesson.lesson_id} style={{ borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.875rem 1.5rem', color: '#374151', whiteSpace: 'nowrap' }}>
                        {formatDate(lesson.lesson_date)}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: '#374151' }}>
                        {lesson.group_title || <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: '#6b7280', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lesson.topic || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.875rem 1.5rem', textAlign: 'right' }}>
                        {lesson.status ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: 99,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: STATUS_BG[lesson.status] || '#f3f4f6',
                            color: STATUS_COLOR[lesson.status] || '#374151',
                          }}>
                            {STATUS_LABEL[lesson.status] || lesson.status}
                          </span>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', fontSize: '0.875rem' }}>
              Завантаження...
            </div>
          )}

          {/* Load more */}
          {!loading && lessons.length < total && (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <button
                onClick={() => loadLessons(false)}
                style={{
                  padding: '0.5rem 1.5rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                {t('attendance.loadMore')} ({total - lessons.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
