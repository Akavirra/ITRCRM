'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { t } from '@/i18n/t';
import { uk } from '@/i18n/uk';
import { formatDateShortMonthKyiv, formatTimeKyiv } from '@/lib/date-utils';
import PageLoading from '@/components/PageLoading';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface DashboardStats {
  activeGroups: number;
  upcomingLessons: number;
  totalDebt: number;
  debtorsCount: number;
}

interface UpcomingLesson {
  id: number;
  lesson_date: string;
  start_datetime: string;
  group_title: string;
  course_title: string;
  teacher_name?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingLessons, setUpcomingLessons] = useState<UpcomingLesson[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check auth
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) {
          router.push('/login');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);

        // Fetch dashboard data
        const [groupsRes, lessonsRes, debtsRes] = await Promise.all([
          fetch('/api/groups'),
          fetch('/api/lessons?limit=5'),
          fetch(`/api/reports/debts?month=${new Date().toISOString().substring(0, 7)}-01`),
        ]);

        const groupsData = await groupsRes.json();
        const lessonsData = await lessonsRes.json();
        const debtsData = await debtsRes.json();

        setStats({
          activeGroups: groupsData.groups?.length || 0,
          upcomingLessons: lessonsData.lessons?.length || 0,
          totalDebt: debtsData.totalDebt || 0,
          debtorsCount: debtsData.studentsCount || 0,
        });
        setUpcomingLessons(lessonsData.lessons || []);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <Layout user={{ id: 0, name: '', email: '', role: 'admin' }}>
        <PageLoading />
      </Layout>
    );
  }

  if (!user) return null;

  const formatDate = (dateStr: string) => {
    return formatDateShortMonthKyiv(dateStr);
  };

  const formatTime = (datetimeStr: string) => {
    return formatTimeKyiv(datetimeStr);
  };

  return (
    <Layout user={user}>
      {/* Stats cards */}
      <div className="stats-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
      }}>
        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '0.5rem',
                backgroundColor: '#dbeafe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t('dashboard.activeGroups')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{stats?.activeGroups || 0}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '0.5rem',
                backgroundColor: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t('dashboard.upcomingLessons')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{stats?.upcomingLessons || 0}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '0.5rem',
                backgroundColor: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t('dashboard.monthlyDebt')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{stats?.totalDebt || 0} UAH</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '0.5rem',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t('dashboard.debtorsCount')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{stats?.debtorsCount || 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming lessons */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{t('dashboard.upcomingLessons')}</h3>
          <a href="/schedule" className="btn btn-secondary btn-sm">{t('dashboard.allLessons')}</a>
        </div>
        <div className="table-container">
          {upcomingLessons.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('table.date')}</th>
                  <th>{t('table.time')}</th>
                  <th>{t('table.group')}</th>
                  <th>{t('table.course')}</th>
                  {user.role === 'admin' && <th>{t('table.teacher')}</th>}
                </tr>
              </thead>
              <tbody>
                {upcomingLessons.map((lesson) => (
                  <tr key={lesson.id}>
                    <td>{formatDate(lesson.lesson_date)}</td>
                    <td>{formatTime(lesson.start_datetime)}</td>
                    <td>{lesson.group_title}</td>
                    <td>{lesson.course_title}</td>
                    {user.role === 'admin' && <td>{lesson.teacher_name}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p style={{ color: '#6b7280' }}>{t('emptyStates.noLessons')}</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
