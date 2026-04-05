'use client';

import { useState, useEffect, useMemo } from 'react';

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
  summary: {
    total_debt_current_month: number;
    total_debt_all: number;
    groups_count: number;
    last_payment: { amount: number; paid_at: string; type: string } | null;
  };
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
  const [expanded, setExpanded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [historyPage, setHistoryPage] = useState(0);
  const HISTORY_PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/students/${studentId}/payments-summary`)
      .then(r => {
        if (!r.ok) throw new Error('Помилка завантаження');
        return r.json();
      })
      .then((d: PaymentsSummary) => {
        setData(d);
        const currentMonth = new Date().toISOString().substring(0, 7);
        if (d.months.includes(currentMonth)) {
          setSelectedMonth(currentMonth);
        } else if (d.months.length > 0) {
          setSelectedMonth(d.months[0]);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  const filteredDebts = useMemo(() => {
    if (!data || !selectedMonth) return [];
    return data.group_debts.filter(d => d.month === selectedMonth);
  }, [data, selectedMonth]);

  const paginatedHistory = useMemo(() => {
    if (!data) return [];
    const start = historyPage * HISTORY_PAGE_SIZE;
    return data.history.slice(start, start + HISTORY_PAGE_SIZE);
  }, [data, historyPage]);

  const totalHistoryPages = data ? Math.ceil(data.history.length / HISTORY_PAGE_SIZE) : 0;

  const canGoPrev = data ? data.months.indexOf(selectedMonth) < data.months.length - 1 : false;
  const canGoNext = data ? data.months.indexOf(selectedMonth) > 0 : false;

  const goPrevMonth = () => {
    if (!data) return;
    const idx = data.months.indexOf(selectedMonth);
    if (idx < data.months.length - 1) setSelectedMonth(data.months[idx + 1]);
  };

  const goNextMonth = () => {
    if (!data) return;
    const idx = data.months.indexOf(selectedMonth);
    if (idx > 0) setSelectedMonth(data.months[idx - 1]);
  };

  // --- Shared round nav button style (matching attendance panel) ---
  const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 30,
    height: 30,
    border: '1px solid #e5e7eb',
    borderRadius: '50%',
    backgroundColor: 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: disabled ? '#d1d5db' : '#374151',
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
    fontSize: '1rem',
    lineHeight: 1,
    padding: 0,
  });

  return (
    <div className="card" style={{
      marginBottom: '2rem',
      borderRadius: '1rem',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Header — matches attendance panel header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.125rem 1.5rem',
          borderBottom: expanded ? '1px solid var(--gray-200)' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background 0.15s',
          borderRadius: expanded ? '1rem 1rem 0 0' : '1rem',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--gray-800)' }}>
            Оплати
          </h2>
          {!expanded && !loading && data && (
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>
              {data.summary.total_debt_all > 0
                ? `Борг: ${data.summary.total_debt_all} ₴`
                : data.summary.last_payment
                  ? `Остання: ${data.summary.last_payment.amount} ₴`
                  : ''}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Summary badges in collapsed */}
          {!loading && data && (
            <>
              {data.summary.total_debt_all > 0 ? (
                <span style={{
                  height: 28,
                  paddingLeft: 9,
                  paddingRight: 9,
                  border: '1px solid #fca5a5',
                  borderRadius: 6,
                  backgroundColor: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: '#dc2626',
                  flexShrink: 0,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  lineHeight: 1,
                }}>
                  {data.summary.total_debt_all} ₴
                </span>
              ) : (
                <span style={{
                  height: 28,
                  paddingLeft: 9,
                  paddingRight: 9,
                  border: '1px solid #86efac',
                  borderRadius: 6,
                  backgroundColor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#16a34a',
                  flexShrink: 0,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  lineHeight: 1,
                }}>
                  ✓
                </span>
              )}
              {data.individual_balance && data.individual_balance.lessons_remaining > 0 && (
                <span style={{
                  height: 28,
                  paddingLeft: 9,
                  paddingRight: 9,
                  border: '1px solid #93c5fd',
                  borderRadius: 6,
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#2563eb',
                  flexShrink: 0,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  lineHeight: 1,
                }}>
                  Інд: {data.individual_balance.lessons_remaining} зан.
                </span>
              )}
            </>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--gray-400)" strokeWidth="2"
            style={{
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              flexShrink: 0,
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>
              Завантаження...
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
              {error}
            </div>
          ) : data ? (
            <>
              {/* Discount info */}
              {data.student.discount_percent > 0 && (
                <div style={{
                  margin: '0 1.5rem',
                  marginTop: '1rem',
                  padding: '0.625rem 1rem',
                  backgroundColor: '#eff6ff',
                  borderRadius: '0.5rem',
                  border: '1px solid #bfdbfe',
                  fontSize: '0.8125rem',
                  color: '#1e40af',
                }}>
                  Знижка: <strong>{data.student.discount_percent}%</strong> · Ціна заняття: <s>{data.lesson_price} ₴</s> → <strong>{data.effective_price} ₴</strong>
                </div>
              )}

              {/* === GROUP DEBTS with month navigation === */}
              {data.months.length > 0 && (
                <>
                  {/* Month navigation bar — matches attendance panel */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    padding: '0.625rem 1.5rem',
                    borderBottom: '1px solid #f3f4f6',
                    backgroundColor: '#fafafa',
                  }}>
                    <button
                      onClick={e => { e.stopPropagation(); goPrevMonth(); }}
                      disabled={!canGoPrev}
                      style={navBtnStyle(!canGoPrev)}
                    >
                      ‹
                    </button>
                    <span style={{
                      fontWeight: 600,
                      fontSize: '0.9375rem',
                      color: '#111827',
                      minWidth: 150,
                      textAlign: 'center',
                    }}>
                      {formatMonth(selectedMonth)}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); goNextMonth(); }}
                      disabled={!canGoNext}
                      style={navBtnStyle(!canGoNext)}
                    >
                      ›
                    </button>
                  </div>

                  {/* Section header */}
                  <div style={{ padding: '1rem 1.5rem 0 1.5rem' }}>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#9ca3af',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.06em',
                    }}>
                      Групові заняття ({filteredDebts.length})
                    </span>
                  </div>

                  {/* Debts table */}
                  <div style={{ padding: '0.5rem 1.5rem 1rem 1.5rem' }}>
                    {filteredDebts.length > 0 ? (
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.8125rem',
                      }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--gray-200)' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontWeight: '500' }}>Група</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontWeight: '500' }}>Занять</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontWeight: '500' }}>Очікувано</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontWeight: '500' }}>Оплачено</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--gray-500)', fontWeight: '500' }}>Різниця</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDebts.map((row) => {
                            const isDebt = row.diff < 0;
                            const isOverpaid = row.diff > 0;
                            return (
                              <tr key={`${row.group_id}-${row.month}`} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--gray-700)', fontWeight: '500' }}>{row.group_title}</td>
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
                          {filteredDebts.length > 1 && (() => {
                            const totExp = filteredDebts.reduce((s, r) => s + r.expected, 0);
                            const totPaid = filteredDebts.reduce((s, r) => s + r.paid, 0);
                            const totDiff = totPaid - totExp;
                            return (
                              <tr style={{ borderTop: '2px solid var(--gray-200)' }}>
                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--gray-700)' }}>Разом</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}></td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '600', color: 'var(--gray-600)' }}>{totExp} ₴</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '600', color: 'var(--gray-700)' }}>{totPaid} ₴</td>
                                <td style={{
                                  padding: '0.5rem 0.75rem',
                                  textAlign: 'right',
                                  fontWeight: '700',
                                  color: totDiff < 0 ? '#dc2626' : totDiff > 0 ? '#2563eb' : '#16a34a',
                                }}>
                                  {totDiff > 0 ? '+' : ''}{totDiff} ₴
                                </td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{
                        padding: '1rem',
                        backgroundColor: '#f9fafb',
                        borderRadius: '0.5rem',
                        color: '#9ca3af',
                        fontSize: '0.8125rem',
                        textAlign: 'center',
                      }}>
                        Немає даних за {formatMonth(selectedMonth)}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* === INDIVIDUAL BALANCE === */}
              {data.individual_balance && (
                <div style={{ padding: '0 1.5rem 1rem 1.5rem' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#9ca3af',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.06em',
                    }}>
                      Індивідуальні заняття
                    </span>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                  }}>
                    <div style={{
                      padding: '0.875rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.75rem',
                      border: '1px solid #e5e7eb',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginBottom: '0.25rem', fontWeight: 500 }}>Оплачено</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--gray-800)' }}>
                        {data.individual_balance.lessons_paid}
                      </div>
                    </div>
                    <div style={{
                      padding: '0.875rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.75rem',
                      border: '1px solid #e5e7eb',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginBottom: '0.25rem', fontWeight: 500 }}>Використано</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--gray-800)' }}>
                        {data.individual_balance.lessons_used}
                      </div>
                    </div>
                    <div style={{
                      padding: '0.875rem',
                      backgroundColor: data.individual_balance.lessons_remaining > 0 ? '#dcfce7' : data.individual_balance.lessons_remaining < 0 ? '#fef2f2' : '#f9fafb',
                      borderRadius: '0.75rem',
                      border: `1px solid ${data.individual_balance.lessons_remaining > 0 ? '#86efac' : data.individual_balance.lessons_remaining < 0 ? '#fca5a5' : '#e5e7eb'}`,
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginBottom: '0.25rem', fontWeight: 500 }}>Залишок</div>
                      <div style={{
                        fontSize: '1.125rem',
                        fontWeight: '700',
                        color: data.individual_balance.lessons_remaining > 0 ? '#16a34a' : data.individual_balance.lessons_remaining < 0 ? '#dc2626' : 'var(--gray-800)',
                      }}>
                        {data.individual_balance.lessons_remaining}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === PAYMENT HISTORY === */}
              {data.history.length > 0 && (
                <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#9ca3af',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.06em',
                    }}>
                      Історія оплат ({data.history.length})
                    </span>
                  </div>

                  <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                  }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.8125rem',
                      }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#9ca3af', fontWeight: '500', fontSize: '0.75rem' }}>Дата</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#9ca3af', fontWeight: '500', fontSize: '0.75rem' }}>Тип</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: '#9ca3af', fontWeight: '500', fontSize: '0.75rem' }}>Сума</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#9ca3af', fontWeight: '500', fontSize: '0.75rem' }}>Метод</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#9ca3af', fontWeight: '500', fontSize: '0.75rem' }}>Ким</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedHistory.map((h, i) => (
                            <tr
                              key={`${h.type}-${h.id}`}
                              style={{
                                borderBottom: i < paginatedHistory.length - 1 ? '1px solid #f3f4f6' : 'none',
                                transition: 'background 0.1s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              <td style={{ padding: '0.625rem 0.75rem', color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>
                                {formatDate(h.paid_at)}
                              </td>
                              <td style={{ padding: '0.625rem 0.75rem', color: 'var(--gray-700)' }}>
                                {h.type === 'group' ? (
                                  <span>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '1px 7px',
                                      backgroundColor: '#eef2ff',
                                      borderRadius: 4,
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      color: '#4f46e5',
                                      whiteSpace: 'nowrap',
                                      marginRight: '0.375rem',
                                    }}>Група</span>
                                    {h.group_title}
                                    {h.month && <span style={{ color: '#9ca3af', marginLeft: '0.25rem', fontSize: '0.75rem' }}>({formatMonth(h.month.substring(0, 7))})</span>}
                                  </span>
                                ) : (
                                  <span>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '1px 7px',
                                      backgroundColor: '#f3e8ff',
                                      borderRadius: 4,
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      color: '#7c3aed',
                                      whiteSpace: 'nowrap',
                                      marginRight: '0.375rem',
                                    }}>Індив.</span>
                                    {h.lessons_count != null && `${h.lessons_count} зан.`}
                                  </span>
                                )}
                              </td>
                              <td style={{
                                padding: '0.625rem 0.75rem',
                                textAlign: 'right',
                                fontWeight: '600',
                                color: 'var(--gray-800)',
                              }}>
                                {h.amount} ₴
                              </td>
                              <td style={{ padding: '0.625rem 0.75rem', color: 'var(--gray-600)' }}>
                                {formatMethod(h.method)}
                              </td>
                              <td style={{ padding: '0.625rem 0.75rem', color: '#9ca3af' }}>
                                {h.created_by_name}
                                {h.note && (
                                  <div style={{ fontSize: '0.6875rem', color: '#d1d5db', marginTop: '2px' }}>
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

                  {/* Pagination — round buttons matching attendance panel */}
                  {totalHistoryPages > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '1rem',
                      marginTop: '0.75rem',
                    }}>
                      <button
                        onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                        disabled={historyPage === 0}
                        style={navBtnStyle(historyPage === 0)}
                      >
                        ‹
                      </button>
                      <span style={{
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        color: '#6b7280',
                        minWidth: 50,
                        textAlign: 'center',
                      }}>
                        {historyPage + 1} / {totalHistoryPages}
                      </span>
                      <button
                        onClick={() => setHistoryPage(p => Math.min(totalHistoryPages - 1, p + 1))}
                        disabled={historyPage >= totalHistoryPages - 1}
                        style={navBtnStyle(historyPage >= totalHistoryPages - 1)}
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {data.months.length === 0 && !data.individual_balance && data.history.length === 0 && (
                <div style={{
                  margin: '0 1.5rem 1.5rem 1.5rem',
                  padding: '1.5rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.75rem',
                  border: '1px dashed #e5e7eb',
                  color: '#9ca3af',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                }}>
                  Немає даних про оплати
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
