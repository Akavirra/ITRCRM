'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

interface CreateCampModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (campId: number) => void;
}

const SEASONS: Record<string, string> = {
  winter: 'Зимовий науково-розважальний IT-табір',
  spring: 'Весняний науково-розважальний IT-табір',
  summer: 'Літній науково-розважальний IT-табір',
  autumn: 'Осінній науково-розважальний IT-табір',
};

function seasonFromMonth(month: number): keyof typeof SEASONS {
  if (month === 12 || month === 1 || month === 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'autumn';
}

function autoTitleFor(dateStr: string): string {
  if (!dateStr) return '';
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);
  const base = SEASONS[seasonFromMonth(month)] || '';
  if (!base) return '';
  return Number.isFinite(year) ? `${base} ${year}` : base;
}

export default function CreateCampModal({ isOpen, onClose, onCreated }: CreateCampModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [title, setTitle] = useState('');
  const [customTitle, setCustomTitle] = useState(false);
  const [globalPrice, setGlobalPrice] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load global price when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStartDate('');
    setEndDate('');
    setTitle('');
    setCustomTitle(false);
    setNotes('');
    setError(null);
    (async () => {
      try {
        const res = await fetch('/api/settings/camp-price-per-day');
        if (res.ok) {
          const json = await res.json();
          const raw = json.camp_price_per_day ?? json.value;
          const parsed = typeof raw === 'number' ? raw : parseInt(String(raw ?? '500'), 10);
          setGlobalPrice(Number.isFinite(parsed) ? parsed : 500);
        }
      } catch (err) {
        console.error('Load global price error:', err);
      }
    })();
  }, [isOpen]);

  // Auto-fill title when start date changes (unless user typed custom)
  useEffect(() => {
    if (!customTitle) {
      setTitle(autoTitleFor(startDate));
    }
  }, [startDate, customTitle]);

  const canSubmit = useMemo(() => {
    return startDate && endDate && startDate <= endDate && !saving;
  }, [startDate, endDate, saving]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        start_date: startDate,
        end_date: endDate,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      const res = await fetch('/api/camps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Не вдалося створити табір');
      }
      const json = await res.json();
      const newId: number | undefined = json?.camp?.id;
      onClose();
      if (newId) onCreated(newId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка створення');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
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
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-body" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: 0, color: '#111827' }}>Новий IT-табір</h3>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '0.25rem' }}
              title="Закрити"
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                  Початок
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                  Завершення
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                Назва табору {!customTitle && <span style={{ color: '#9ca3af', fontWeight: 400 }}>(авто за сезоном)</span>}
              </label>
              <input
                type="text"
                value={title}
                placeholder="Назва за сезоном"
                onChange={(e) => { setCustomTitle(true); setTitle(e.target.value); }}
                style={{ width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              />
              {customTitle && (
                <button
                  type="button"
                  onClick={() => { setCustomTitle(false); setTitle(autoTitleFor(startDate)); }}
                  style={{ marginTop: '0.25rem', background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                >
                  Відновити автоматичну назву
                </button>
              )}
            </div>

            {globalPrice != null && (
              <div style={{ padding: '0.5rem 0.625rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#475569' }}>
                Ціна за день: <b>{globalPrice} ₴</b> <span style={{ color: '#94a3b8' }}>(глобальне налаштування, можна змінити в «Налаштуваннях» → «Ціни та тарифи»)</span>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                Примітки
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {error && (
              <div style={{ padding: '0.5rem 0.625rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', color: '#b91c1c', fontSize: '0.8125rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button
                onClick={onClose}
                disabled={saving}
                className="btn btn-secondary"
                style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
              >
                Скасувати
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="btn btn-primary"
                style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem', opacity: canSubmit ? 1 : 0.6 }}
              >
                {saving ? 'Створення…' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
