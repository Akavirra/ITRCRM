'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useGroupModals } from '@/components/GroupModalsContext';
import { useStudentModals } from '@/components/StudentModalsContext';
import PageLoading from '@/components/PageLoading';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface GroupOption {
  id: number;
  title: string;
}

interface StudentDebt {
  id: number;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  group_id: number;
  group_title: string;
  lessons_count: number;
  lesson_price: number;
  discount_percent: number;
  expected_amount: number;
  paid_amount: number;
  debt: number;
}

interface IndividualBalance {
  lessons_paid: number;
  lessons_used: number;
  lessons_remaining: number;
}

interface IndividualDebtor {
  id: number;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  balance: IndividualBalance;
}

interface OverviewData {
  month: string;
  lesson_price: number;
  group_debts: {
    total_debt: number;
    students_count: number;
    debtors: StudentDebt[];
  };
  individual_debtors: IndividualDebtor[];
  collected: {
    total_amount: number;
    cash_amount: number;
    account_amount: number;
    payments_count: number;
  };
}

// Payment form modal
interface PaymentForm {
  student_id: number;
  student_name: string;
  group_id: number | null;
  group_title: string;
  type: 'group' | 'individual';
  amount: string;
  lessons_count: string;
  method: 'cash' | 'account';
  note: string;
  paid_at: string;
  month: string;
  debt: number;
}

const MONTH_NAMES = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
];

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  // Show 6 months back and 1 month forward
  for (let i = -6; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

export default function PaymentsPage() {
  const router = useRouter();
  const { openGroupModal } = useGroupModals();
  const { openStudentModal } = useStudentModals();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData | null>(null);
  const [groups, setGroups] = useState<GroupOption[]>([]);

  // Filters
  const currentMonth = new Date().toISOString().substring(0, 7) + '-01';
  const [month, setMonth] = useState(currentMonth);
  const [groupFilter, setGroupFilter] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'group' | 'individual'>('group');

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/overview?month=${month}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Failed to fetch payments overview:', error);
    }
  }, [month]);

  useEffect(() => {
    const init = async () => {
      try {
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) {
          router.push('/login');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);

        const [groupsRes] = await Promise.all([
          fetch('/api/groups'),
        ]);
        const groupsData = await groupsRes.json();
        setGroups((groupsData.groups || []).map((g: { id: number; title: string }) => ({
          id: g.id,
          title: g.title,
        })));
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Filter group debtors
  const filteredGroupDebtors = (data?.group_debts.debtors || []).filter(d => {
    if (groupFilter && d.group_id !== parseInt(groupFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.full_name.toLowerCase().includes(q) && !d.group_title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Filter individual debtors
  const filteredIndividualDebtors = (data?.individual_debtors || []).filter(d => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.full_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openPaymentForm = (debtor: StudentDebt) => {
    setPaymentForm({
      student_id: debtor.id,
      student_name: debtor.full_name,
      group_id: debtor.group_id,
      group_title: debtor.group_title,
      type: 'group',
      amount: String(debtor.debt),
      lessons_count: '',
      method: 'cash',
      note: '',
      paid_at: new Date().toISOString().split('T')[0],
      month,
      debt: debtor.debt,
    });
    setSaveError('');
    setShowPaymentModal(true);
  };

  const openIndividualPaymentForm = (debtor: IndividualDebtor) => {
    setPaymentForm({
      student_id: debtor.id,
      student_name: debtor.full_name,
      group_id: null,
      group_title: '',
      type: 'individual',
      amount: '',
      lessons_count: '1',
      method: 'cash',
      note: '',
      paid_at: new Date().toISOString().split('T')[0],
      month,
      debt: Math.abs(debtor.balance.lessons_remaining) * (data?.lesson_price || 300),
    });
    setSaveError('');
    setShowPaymentModal(true);
  };

  const handleSavePayment = async () => {
    if (!paymentForm) return;
    setSaving(true);
    setSaveError('');

    try {
      if (paymentForm.type === 'group') {
        const amount = parseFloat(paymentForm.amount);
        if (isNaN(amount) || amount <= 0) {
          setSaveError('Введіть коректну суму');
          setSaving(false);
          return;
        }

        const res = await fetch(`/api/groups/${paymentForm.group_id}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: paymentForm.student_id,
            month: paymentForm.month,
            amount,
            method: paymentForm.method,
            note: paymentForm.note || undefined,
            paid_at: paymentForm.paid_at ? new Date(paymentForm.paid_at).toISOString() : undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setSaveError(err.error || 'Помилка збереження');
          setSaving(false);
          return;
        }
      } else {
        // Individual payment
        const lessonsCount = parseInt(paymentForm.lessons_count);
        if (isNaN(lessonsCount) || lessonsCount <= 0) {
          setSaveError('Введіть кількість занять');
          setSaving(false);
          return;
        }

        const body: Record<string, unknown> = {
          lessons_count: lessonsCount,
          method: paymentForm.method,
          note: paymentForm.note || undefined,
          paid_at: paymentForm.paid_at ? new Date(paymentForm.paid_at).toISOString() : undefined,
        };
        if (paymentForm.amount) {
          body.amount = parseFloat(paymentForm.amount);
        }

        const res = await fetch(`/api/students/${paymentForm.student_id}/individual-payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json();
          setSaveError(err.error || 'Помилка збереження');
          setSaving(false);
          return;
        }
      }

      setShowPaymentModal(false);
      setPaymentForm(null);
      fetchData();
    } catch {
      setSaveError('Помилка мережі');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout user={{ id: 0, name: '', email: '', role: 'admin' }}>
        <PageLoading />
      </Layout>
    );
  }

  if (!user) return null;

  const currentMonthLabel = monthOptions.find(o => o.value === month)?.label || month;

  return (
    <Layout user={user}>
      {/* Stats cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        {/* Total debt */}
        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '0.5rem',
                backgroundColor: '#fee2e2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Загальний борг</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>
                  {data?.group_debts.total_debt || 0} ₴
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Debtors count */}
        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '0.5rem',
                backgroundColor: '#fef3c7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="23" y1="13" x2="17" y2="13" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Боржників</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                  {data?.group_debts.students_count || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Collected this month */}
        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '0.5rem',
                backgroundColor: '#dcfce7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Зібрано</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>
                  {data?.collected.total_amount || 0} ₴
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lesson price */}
        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '0.5rem',
                backgroundColor: '#dbeafe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 3H8l-2 4h12l-2-4z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Ціна/заняття</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                  {data?.lesson_price || 300} ₴
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {/* Month picker */}
          <select
            className="form-input"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ width: '180px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
          >
            {monthOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Search */}
          <input
            type="text"
            className="form-input"
            placeholder="Пошук учня або групи..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '220px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
          />

          {/* Group filter */}
          <select
            className="form-input"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            style={{ width: '180px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
          >
            <option value="">Усі групи</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>

          {/* Tabs */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => setTab('group')}
              style={{
                padding: '0.5rem 0.875rem',
                fontSize: '0.875rem',
                fontWeight: tab === 'group' ? '600' : '400',
                borderRadius: '0.375rem',
                border: tab === 'group' ? '1px solid #374151' : '1px solid #e5e7eb',
                backgroundColor: tab === 'group' ? '#374151' : 'white',
                color: tab === 'group' ? 'white' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Групові
            </button>
            <button
              onClick={() => setTab('individual')}
              style={{
                padding: '0.5rem 0.875rem',
                fontSize: '0.875rem',
                fontWeight: tab === 'individual' ? '600' : '400',
                borderRadius: '0.375rem',
                border: tab === 'individual' ? '1px solid #374151' : '1px solid #e5e7eb',
                backgroundColor: tab === 'individual' ? '#374151' : 'white',
                color: tab === 'individual' ? 'white' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Індивідуальні
            </button>
          </div>
        </div>
      </div>

      {/* Group debts table */}
      {tab === 'group' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
              Борги за групові заняття — {currentMonthLabel}
            </h3>
            <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#6b7280' }}>
              {filteredGroupDebtors.length} учнів
            </div>
          </div>
          <div className="table-container">
            {filteredGroupDebtors.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Учень</th>
                    <th>Група</th>
                    <th style={{ textAlign: 'center' }}>Занять</th>
                    <th style={{ textAlign: 'right' }}>Ціна/зан</th>
                    <th style={{ textAlign: 'center' }}>Знижка</th>
                    <th style={{ textAlign: 'right' }}>До сплати</th>
                    <th style={{ textAlign: 'right' }}>Оплачено</th>
                    <th style={{ textAlign: 'right' }}>Борг</th>
                    <th style={{ textAlign: 'right', width: '100px' }}>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroupDebtors.map((d, idx) => (
                    <tr key={`${d.id}-${d.group_id}-${idx}`}>
                      <td>
                        <button
                          onClick={() => openStudentModal(d.id, d.full_name)}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem',
                            textDecoration: 'underline', textAlign: 'left',
                          }}
                        >
                          {d.full_name}
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => openGroupModal(d.group_id, d.group_title)}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem',
                            textDecoration: 'underline', textAlign: 'left',
                          }}
                        >
                          {d.group_title}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>{d.lessons_count}</td>
                      <td style={{ textAlign: 'right' }}>{d.lesson_price} ₴</td>
                      <td style={{ textAlign: 'center' }}>
                        {d.discount_percent > 0 ? (
                          <span className="badge badge-info">{d.discount_percent}%</span>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>{d.expected_amount} ₴</td>
                      <td style={{ textAlign: 'right' }}>
                        {d.paid_amount > 0 ? (
                          <span style={{ color: '#22c55e', fontWeight: '500' }}>{d.paid_amount} ₴</span>
                        ) : '0 ₴'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          fontWeight: '600',
                          color: d.debt > 0 ? '#ef4444' : '#22c55e',
                        }}>
                          {d.debt > 0 ? `${d.debt} ₴` : 'Оплачено'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {d.debt > 0 && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => openPaymentForm(d)}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          >
                            + Оплата
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                {data ? 'Немає боргів за цей місяць' : 'Завантаження...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Individual debtors */}
      {tab === 'individual' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
              Індивідуальні заняття — баланс
            </h3>
            <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#6b7280' }}>
              {filteredIndividualDebtors.length} учнів
            </div>
          </div>
          <div className="table-container">
            {filteredIndividualDebtors.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Учень</th>
                    <th style={{ textAlign: 'right' }}>Оплачено занять</th>
                    <th style={{ textAlign: 'right' }}>Використано</th>
                    <th style={{ textAlign: 'right' }}>Залишок</th>
                    <th style={{ textAlign: 'right', width: '100px' }}>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndividualDebtors.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <button
                          onClick={() => openStudentModal(d.id, d.full_name)}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem',
                            textDecoration: 'underline', textAlign: 'left',
                          }}
                        >
                          {d.full_name}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>{d.balance.lessons_paid}</td>
                      <td style={{ textAlign: 'right' }}>{d.balance.lessons_used}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          fontWeight: '600',
                          color: d.balance.lessons_remaining < 0 ? '#ef4444' : '#22c55e',
                        }}>
                          {d.balance.lessons_remaining}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => openIndividualPaymentForm(d)}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          + Оплата
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                {data ? 'Немає учнів з від\'ємним балансом' : 'Завантаження...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment collected breakdown */}
      {data && data.collected.payments_count > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
              Зібрано за {currentMonthLabel}
            </h3>
          </div>
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Загалом</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{data.collected.total_amount} ₴</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Готівка</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{data.collected.cash_amount} ₴</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Безготівково</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{data.collected.account_amount} ₴</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Кількість оплат</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{data.collected.payments_count}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPaymentModal && paymentForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
        onClick={() => setShowPaymentModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white', borderRadius: '0.75rem',
              padding: '1.5rem', width: '100%', maxWidth: '440px',
              boxShadow: '0 20px 60px -15px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.125rem', fontWeight: '600' }}>
              {paymentForm.type === 'group' ? 'Внести оплату (групова)' : 'Внести оплату (індивідуальна)'}
            </h3>

            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Учень</div>
              <div style={{ fontWeight: '500' }}>{paymentForm.student_name}</div>
            </div>

            {paymentForm.type === 'group' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Група</div>
                <div style={{ fontWeight: '500' }}>{paymentForm.group_title}</div>
              </div>
            )}

            {paymentForm.type === 'group' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Борг</div>
                <div style={{ fontWeight: '600', color: '#ef4444' }}>{paymentForm.debt} ₴</div>
              </div>
            )}

            {paymentForm.type === 'individual' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.875rem', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                  Кількість занять
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={paymentForm.lessons_count}
                  onChange={(e) => setPaymentForm({ ...paymentForm, lessons_count: e.target.value })}
                  min="1"
                  style={{ width: '100%' }}
                />
              </div>
            )}

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                Сума (₴)
              </label>
              <input
                type="number"
                className="form-input"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder={paymentForm.type === 'individual' ? 'Авто (з урахуванням знижки)' : ''}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                Спосіб оплати
              </label>
              <select
                className="form-input"
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as 'cash' | 'account' })}
                style={{ width: '100%' }}
              >
                <option value="cash">Готівка</option>
                <option value="account">Безготівково</option>
              </select>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                Дата оплати
              </label>
              <input
                type="date"
                className="form-input"
                value={paymentForm.paid_at}
                onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                Примітка
              </label>
              <input
                type="text"
                className="form-input"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                placeholder="Необов'язково"
                style={{ width: '100%' }}
              />
            </div>

            {saveError && (
              <div style={{
                padding: '0.5rem 0.75rem', marginBottom: '0.75rem',
                backgroundColor: '#fee2e2', color: '#dc2626',
                borderRadius: '0.375rem', fontSize: '0.875rem',
              }}>
                {saveError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowPaymentModal(false)}
                disabled={saving}
              >
                Скасувати
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSavePayment}
                disabled={saving}
              >
                {saving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
