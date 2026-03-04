'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { t } from '@/i18n/t';
import PageLoading from '@/components/PageLoading';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('attendance');
  const [reportData, setReportData] = useState<any>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    month: new Date().toISOString().substring(0, 7) + '-01',
    groupId: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) {
          router.push('/login');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const loadReport = async () => {
    setReportData(null);
    try {
      let url = '';
      const params = new URLSearchParams();
      
      switch (activeTab) {
        case 'attendance':
          url = '/api/reports/attendance';
          if (filters.startDate) params.append('startDate', filters.startDate);
          if (filters.endDate) params.append('endDate', filters.endDate);
          if (filters.groupId) params.append('groupId', filters.groupId);
          break;
        case 'payments':
          url = '/api/reports/payments';
          if (filters.startDate) params.append('startDate', filters.startDate);
          if (filters.endDate) params.append('endDate', filters.endDate);
          if (filters.groupId) params.append('groupId', filters.groupId);
          break;
        case 'debts':
          url = '/api/reports/debts';
          params.append('month', filters.month);
          break;
      }

      const res = await fetch(`${url}?${params.toString()}`);
      const data = await res.json();
      setReportData(data);
    } catch (error) {
      console.error('Failed to load report:', error);
    }
  };

  const exportCSV = async () => {
    let url = '';
    const params = new URLSearchParams();
    params.append('format', 'csv');
    
    switch (activeTab) {
      case 'attendance':
        url = '/api/reports/attendance';
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.groupId) params.append('groupId', filters.groupId);
        break;
      case 'payments':
        url = '/api/reports/payments';
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.groupId) params.append('groupId', filters.groupId);
        break;
      case 'debts':
        url = '/api/reports/debts';
        params.append('month', filters.month);
        break;
    }

    window.open(`${url}?${params.toString()}`, '_blank');
  };

  if (loading) {
    return <PageLoading />;
  }

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{t('pages.reports')}</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={loadReport}>
              {t('actions.refresh')}
            </button>
            <button className="btn btn-primary" onClick={exportCSV}>
              {t('actions.export')} CSV
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ padding: '0 1.5rem' }}>
          <button
            className={`tab ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => { setActiveTab('attendance'); setReportData(null); }}
          >
            {t('reports.attendance')}
          </button>
          <button
            className={`tab ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => { setActiveTab('payments'); setReportData(null); }}
          >
            {t('reports.payments')}
          </button>
          <button
            className={`tab ${activeTab === 'debts' ? 'active' : ''}`}
            onClick={() => { setActiveTab('debts'); setReportData(null); }}
          >
            {t('reports.debts')}
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {activeTab === 'attendance' && (
              <>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('common.from')}</label>
                  <input
                    type="date"
                    className="form-input"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    style={{ width: 'auto' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('common.to')}</label>
                  <input
                    type="date"
                    className="form-input"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    style={{ width: 'auto' }}
                  />
                </div>
              </>
            )}
            {activeTab === 'payments' && (
              <>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('common.from')}</label>
                  <input
                    type="date"
                    className="form-input"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    style={{ width: 'auto' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('common.to')}</label>
                  <input
                    type="date"
                    className="form-input"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    style={{ width: 'auto' }}
                  />
                </div>
              </>
            )}
            {activeTab === 'debts' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('forms.month')}</label>
                <input
                  type="month"
                  className="form-input"
                  value={filters.month.substring(0, 7)}
                  onChange={(e) => setFilters({ ...filters, month: e.target.value + '-01' })}
                  style={{ width: 'auto' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Report content */}
        <div className="card-body">
          {!reportData ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              {t('emptyStates.selectFilters')}
            </div>
          ) : activeTab === 'attendance' ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('nav.students')}</th>
                    <th style={{ textAlign: 'center' }}>{t('table.total')}</th>
                    <th style={{ textAlign: 'center' }}>{t('table.present')}</th>
                    <th style={{ textAlign: 'center' }}>{t('table.absent')}</th>
                    <th style={{ textAlign: 'center' }}>{t('table.makeup')}</th>
                    <th style={{ textAlign: 'center' }}>{t('table.percent')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.report?.map((row: any) => (
                    <tr key={row.student_id}>
                      <td>{row.student_name}</td>
                      <td style={{ textAlign: 'center' }}>{row.total}</td>
                      <td style={{ textAlign: 'center' }}>{row.present}</td>
                      <td style={{ textAlign: 'center' }}>{row.absent}</td>
                      <td style={{ textAlign: 'center' }}>{row.makeup_done}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${row.attendance_rate >= 80 ? 'badge-success' : row.attendance_rate >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                          {row.attendance_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'payments' ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', backgroundColor: '#dcfce7', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#166534' }}>{t('reports.totalPaid')}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{reportData.stats?.total_amount || 0} UAH</div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: '#dbeafe', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>{t('reports.cash')}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{reportData.stats?.cash_amount || 0} UAH</div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#92400e' }}>{t('reports.account')}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{reportData.stats?.account_amount || 0} UAH</div>
                </div>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {t('reports.operationsCount')}: {reportData.stats?.payments_count || 0}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', backgroundColor: '#fee2e2', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#991b1b' }}>{t('reports.totalDebt')}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{reportData.totalDebt || 0} UAH</div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#92400e' }}>{t('reports.debtors')}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{reportData.studentsCount || 0}</div>
                </div>
              </div>
              
              {reportData.debtors?.length > 0 && (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('nav.students')}</th>
                        <th>{t('table.group')}</th>
                        <th>{t('table.phone')}</th>
                        <th>{t('table.parentPhone')}</th>
                        <th style={{ textAlign: 'right' }}>{t('table.debt')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.debtors.map((debtor: any) => (
                        <tr key={debtor.id}>
                          <td>{debtor.full_name}</td>
                          <td>{debtor.group_title}</td>
                          <td>{debtor.phone || '---'}</td>
                          <td>{debtor.parent_phone || '---'}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600', color: '#dc2626' }}>
                            {debtor.debt} UAH
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
