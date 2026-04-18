'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X, Save } from 'lucide-react';

interface CampPayment {
  id: number;
  participant_id: number;
  amount: number;
  method: 'cash' | 'account';
  paid_at: string;
  note: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  participant_full_name?: string;
}

interface ParticipantLite {
  id: number;
  first_name: string;
  last_name: string;
  shift_id: number | null;
  shift_title: string | null;
  total_expected: number;
  total_paid: number;
  balance: number;
  status: 'active' | 'cancelled';
}

interface Props {
  campId: number;
  participants: ParticipantLite[];
  loading: boolean;
  onAddPayment: (participantId: number, input: { amount: number; method: 'cash' | 'account'; paid_at: string; note: string | null }) => Promise<void>;
  onDeletePayment: (participantId: number, paymentId: number) => Promise<void>;
  onLoadAllPayments: () => Promise<CampPayment[]>;
  onLoadParticipantPayments: (participantId: number) => Promise<CampPayment[]>;
}

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function fullName(p: ParticipantLite): string {
  return `${p.last_name} ${p.first_name}`.trim();
}

export default function CampPaymentsTab({
  campId,
  participants,
  loading,
  onAddPayment,
  onDeletePayment,
  onLoadAllPayments,
  onLoadParticipantPayments,
}: Props) {
  const [mode, setMode] = useState<'all' | 'participant'>('all');
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
  const [payments, setPayments] = useState<CampPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add payment form
  const [formParticipantId, setFormParticipantId] = useState<number | null>(null);
  const [formAmount, setFormAmount] = useState('');
  const [formMethod, setFormMethod] = useState<'cash' | 'account'>('cash');
  const [formPaidAt, setFormPaidAt] = useState(todayIsoDate());
  const [formNote, setFormNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeParticipants = useMemo(() => participants.filter(p => p.status === 'active'), [participants]);

  const reload = async () => {
    setLoadingPayments(true);
    setError(null);
    try {
      if (mode === 'all') {
        const data = await onLoadAllPayments();
        setPayments(data);
      } else if (mode === 'participant' && selectedParticipantId != null) {
        const data = await onLoadParticipantPayments(selectedParticipantId);
        setPayments(data);
      } else {
        setPayments([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завантажити оплати');
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedParticipantId, campId]);

  const totals = useMemo(() => {
    const expected = participants.reduce((sum, p) => sum + (p.status === 'active' ? p.total_expected : 0), 0);
    const paid = participants.reduce((sum, p) => sum + p.total_paid, 0);
    const balance = participants.reduce((sum, p) => sum + (p.status === 'active' ? p.balance : 0), 0);
    return { expected, paid, balance };
  }, [participants]);

  const handleOpenForm = (participantId: number) => {
    setFormParticipantId(participantId);
    const p = participants.find(x => x.id === participantId);
    const suggested = p ? Math.max(0, p.balance) : 0;
    setFormAmount(suggested > 0 ? String(suggested) : '');
    setFormMethod('cash');
    setFormPaidAt(todayIsoDate());
    setFormNote('');
    setFormError(null);
  };

  const handleCancelForm = () => {
    setFormParticipantId(null);
    setFormAmount('');
    setFormNote('');
    setFormError(null);
  };

  const handleSave = async () => {
    if (formParticipantId == null) return;
    const amountNum = parseFloat(formAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setFormError('Некоректна сума');
      return;
    }
    if (!formPaidAt) {
      setFormError('Вкажіть дату');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await onAddPayment(formParticipantId, {
        amount: amountNum,
        method: formMethod,
        paid_at: formPaidAt,
        note: formNote.trim() || null,
      });
      handleCancelForm();
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (participantId: number, paymentId: number) => {
    if (!confirm('Видалити цю оплату?')) return;
    try {
      await onDeletePayment(participantId, paymentId);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не вдалося видалити оплату');
    }
  };

  if (loading) {
    return <div style={{ padding: '1rem', color: '#6b7280' }}>Завантаження...</div>;
  }

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Summary strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
        }}
      >
        <div style={{ padding: '0.625rem 0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>До сплати</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>{totals.expected} ₴</div>
        </div>
        <div style={{ padding: '0.625rem 0.75rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.6875rem', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Оплачено</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#047857' }}>{totals.paid} ₴</div>
        </div>
        <div
          style={{
            padding: '0.625rem 0.75rem',
            backgroundColor: totals.balance > 0 ? '#fef2f2' : totals.balance < 0 ? '#fffbeb' : '#ecfdf5',
            border: `1px solid ${totals.balance > 0 ? '#fecaca' : totals.balance < 0 ? '#fde68a' : '#a7f3d0'}`,
            borderRadius: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.6875rem',
              color: totals.balance > 0 ? '#b91c1c' : totals.balance < 0 ? '#b45309' : '#047857',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {totals.balance > 0 ? 'Загальний борг' : totals.balance < 0 ? 'Переплата' : 'Баланс'}
          </div>
          <div
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: totals.balance > 0 ? '#b91c1c' : totals.balance < 0 ? '#b45309' : '#047857',
            }}
          >
            {Math.abs(totals.balance)} ₴
          </div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: '1px solid #d1d5db', borderRadius: '0.375rem', overflow: 'hidden' }}>
          <button
            onClick={() => { setMode('all'); setSelectedParticipantId(null); }}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.8125rem',
              backgroundColor: mode === 'all' ? '#3b82f6' : 'white',
              color: mode === 'all' ? 'white' : '#374151',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Усі оплати
          </button>
          <button
            onClick={() => setMode('participant')}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.8125rem',
              backgroundColor: mode === 'participant' ? '#3b82f6' : 'white',
              color: mode === 'participant' ? 'white' : '#374151',
              border: 'none',
              borderLeft: '1px solid #d1d5db',
              cursor: 'pointer',
            }}
          >
            За учасником
          </button>
        </div>

        {mode === 'participant' && (
          <select
            value={selectedParticipantId ?? ''}
            onChange={(e) => setSelectedParticipantId(e.target.value ? parseInt(e.target.value, 10) : null)}
            style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', minWidth: '220px' }}
          >
            <option value="">— Оберіть учасника —</option>
            {participants.map(p => (
              <option key={p.id} value={p.id}>
                {fullName(p)}{p.shift_title ? ` · ${p.shift_title}` : ''}{p.status === 'cancelled' ? ' (скасовано)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Add payment quick select for active participants */}
      {activeParticipants.length > 0 && formParticipantId == null && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#f9fafb',
            border: '1px dashed #d1d5db',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>Додати оплату:</div>
          <select
            onChange={(e) => {
              const id = parseInt(e.target.value, 10);
              if (Number.isFinite(id)) {
                handleOpenForm(id);
                e.currentTarget.value = '';
              }
            }}
            defaultValue=""
            style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', minWidth: '220px' }}
          >
            <option value="">— Оберіть учасника —</option>
            {activeParticipants.map(p => (
              <option key={p.id} value={p.id}>
                {fullName(p)}{p.balance > 0 ? ` · борг ${p.balance} ₴` : p.balance < 0 ? ` · +${-p.balance} ₴` : ' · оплачено'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Inline add form */}
      {formParticipantId != null && (() => {
        const p = participants.find(x => x.id === formParticipantId);
        return (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: 'white',
              border: '1px solid #3b82f6',
              borderRadius: '0.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                Оплата: {p ? fullName(p) : '—'}
                {p && (
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: p.balance > 0 ? '#b91c1c' : p.balance < 0 ? '#b45309' : '#047857',
                    }}
                  >
                    {p.balance > 0 ? `борг ${p.balance} ₴` : p.balance < 0 ? `переплата ${-p.balance} ₴` : 'оплачено'}
                  </span>
                )}
              </div>
              <button
                onClick={handleCancelForm}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0 }}
                title="Скасувати"
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <input
                type="number"
                placeholder="Сума"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                style={{ flex: '1', minWidth: '100px', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              />
              <select
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value as 'cash' | 'account')}
                style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="cash">Готівка</option>
                <option value="account">Безготівково</option>
              </select>
              <input
                type="date"
                value={formPaidAt}
                onChange={(e) => setFormPaidAt(e.target.value)}
                style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              />
            </div>
            <input
              type="text"
              placeholder="Примітка (необов’язково)"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              style={{ width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginBottom: '0.5rem' }}
            />
            {formError && (
              <div style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: '0.375rem' }}>{formError}</div>
            )}
            <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelForm}
                disabled={saving}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                Скасувати
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  opacity: saving ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Save size={14} />
                {saving ? 'Зберігаю…' : 'Зберегти'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Payments list */}
      <div>
        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
            {error}
          </div>
        )}

        {loadingPayments ? (
          <div style={{ padding: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>Завантаження оплат...</div>
        ) : payments.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280', backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
            {mode === 'participant' && selectedParticipantId == null ? 'Оберіть учасника зі списку' : 'Оплат ще немає'}
          </div>
        ) : (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: mode === 'all' ? '110px 1fr 100px 110px 1fr 40px' : '110px 100px 110px 1fr 40px',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              <div>Дата</div>
              {mode === 'all' && <div>Учасник</div>}
              <div>Сума</div>
              <div>Метод</div>
              <div>Примітка</div>
              <div />
            </div>
            {payments.map(pay => (
              <div
                key={pay.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: mode === 'all' ? '110px 1fr 100px 110px 1fr 40px' : '110px 100px 110px 1fr 40px',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: '0.8125rem',
                  alignItems: 'center',
                }}
              >
                <div style={{ color: '#374151' }}>{formatDate(pay.paid_at)}</div>
                {mode === 'all' && (
                  <div style={{ color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pay.participant_full_name || '—'}
                  </div>
                )}
                <div style={{ color: '#047857', fontWeight: 600 }}>{pay.amount} ₴</div>
                <div style={{ color: '#6b7280' }}>{pay.method === 'cash' ? 'Готівка' : 'Безготівково'}</div>
                <div style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pay.note || ''}>
                  {pay.note || '—'}
                </div>
                <button
                  onClick={() => handleDelete(pay.participant_id, pay.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem' }}
                  title="Видалити"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
