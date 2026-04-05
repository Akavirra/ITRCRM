'use client';

import { useState, useEffect } from 'react';

interface GroupDebt {
  group_id: number;
  group_title: string;
  month: string;
  lessons_count: number;
  expected: number;
  paid: number;
  diff: number;
}

interface PaymentHistory {
  id: number;
  type: string;
  group_title: string | null;
  month: string | null;
  lessons_count: number | null;
  amount: number;
  method: string;
  paid_at: string;
  note: string | null;
  created_by_name: string;
}

interface PaymentsSummary {
  student: { id: number; full_name: string; discount_percent: number };
  lesson_price: number;
  effective_price: number;
  months: string[];
  group_debts: GroupDebt[];
  individual_balance: {
    lessons_paid: number;
    lessons_used: number;
    lessons_remaining: number;
  } | null;
  history: PaymentHistory[];
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Січень', '02': 'Лютий', '03': 'Березень',
  '04': 'Квітень', '05': 'Травень', '06': 'Червень',
  '07': 'Липень', '08': 'Серпень', '09': 'Вересень',
  '10': 'Жовтень', '11': 'Листопад', '12': 'Грудень',
};

function formatMonth(m: string) {
  const [year, month] = m.split('-');
  return `${MONTH_NAMES[month] || month} ${year}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMethod(method: string) {
  switch (method) {
    case 'cash': return 'Готівка';
    case 'account': return 'Рахунок';
    default: return method;
  }
}

export default function StudentPaymentsPanel({ studentId }: { studentId: number }) {
  const [data, setData] = useState<PaymentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/students/${studentId}/payments-summary`)
      .then(r => {
        if (!r.ok) throw new Error('Помилка завантаження');
        return r.json();
      })
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  // Group debts by group
  const groupedDebts: Record<number, { title: string; rows: GroupDebt[] }> = {};
  if (data) {
    for (const d of data.group_debts) {
      if (!groupedDebts[d.group_id]) {
        groupedDebts[d.group_id] = { title: d.group_title, rows: [] };
      }
      groupedDebts[d.group_id].rows.push(d);
    }
  }

  // Calculate total debt across all groups
  const totalDebt = data ? data.group_debts.reduce((sum, d) => sum + Math.max(0, -d.diff), 0) : 0;
  const totalOverpaid = data ? data.group_debts.reduce((sum, d) => sum + Math.max(0, d.diff), 0) : 0;

  return (
    <div className="card" style={{
      marginBottom: '2rem',
      overflow: 'hidden',
      borderRadius: '1rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.5rem 2rem',
          borderBottom: collapsed ? 'none' : '1px solid var(--gray-200)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            margin: 0,
            color: 'var(--gray-800)',
            letterSpacing: '-0.025em'
          }}>
            Оплати
          </h2>
          {!loading && data && totalDebt > 0 && (
            <span style={{
              padding: '2px 10px',
              borderRadius: '12px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontSize: '0.8125rem',
              fontWeight: '600',
            }}>
              Борг: {totalDebt} ₴
            </span>
          )}
          {!loading && data && totalDebt === 0 && totalOverpaid === 0 && (
            <span style={{
              padding: '2px 10px',
              borderRadius: '12px',
              backgroundColor: '#dcfce7',
              color: '#16a34a',
              fontSize: '0.8125rem',
              fontWeight: '600',
            }}>
              Без боргів
            </span>
          )}
        </div>
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="var(--gray-400)" strokeWidth="2"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {collapsed ? null : loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>
          Завантаження...
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
          {error}
        </div>
      ) : data ? (
        <div style={{ padding: '1.5rem 2rem' }}>

          {/* Discount info */}
          {data.student.discount_percent > 0 && (
            <div style={{
              marginBottom: '1.25rem',
              padding: '0.625rem 1rem',
              backgroundColor: '#eff6ff',
              borderRadius: '0.5rem',
              border: '1px solid #bfdbfe',
              fontSize: '0.875rem',
              color: '#1e40af',
            }}>
              Знижка: <strong>{data.student.discount_percent}%</strong> · Ціна заняття: <s>{data.lesson_price} ₴</s> → <strong>{data.effective_price} ₴</strong>
            </div>
          )}

          {/* Group debts */}
          {Object.keys(groupedDebts).length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: '0.9375rem',
                fontWeight: '600',
                margin: '0 0 0.75rem 0',
                color: 'var(--gray-700)',
              }}>
                Групові заняття
              </h3>

              {Object.entries(groupedDebts).map(([groupId, group]) => (
                <div key={groupId} style={{ marginBottom: '1rem' }}>
                  <div style={{
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    color: 'var(--gray-600)',
                    marginBottom: '0.375rem',
                  }}>
                    {group.title}
                  </div>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.8125rem',
                  }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--gray-200)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontWeight: '500' }}>Місяць</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontWeight: '500' }}>Занять</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontWeight: '500' }}>Очікувано</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontWeight: '500' }}>Оплачено</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontWeight: '500' }}>Різниця</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => {
                        const isDebt = row.diff < 0;
                        const isOverpaid = row.diff > 0;
                        return (
                          <tr key={row.month} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--gray-700)' }}>{formatMonth(row.month)}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: 'var(--gray-600)' }}>{row.lessons_count}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--gray-600)' }}>{row.expected} ₴</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--gray-700)', fontWeight: '500' }}>{row.paid} ₴</td>
                            <td style={{
                              padding: '0.5rem 0.75rem',
                              textAlign: 'right',
                              fontWeight: '600',
                              color: isDebt ? '#dc2626' : isOverpaid ? '#2563eb' : '#16a34a',
                            }}>
                              {row.diff > 0 ? '+' : ''}{row.diff} ₴
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Individual balance */}
          {data.individual_balance && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: '0.9375rem',
                fontWeight: '600',
                margin: '0 0 0.75rem 0',
                color: 'var(--gray-700)',
              }}>
                Індивідуальні заняття
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
              }}>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.5rem',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.25rem' }}>Оплачено</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--gray-800)' }}>
                    {data.individual_balance.lessons_paid}
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.5rem',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.25rem' }}>Використано</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--gray-800)' }}>
                    {data.individual_balance.lessons_used}
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  backgroundColor: data.individual_balance.lessons_remaining > 0 ? '#dcfce7' : data.individual_balance.lessons_remaining < 0 ? '#fef2f2' : '#f9fafb',
                  borderRadius: '0.5rem',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.25rem' }}>Залишок</div>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: data.individual_balance.lessons_remaining > 0 ? '#16a34a' : data.individual_balance.lessons_remaining < 0 ? '#dc2626' : 'var(--gray-800)',
                  }}>
                    {data.individual_balance.lessons_remaining}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment history */}
          {data.history.length > 0 && (
            <div>
              <h3 style={{
                fontSize: '0.9375rem',
                fontWeight: '600',
                margin: '0 0 0.75rem 0',
                color: 'var(--gray-700)',
              }}>
                Історія оплат
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.8125rem',
                }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--gray-200)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', color: 'var(--gray-500)', fontWeight: '500' }}>Дата</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', color: 'var(--gray-500)', fontWeight: '500' }}>Тип</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.5rem', color: 'var(--gray-500)', fontWeight: '500' }}>Сума</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', color: 'var(--gray-500)', fontWeight: '500' }}>Метод</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', color: 'var(--gray-500)', fontWeight: '500' }}>Ким</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h) => (
                      <tr key={`${h.type}-${h.id}`} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                        <td style={{ padding: '0.5rem 0.5rem', color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>
                          {formatDate(h.paid_at)}
                        </td>
                        <td style={{ padding: '0.5rem 0.5rem', color: 'var(--gray-700)' }}>
                          {h.type === 'group' ? (
                            <span>
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                fontSize: '0.6875rem',
                                fontWeight: '600',
                                marginRight: '0.375rem',
                              }}>Група</span>
                              {h.group_title}
                              {h.month && <span style={{ color: 'var(--gray-400)', marginLeft: '0.25rem' }}>({formatMonth(h.month.substring(0, 7))})</span>}
                            </span>
                          ) : (
                            <span>
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#faf5ff',
                                color: '#7c3aed',
                                fontSize: '0.6875rem',
                                fontWeight: '600',
                                marginRight: '0.375rem',
                              }}>Індив.</span>
                              {h.lessons_count != null && `${h.lessons_count} зан.`}
                            </span>
                          )}
                        </td>
                        <td style={{
                          padding: '0.5rem 0.5rem',
                          textAlign: 'right',
                          fontWeight: '600',
                          color: 'var(--gray-800)',
                        }}>
                          {h.amount} ₴
                        </td>
                        <td style={{ padding: '0.5rem 0.5rem', color: 'var(--gray-600)' }}>
                          {formatMethod(h.method)}
                        </td>
                        <td style={{ padding: '0.5rem 0.5rem', color: 'var(--gray-500)' }}>
                          {h.created_by_name}
                          {h.note && (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--gray-400)', marginTop: '2px' }}>
                              {h.note}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {Object.keys(groupedDebts).length === 0 && !data.individual_balance && data.history.length === 0 && (
            <div style={{
              padding: '1.5rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.75rem',
              border: '1px dashed #e5e7eb',
              color: '#9ca3af',
              fontSize: '0.9375rem',
              textAlign: 'center'
            }}>
              Немає даних про оплати
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
