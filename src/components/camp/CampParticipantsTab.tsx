'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Search, UserPlus, X, Save, Check } from 'lucide-react';

interface CampShift {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  days: Array<{ id: number; day_date: string; is_working: boolean }>;
}

interface Participant {
  id: number;
  public_id: string;
  camp_id: number;
  shift_id: number | null;
  student_id: number | null;
  student_public_id: string | null;
  student_phone: string | null;
  student_parent_phone: string | null;
  first_name: string;
  last_name: string;
  parent_name: string | null;
  parent_phone: string | null;
  notes: string | null;
  status: 'active' | 'cancelled';
  selected_days: string[];
  days_count: number;
  total_expected: number;
  total_paid: number;
  balance: number;
  shift_title: string | null;
}

interface SearchStudent {
  id: number;
  public_id: string;
  full_name: string;
  parent_phone: string | null;
}

interface Props {
  campId: number;
  shifts: CampShift[];
  participants: Participant[];
  effectivePrice: number;
  loading: boolean;
  onAddFromBase: (input: { student_id: number; shift_id: number | null; days: string[] }) => Promise<void>;
  onAddNewChild: (input: { first_name: string; last_name: string; parent_name: string | null; parent_phone: string | null; shift_id: number | null; days: string[] }) => Promise<void>;
  onUpdateParticipant: (id: number, patch: Partial<Pick<Participant, 'first_name' | 'last_name' | 'parent_name' | 'parent_phone' | 'notes' | 'shift_id' | 'status'>>) => Promise<void>;
  onSetDays: (id: number, days: string[]) => Promise<void>;
  onDeleteParticipant: (id: number) => Promise<void>;
  onConvertToStudent: (participant: Participant) => void;
  onOpenPayments: (participant: Participant) => void;
  onSwitchToOverview?: () => void;
}

function formatShortDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${parseInt(day, 10)}.${m}`;
}

export default function CampParticipantsTab({
  campId,
  shifts,
  participants,
  effectivePrice,
  loading,
  onAddFromBase,
  onAddNewChild,
  onUpdateParticipant,
  onSetDays,
  onDeleteParticipant,
  onConvertToStudent,
  onOpenPayments,
  onSwitchToOverview,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<'base' | 'new'>('base');

  // Search state (base)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SearchStudent | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Form state (new)
  const [newForm, setNewForm] = useState({
    first_name: '',
    last_name: '',
    parent_name: '',
    parent_phone: '',
  });

  // Common (shift + days)
  const [shiftIdForAdd, setShiftIdForAdd] = useState<number | ''>('');
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Expanded day-picker per participant
  const [expandedParticipantId, setExpandedParticipantId] = useState<number | null>(null);
  const [editingDays, setEditingDays] = useState<Set<string>>(new Set());
  const [editingParticipant, setEditingParticipant] = useState<{ id: number; first_name: string; last_name: string; parent_name: string; parent_phone: string } | null>(null);

  const selectedShift = useMemo(() => shifts.find(s => s.id === shiftIdForAdd), [shifts, shiftIdForAdd]);

  useEffect(() => {
    if (!addOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedStudent(null);
      setNewForm({ first_name: '', last_name: '', parent_name: '', parent_phone: '' });
      setShiftIdForAdd('');
      setSelectedDays(new Set());
    } else {
      // Auto-select single shift on open so days become selectable immediately
      if (shifts.length === 1) {
        setShiftIdForAdd(shifts[0].id);
      }
    }
  }, [addOpen, shifts]);

  // Auto-search students
  useEffect(() => {
    if (addMode !== 'base' || !addOpen) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/camps/${campId}/participants?searchAvailableStudents=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.students || []);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, addMode, campId, addOpen]);

  const toggleDay = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, date: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const selectAllShiftDays = (shift: CampShift | undefined, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    if (!shift) return;
    // Select ALL days of the shift regardless of working/non-working flag.
    // Non-working days remain visually marked red in the grid and can be deselected individually if needed.
    setter(new Set(shift.days.map(d => d.day_date)));
  };

  const submitAdd = async () => {
    // Only warn about empty-days when a shift is available — otherwise it's expected (no shifts yet)
    if (selectedDays.size === 0 && shifts.length > 0) {
      if (!confirm('Учасник не обрав жодного дня. Продовжити?')) return;
    }
    setSaving(true);
    try {
      const shift_id = shiftIdForAdd === '' ? null : shiftIdForAdd;
      const days = Array.from(selectedDays);
      if (addMode === 'base') {
        if (!selectedStudent) return;
        await onAddFromBase({ student_id: selectedStudent.id, shift_id, days });
      } else {
        if (!newForm.first_name.trim() && !newForm.last_name.trim()) return;
        await onAddNewChild({
          first_name: newForm.first_name.trim(),
          last_name: newForm.last_name.trim(),
          parent_name: newForm.parent_name.trim() || null,
          parent_phone: newForm.parent_phone.trim() || null,
          shift_id,
          days,
        });
      }
      setAddOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const startEditDays = (p: Participant) => {
    setExpandedParticipantId(p.id);
    setEditingDays(new Set(p.selected_days));
  };

  const cancelEditDays = () => {
    setExpandedParticipantId(null);
    setEditingDays(new Set());
  };

  const saveEditDays = async () => {
    if (expandedParticipantId == null) return;
    setSaving(true);
    try {
      await onSetDays(expandedParticipantId, Array.from(editingDays));
      setExpandedParticipantId(null);
      setEditingDays(new Set());
    } finally {
      setSaving(false);
    }
  };

  const startEditParticipant = (p: Participant) => {
    setEditingParticipant({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      parent_name: p.parent_name ?? '',
      parent_phone: p.parent_phone ?? '',
    });
  };

  const saveEditParticipant = async () => {
    if (!editingParticipant) return;
    setSaving(true);
    try {
      await onUpdateParticipant(editingParticipant.id, {
        first_name: editingParticipant.first_name,
        last_name: editingParticipant.last_name,
        parent_name: editingParticipant.parent_name || null,
        parent_phone: editingParticipant.parent_phone || null,
      });
      setEditingParticipant(null);
    } finally {
      setSaving(false);
    }
  };

  const renderDaysGrid = (shift: CampShift | undefined, set: Set<string>, onToggle: (date: string) => void) => {
    if (!shift) return <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Оберіть зміну, щоб відобразити дні</div>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {shift.days.map(d => {
          const isSelected = set.has(d.day_date);
          const working = d.is_working;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onToggle(d.day_date)}
              title={!working ? 'Вихідний' : ''}
              style={{
                minWidth: '44px',
                padding: '0.25rem 0.375rem',
                fontSize: '0.6875rem',
                borderRadius: '0.25rem',
                border: '1px solid',
                borderColor: isSelected ? '#1d4ed8' : working ? '#cbd5e1' : '#fecaca',
                backgroundColor: isSelected ? '#1d4ed8' : working ? 'white' : '#fef2f2',
                color: isSelected ? 'white' : working ? '#334155' : '#991b1b',
                cursor: 'pointer',
                opacity: !working && !isSelected ? 0.7 : 1,
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              {formatShortDate(d.day_date)}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
          Учасники ({participants.length})
        </div>
        <button onClick={() => setAddOpen(v => !v)} className="btn btn-primary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}>
          <Plus size={12} /> Додати
        </button>
      </div>

      {addOpen && (
        <div style={{ padding: '0.875rem', backgroundColor: '#eff6ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {shifts.length === 0 && (
            <div style={{ padding: '0.625rem 0.75rem', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>У таборі ще немає жодної зміни. Спершу створіть зміну у вкладці «Огляд», щоб обрати дні для учасника.</span>
              {onSwitchToOverview && (
                <button
                  type="button"
                  onClick={onSwitchToOverview}
                  className="btn btn-primary"
                  style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                >
                  До «Огляд»
                </button>
              )}
            </div>
          )}

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {(['new', 'base'] as const).map(m => (
              <button
                key={m}
                onClick={() => setAddMode(m)}
                style={{
                  padding: '0.25rem 0.625rem',
                  fontSize: '0.75rem',
                  borderRadius: '0.25rem',
                  border: '1px solid',
                  borderColor: addMode === m ? '#1d4ed8' : '#bfdbfe',
                  backgroundColor: addMode === m ? '#1d4ed8' : 'white',
                  color: addMode === m ? 'white' : '#1e40af',
                  cursor: 'pointer',
                  fontWeight: addMode === m ? 600 : 400,
                }}
              >
                {m === 'new' ? 'Нова дитина' : 'З бази учнів'}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => setAddOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={16} />
            </button>
          </div>

          {addMode === 'base' ? (
            <>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  placeholder="Ім'я або телефон..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSelectedStudent(null); }}
                  style={{ width: '100%', padding: '0.375rem 0.5rem 0.375rem 1.75rem', fontSize: '0.8125rem', border: '1px solid #bfdbfe', borderRadius: '0.375rem' }}
                />
              </div>
              {searchQuery && !selectedStudent && (
                <div style={{ maxHeight: '150px', overflowY: 'auto', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.375rem' }}>
                  {searchLoading && <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>Пошук...</div>}
                  {!searchLoading && searchResults.length === 0 && <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>Нічого не знайдено</div>}
                  {searchResults.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudent(s)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.375rem 0.5rem', fontSize: '0.75rem', border: 'none', borderBottom: '1px solid #f1f5f9', backgroundColor: 'white', cursor: 'pointer' }}
                    >
                      <span style={{ fontWeight: 500 }}>{s.full_name}</span>
                      {s.parent_phone && <span style={{ marginLeft: '0.5rem', color: '#64748b' }}>{s.parent_phone}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <div style={{ padding: '0.375rem 0.5rem', backgroundColor: 'white', border: '1px solid #bfdbfe', borderRadius: '0.375rem', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{selectedStudent.full_name}</span>
                  <button onClick={() => setSelectedStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              <input
                placeholder="Прізвище"
                value={newForm.last_name}
                onChange={e => setNewForm({ ...newForm, last_name: e.target.value })}
                style={{ flex: '1 1 120px', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #bfdbfe', borderRadius: '0.375rem' }}
              />
              <input
                placeholder="Ім'я"
                value={newForm.first_name}
                onChange={e => setNewForm({ ...newForm, first_name: e.target.value })}
                style={{ flex: '1 1 120px', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #bfdbfe', borderRadius: '0.375rem' }}
              />
              <input
                placeholder="Ім'я батьків"
                value={newForm.parent_name}
                onChange={e => setNewForm({ ...newForm, parent_name: e.target.value })}
                style={{ flex: '1 1 140px', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #bfdbfe', borderRadius: '0.375rem' }}
              />
              <input
                placeholder="Телефон батьків"
                value={newForm.parent_phone}
                onChange={e => setNewForm({ ...newForm, parent_phone: e.target.value })}
                style={{ flex: '1 1 140px', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #bfdbfe', borderRadius: '0.375rem' }}
              />
            </div>
          )}

          {/* Shift selector */}
          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 500 }}>Зміна:</label>
            <select
              value={shiftIdForAdd}
              onChange={e => { setShiftIdForAdd(e.target.value === '' ? '' : parseInt(e.target.value, 10)); setSelectedDays(new Set()); }}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #bfdbfe', borderRadius: '0.25rem' }}
            >
              <option value="">— без зміни —</option>
              {shifts.map(s => (
                <option key={s.id} value={s.id}>{s.title} ({formatShortDate(s.start_date)}–{formatShortDate(s.end_date)})</option>
              ))}
            </select>
            {selectedShift && (
              <>
                <button onClick={() => selectAllShiftDays(selectedShift, setSelectedDays)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Вся зміна</button>
                <button onClick={() => setSelectedDays(new Set())} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Очистити</button>
              </>
            )}
          </div>

          {/* Days grid */}
          {renderDaysGrid(selectedShift, selectedDays, (d) => toggleDay(setSelectedDays, d))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>
              Обрано: <b>{selectedDays.size}</b> • До сплати: <b>{selectedDays.size * effectivePrice} ₴</b>
            </div>
            <button
              onClick={submitAdd}
              disabled={saving || (addMode === 'base' ? !selectedStudent : !(newForm.first_name || newForm.last_name))}
              className="btn btn-primary"
              style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
            >
              {saving ? 'Додаю...' : <><UserPlus size={12} /> Додати</>}
            </button>
          </div>
        </div>
      )}

      {/* Participants list */}
      {loading && <div style={{ fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center', padding: '0.75rem' }}>Завантаження...</div>}
      {!loading && participants.length === 0 && (
        <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px dashed #e5e7eb' }}>
          Учасників поки немає
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {participants.map(p => {
          const isEditing = editingParticipant?.id === p.id;
          const isExpandedDays = expandedParticipantId === p.id;
          const participantShift = shifts.find(s => s.id === p.shift_id);

          const fullName = [p.last_name, p.first_name].filter(Boolean).join(' ') || '(без імені)';
          const balanceColor = p.balance > 0 ? '#dc2626' : p.balance < 0 ? '#d97706' : '#16a34a';
          const balanceLabel = p.balance > 0 ? `Борг ${p.balance} ₴` : p.balance < 0 ? `Переплата ${-p.balance} ₴` : 'Оплачено';

          return (
            <div key={p.id} style={{ padding: '0.625rem', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', opacity: p.status === 'cancelled' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input value={editingParticipant.last_name} onChange={e => setEditingParticipant({ ...editingParticipant, last_name: e.target.value })} placeholder="Прізвище" style={{ flex: 1, padding: '0.25rem 0.375rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }} />
                        <input value={editingParticipant.first_name} onChange={e => setEditingParticipant({ ...editingParticipant, first_name: e.target.value })} placeholder="Ім'я" style={{ flex: 1, padding: '0.25rem 0.375rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input value={editingParticipant.parent_name} onChange={e => setEditingParticipant({ ...editingParticipant, parent_name: e.target.value })} placeholder="Батьки" style={{ flex: 1, padding: '0.25rem 0.375rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }} />
                        <input value={editingParticipant.parent_phone} onChange={e => setEditingParticipant({ ...editingParticipant, parent_phone: e.target.value })} placeholder="Телефон" style={{ flex: 1, padding: '0.25rem 0.375rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{fullName}</span>
                        {p.student_id ? (
                          <span style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '0.25rem', fontWeight: 500 }}>в базі</span>
                        ) : (
                          <span style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '0.25rem', fontWeight: 500 }}>не в базі</span>
                        )}
                        {p.status === 'cancelled' && (
                          <span style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '0.25rem', fontWeight: 500 }}>скасовано</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem' }}>
                        {p.parent_name && <span>{p.parent_name}</span>}
                        {p.parent_name && p.parent_phone && <span> • </span>}
                        {p.parent_phone && <span>{p.parent_phone}</span>}
                        {!p.parent_name && !p.parent_phone && <span style={{ fontStyle: 'italic' }}>без контактів</span>}
                      </div>
                      {p.shift_title && <div style={{ fontSize: '0.6875rem', color: '#6366f1', marginTop: '0.125rem' }}>Зміна: {p.shift_title}</div>}
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem', minWidth: '110px' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{p.days_count} дн. × {effectivePrice} = <b>{p.total_expected} ₴</b></div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Опл: {p.total_paid} ₴</div>
                  <div style={{ fontSize: '0.75rem', color: balanceColor, fontWeight: 700 }}>{balanceLabel}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {isEditing ? (
                  <>
                    <button onClick={() => setEditingParticipant(null)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} disabled={saving}>Скасувати</button>
                    <button onClick={saveEditParticipant} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} disabled={saving}><Save size={11} /> Зберегти</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEditDays(p)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                      Дні ({p.days_count})
                    </button>
                    <button onClick={() => startEditParticipant(p)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                      Ред.
                    </button>
                    <button onClick={() => onOpenPayments(p)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', borderRadius: '0.25rem', cursor: 'pointer' }}>
                      Оплати
                    </button>
                    {!p.student_id && (
                      <button onClick={() => onConvertToStudent(p)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '0.25rem', cursor: 'pointer' }}>
                        <UserPlus size={11} style={{ verticalAlign: '-2px' }} /> В базу
                      </button>
                    )}
                    <button onClick={() => onDeleteParticipant(p.id)} title="Видалити" style={{ padding: '0.25rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '0.25rem', cursor: 'pointer' }}>
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>

              {/* Expanded day picker */}
              {isExpandedDays && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}>
                  {!participantShift && (
                    <div style={{ fontSize: '0.6875rem', color: '#d97706', marginBottom: '0.375rem' }}>
                      Зміну не вибрано. Для редагування днів спершу призначте зміну (натисніть «Ред.» та змініть зміну) або виберіть дні з поточного табору нижче.
                    </div>
                  )}
                  {participantShift ? (
                    <>
                      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                        <button onClick={() => selectAllShiftDays(participantShift, setEditingDays)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Вся зміна</button>
                        <button onClick={() => setEditingDays(new Set())} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Очистити</button>
                      </div>
                      {renderDaysGrid(participantShift, editingDays, (d) => toggleDay(setEditingDays, d))}
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {shifts.map(s => (
                        <div key={s.id}>
                          <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600, marginBottom: '0.125rem' }}>{s.title}</div>
                          {renderDaysGrid(s, editingDays, (d) => toggleDay(setEditingDays, d))}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.375rem' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>Обрано: <b>{editingDays.size}</b></span>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={cancelEditDays} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} disabled={saving}>Скасувати</button>
                      <button onClick={saveEditDays} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} disabled={saving}><Check size={11} /> Зберегти</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
