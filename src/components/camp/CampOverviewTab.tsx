'use client';

import { useState } from 'react';
import { Trash2, Copy, Plus, CalendarDays, Save, X } from 'lucide-react';

interface CampShiftDay {
  id: number;
  shift_id: number;
  day_date: string;
  is_working: boolean;
}

interface CampShift {
  id: number;
  camp_id: number;
  title: string;
  start_date: string;
  end_date: string;
  order_index: number;
  notes: string | null;
  days: CampShiftDay[];
  working_days_count: number;
}

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
}

interface Props {
  camp: Camp;
  shifts: CampShift[];
  effectivePrice: number;
  globalPrice: number;
  onSaveCamp: (patch: Partial<Camp>) => Promise<void>;
  onDeleteCamp: () => Promise<void>;
  onCreateShift: (input: { title?: string; start_date: string; end_date: string; autoSkipWeekends: boolean }) => Promise<void>;
  onUpdateShift: (shiftId: number, patch: { title?: string; start_date?: string; end_date?: string }) => Promise<void>;
  onDeleteShift: (shiftId: number) => Promise<void>;
  onDuplicateShift: (shiftId: number) => Promise<void>;
  onToggleDay: (shiftId: number, date: string) => Promise<void>;
}

const SEASON_LABELS: Record<string, string> = {
  winter: 'Зима',
  spring: 'Весна',
  summer: 'Літо',
  autumn: 'Осінь',
};

function formatShortDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${parseInt(day, 10)}.${m}`;
}

function getWeekdayShort(d: string): string {
  const names = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return names[new Date(d + 'T00:00:00Z').getUTCDay()];
}

export default function CampOverviewTab({
  camp,
  shifts,
  effectivePrice,
  globalPrice,
  onSaveCamp,
  onDeleteCamp,
  onCreateShift,
  onUpdateShift,
  onDeleteShift,
  onDuplicateShift,
  onToggleDay,
}: Props) {
  const [editingCamp, setEditingCamp] = useState(false);
  const [form, setForm] = useState({
    title: camp.title,
    start_date: camp.start_date.slice(0, 10),
    end_date: camp.end_date.slice(0, 10),
    notes: camp.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const [newShiftOpen, setNewShiftOpen] = useState(false);
  const [newShift, setNewShift] = useState({
    title: '',
    start_date: '',
    end_date: '',
    autoSkipWeekends: true,
  });
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [shiftEditForm, setShiftEditForm] = useState<{ title: string; start_date: string; end_date: string } | null>(null);

  const saveCamp = async () => {
    setSaving(true);
    try {
      await onSaveCamp({
        title: form.title,
        start_date: form.start_date,
        end_date: form.end_date,
        notes: form.notes || null,
      });
      setEditingCamp(false);
    } finally {
      setSaving(false);
    }
  };

  const createShift = async () => {
    if (!newShift.start_date || !newShift.end_date) return;
    setSaving(true);
    try {
      await onCreateShift({
        title: newShift.title.trim() || undefined,
        start_date: newShift.start_date,
        end_date: newShift.end_date,
        autoSkipWeekends: newShift.autoSkipWeekends,
      });
      setNewShift({ title: '', start_date: '', end_date: '', autoSkipWeekends: true });
      setNewShiftOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const startEditShift = (s: CampShift) => {
    setEditingShiftId(s.id);
    setShiftEditForm({ title: s.title, start_date: s.start_date.slice(0, 10), end_date: s.end_date.slice(0, 10) });
  };

  const saveEditShift = async () => {
    if (editingShiftId == null || !shiftEditForm) return;
    setSaving(true);
    try {
      await onUpdateShift(editingShiftId, shiftEditForm);
      setEditingShiftId(null);
      setShiftEditForm(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Camp info card */}
      <div style={{ padding: '0.875rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
        {!editingCamp ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>{camp.title}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>{SEASON_LABELS[camp.season] ?? camp.season}</span>
                  <span>•</span>
                  <span>{formatShortDate(camp.start_date)} – {formatShortDate(camp.end_date)}</span>
                  <span>•</span>
                  <span>{effectivePrice} ₴/день</span>
                </div>
                {camp.notes && (
                  <div style={{ fontSize: '0.8125rem', color: '#4b5563', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{camp.notes}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => setEditingCamp(true)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Редагувати</button>
                <button
                  onClick={onDeleteCamp}
                  title="Видалити табір"
                  style={{ padding: '0.25rem 0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', color: '#dc2626', cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Назва табору"
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: '140px', fontSize: '0.75rem', color: '#64748b' }}>
                Початок
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                  style={{ width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.875rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', marginTop: '0.25rem' }}
                />
              </label>
              <label style={{ flex: 1, minWidth: '140px', fontSize: '0.75rem', color: '#64748b' }}>
                Завершення
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm({ ...form, end_date: e.target.value })}
                  style={{ width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.875rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', marginTop: '0.25rem' }}
                />
              </label>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Ціна за день: <b>{globalPrice} ₴</b> (глобальна, змінюється у «Налаштуваннях» → «Ціни та тарифи»)
            </div>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Примітки"
              rows={2}
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingCamp(false)} className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} disabled={saving}>
                Скасувати
              </button>
              <button onClick={saveCamp} className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} disabled={saving}>
                <Save size={14} /> Зберегти
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Shifts */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
            <CalendarDays size={14} style={{ display: 'inline', marginRight: '0.375rem', verticalAlign: '-2px' }} />
            Зміни ({shifts.length})
          </div>
          <button
            onClick={() => setNewShiftOpen(v => !v)}
            className="btn btn-primary"
            style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
          >
            <Plus size={12} /> Нова зміна
          </button>
        </div>

        {newShiftOpen && (
          <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <input
                placeholder="Назва (необов'язково)"
                value={newShift.title}
                onChange={e => setNewShift({ ...newShift, title: e.target.value })}
                style={{ flex: '1 1 160px', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #bfdbfe', borderRadius: '0.375rem' }}
              />
              <input
                type="date"
                value={newShift.start_date}
                onChange={e => setNewShift({ ...newShift, start_date: e.target.value })}
                style={{ flex: '1 1 140px', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #bfdbfe', borderRadius: '0.375rem' }}
              />
              <input
                type="date"
                value={newShift.end_date}
                onChange={e => setNewShift({ ...newShift, end_date: e.target.value })}
                style={{ flex: '1 1 140px', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #bfdbfe', borderRadius: '0.375rem' }}
              />
            </div>
            <label style={{ fontSize: '0.75rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={newShift.autoSkipWeekends}
                onChange={e => setNewShift({ ...newShift, autoSkipWeekends: e.target.checked })}
              />
              Автоматично позначити Сб/Нд як вихідні
            </label>
            <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setNewShiftOpen(false)} className="btn btn-secondary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }} disabled={saving}>Скасувати</button>
              <button onClick={createShift} className="btn btn-primary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }} disabled={saving || !newShift.start_date || !newShift.end_date}>Створити</button>
            </div>
          </div>
        )}

        {shifts.length === 0 && !newShiftOpen && (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px dashed #e5e7eb' }}>
            Змін ще немає
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {shifts.map(shift => (
            <div key={shift.id} style={{ padding: '0.625rem', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                {editingShiftId === shift.id && shiftEditForm ? (
                  <div style={{ display: 'flex', gap: '0.375rem', flex: 1, flexWrap: 'wrap' }}>
                    <input
                      value={shiftEditForm.title}
                      onChange={e => setShiftEditForm({ ...shiftEditForm, title: e.target.value })}
                      style={{ flex: '1 1 140px', padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                    />
                    <input
                      type="date"
                      value={shiftEditForm.start_date}
                      onChange={e => setShiftEditForm({ ...shiftEditForm, start_date: e.target.value })}
                      style={{ flex: '0 0 135px', padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                    />
                    <input
                      type="date"
                      value={shiftEditForm.end_date}
                      onChange={e => setShiftEditForm({ ...shiftEditForm, end_date: e.target.value })}
                      style={{ flex: '0 0 135px', padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                    />
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{shift.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {formatShortDate(shift.start_date)} – {formatShortDate(shift.end_date)} • {shift.working_days_count} роб. дн. із {shift.days.length}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {editingShiftId === shift.id ? (
                    <>
                      <button onClick={() => { setEditingShiftId(null); setShiftEditForm(null); }} title="Скасувати" style={{ padding: '0.25rem', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '0.25rem', cursor: 'pointer' }}>
                        <X size={13} />
                      </button>
                      <button onClick={saveEditShift} title="Зберегти" style={{ padding: '0.25rem 0.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }} disabled={saving}>
                        <Save size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEditShift(shift)} title="Редагувати" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Ред.</button>
                      <button onClick={() => onDuplicateShift(shift.id)} title="Дублювати" style={{ padding: '0.25rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '0.25rem', cursor: 'pointer' }}>
                        <Copy size={13} />
                      </button>
                      <button onClick={() => onDeleteShift(shift.id)} title="Видалити" style={{ padding: '0.25rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '0.25rem', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Days grid */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {shift.days.map(day => (
                  <button
                    key={day.id}
                    onClick={() => onToggleDay(shift.id, day.day_date)}
                    title={day.is_working ? 'Робочий — клік зробити вихідним' : 'Вихідний — клік зробити робочим'}
                    style={{
                      minWidth: '44px',
                      padding: '0.25rem 0.375rem',
                      fontSize: '0.6875rem',
                      border: '1px solid',
                      borderColor: day.is_working ? '#86efac' : '#fecaca',
                      backgroundColor: day.is_working ? '#dcfce7' : '#fef2f2',
                      color: day.is_working ? '#166534' : '#991b1b',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      lineHeight: 1.2,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.625rem', opacity: 0.7 }}>{getWeekdayShort(day.day_date)}</div>
                    <div style={{ fontWeight: 600 }}>{formatShortDate(day.day_date)}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
