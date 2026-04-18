'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Users, Calendar, Archive, Settings as SettingsIcon } from 'lucide-react';
import { useCampModals } from '../CampModalsContext';
import CreateCampModal from '../CreateCampModal';

interface Camp {
  id: number;
  public_id: string;
  title: string;
  season: string;
  start_date: string;
  end_date: string;
  price_per_day_snapshot: number | null;
  notes: string | null;
  is_archived: boolean;
  shifts_count: number;
  participants_count: number;
  total_expected: number;
  total_paid: number;
  total_debt: number;
  effective_price_per_day: number;
}

const SEASON_LABEL: Record<string, string> = {
  winter: 'Зима',
  spring: 'Весна',
  summer: 'Літо',
  autumn: 'Осінь',
};

const SEASON_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  winter: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a' },
  spring: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  summer: { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
  autumn: { bg: '#fef3c7', border: '#fde68a', text: '#92400e' },
};

function formatDateShort(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${parseInt(day, 10)}.${m}.${y.slice(2)}`;
}

export default function CampsTab() {
  const { openCampModal } = useCampModals();
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [globalPrice, setGlobalPrice] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  const loadCamps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/camps?includeArchived=${includeArchived ? '1' : '0'}`);
      if (res.ok) {
        const json = await res.json();
        setCamps(json.camps || []);
      }
    } catch (err) {
      console.error('Load camps error:', err);
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  const loadGlobalPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/camp-price-per-day');
      if (res.ok) {
        const json = await res.json();
        const v = typeof json.value === 'number' ? json.value : parseInt(json.value || '500', 10);
        setGlobalPrice(v);
        setPriceInput(String(v));
      }
    } catch (err) {
      console.error('Load global price error:', err);
    }
  }, []);

  useEffect(() => { loadCamps(); }, [loadCamps]);
  useEffect(() => { loadGlobalPrice(); }, [loadGlobalPrice]);

  // React to changes from modals
  useEffect(() => {
    const h = () => { loadCamps(); };
    window.addEventListener('itrobot-camps-updated', h);
    return () => window.removeEventListener('itrobot-camps-updated', h);
  }, [loadCamps]);

  const handleOpen = (camp: Camp) => {
    openCampModal(camp.id, camp.title);
  };

  const handleSavePrice = async () => {
    const v = parseInt(priceInput, 10);
    if (!Number.isFinite(v) || v < 0) {
      alert('Невірне значення ціни');
      return;
    }
    setSavingPrice(true);
    try {
      const res = await fetch('/api/settings/camp-price-per-day', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: v }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Не вдалося зберегти');
        return;
      }
      setGlobalPrice(v);
      setShowSettings(false);
    } finally {
      setSavingPrice(false);
    }
  };

  const summary = useMemo(() => {
    const expected = camps.reduce((s, c) => s + c.total_expected, 0);
    const paid = camps.reduce((s, c) => s + c.total_paid, 0);
    const debt = camps.reduce((s, c) => s + c.total_debt, 0);
    const participants = camps.reduce((s, c) => s + c.participants_count, 0);
    return { expected, paid, debt, participants };
  }, [camps]);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Header with actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#4b5563', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                style={{ width: '14px', height: '14px', cursor: 'pointer' }}
              />
              Показати архівні
            </label>
            {globalPrice != null && (
              <button
                onClick={() => setShowSettings(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.8125rem',
                  padding: '0.375rem 0.625rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  color: '#374151',
                }}
                title="Налаштування ціни"
              >
                <SettingsIcon size={13} />
                Ціна дня: <b>{globalPrice} ₴</b>
              </button>
            )}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', padding: '0.5rem 0.875rem' }}
          >
            <Plus size={14} /> Новий табір
          </button>
        </div>

        {/* Summary */}
        {camps.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.5rem',
            }}
          >
            <div style={{ padding: '0.625rem 0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Таборів</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>{camps.length}</div>
            </div>
            <div style={{ padding: '0.625rem 0.75rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.6875rem', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Учасників</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e40af' }}>{summary.participants}</div>
            </div>
            <div style={{ padding: '0.625rem 0.75rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.6875rem', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Оплачено</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#047857' }}>{summary.paid} ₴</div>
            </div>
            <div style={{ padding: '0.625rem 0.75rem', backgroundColor: summary.debt > 0 ? '#fef2f2' : '#ecfdf5', border: `1px solid ${summary.debt > 0 ? '#fecaca' : '#a7f3d0'}`, borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.6875rem', color: summary.debt > 0 ? '#b91c1c' : '#047857', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Борг</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: summary.debt > 0 ? '#b91c1c' : '#047857' }}>{summary.debt} ₴</div>
            </div>
          </div>
        )}

        {/* Camps list */}
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>Завантаження...</div>
        ) : camps.length === 0 ? (
          <div
            style={{
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              color: '#6b7280',
              backgroundColor: '#f9fafb',
              border: '1px dashed #d1d5db',
              borderRadius: '0.5rem',
            }}
          >
            <Calendar size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Таборів ще немає</div>
            <div style={{ fontSize: '0.8125rem', marginBottom: '1rem' }}>Створіть перший табір для літньої або зимової зміни</div>
            <button
              onClick={() => setShowCreate(true)}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              <Plus size={14} /> Створити табір
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {camps.map(camp => {
              const colors = SEASON_COLOR[camp.season] || SEASON_COLOR.summer;
              return (
                <button
                  key={camp.id}
                  onClick={() => handleOpen(camp)}
                  style={{
                    textAlign: 'left',
                    padding: '0.875rem',
                    backgroundColor: camp.is_archived ? '#f9fafb' : 'white',
                    border: `1px solid ${camp.is_archived ? '#e5e7eb' : colors.border}`,
                    borderLeft: `3px solid ${camp.is_archived ? '#9ca3af' : colors.border}`,
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        padding: '0.125rem 0.375rem',
                        borderRadius: '0.25rem',
                        backgroundColor: colors.bg,
                        color: colors.text,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {SEASON_LABEL[camp.season] || camp.season}
                    </div>
                    {camp.is_archived && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.125rem', fontSize: '0.625rem', fontWeight: 600, color: '#6b7280' }}>
                        <Archive size={10} /> Архів
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
                    {camp.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={11} />
                    {formatDateShort(camp.start_date)} — {formatDateShort(camp.end_date)}
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        padding: '0.1875rem 0.4375rem',
                        borderRadius: '0.25rem',
                        backgroundColor: '#eff6ff',
                        color: '#1e40af',
                        border: '1px solid #dbeafe',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontWeight: 500,
                      }}
                    >
                      <Calendar size={10} /> {camp.shifts_count} {camp.shifts_count === 1 ? 'зміна' : 'змін'}
                    </div>
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        padding: '0.1875rem 0.4375rem',
                        borderRadius: '0.25rem',
                        backgroundColor: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontWeight: 500,
                      }}
                    >
                      <Users size={10} /> {camp.participants_count}
                    </div>
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        padding: '0.1875rem 0.4375rem',
                        borderRadius: '0.25rem',
                        backgroundColor: '#f9fafb',
                        color: '#374151',
                        border: '1px solid #e5e7eb',
                        fontWeight: 500,
                      }}
                    >
                      {camp.effective_price_per_day} ₴/день
                    </div>
                  </div>
                  {(camp.total_expected > 0 || camp.total_paid > 0) && (
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.6875rem', color: '#6b7280', alignItems: 'center' }}>
                      <span>Оплач.: <b style={{ color: '#047857' }}>{camp.total_paid} ₴</b></span>
                      {camp.total_debt > 0 && <span style={{ color: '#b91c1c', fontWeight: 600 }}>Борг: {camp.total_debt} ₴</span>}
                      {camp.total_expected > 0 && camp.total_debt === 0 && <span style={{ color: '#047857', fontWeight: 600 }}>✓ Оплачено</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CreateCampModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(campId) => {
          loadCamps();
          const c = camps.find(x => x.id === campId);
          openCampModal(campId, c?.title || 'Новий табір');
        }}
      />

      {showSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '1rem',
          }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '400px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-body" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem', color: '#111827' }}>
                Ціна одного дня табору
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.5 }}>
                Глобальна ціна, що використовується за замовчуванням для всіх таборів (можна перевизначити окремо для кожного табору).
              </p>
              <input
                type="number"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.9375rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginBottom: '1rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowSettings(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8125rem', padding: '0.5rem 0.875rem' }}
                >
                  Скасувати
                </button>
                <button
                  onClick={handleSavePrice}
                  disabled={savingPrice}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8125rem', padding: '0.5rem 0.875rem' }}
                >
                  {savingPrice ? 'Збереження…' : 'Зберегти'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
