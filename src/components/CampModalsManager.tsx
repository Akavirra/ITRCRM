'use client';

import { useState, useEffect, useCallback } from 'react';
import DraggableModal from './DraggableModal';
import { useCampModals } from './CampModalsContext';
import CampOverviewTab from './camp/CampOverviewTab';
import CampParticipantsTab from './camp/CampParticipantsTab';
import CampPaymentsTab from './camp/CampPaymentsTab';
import CreateStudentModal, { CreateStudentPrefill } from './CreateStudentModal';

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

interface CampBundle {
  camp: Camp;
  shifts: CampShift[];
  participants: Participant[];
  effectivePrice: number;
  globalPrice: number;
}

type TabKey = 'overview' | 'participants' | 'payments';

interface PendingConvert {
  campId: number;
  participantId: number;
  prefill: CreateStudentPrefill;
}

export default function CampModalsManager() {
  const { openModals, updateModalState, closeCampModal, openCampModal } = useCampModals();
  const [data, setData] = useState<Record<number, CampBundle>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<Record<number, TabKey>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [pendingConvert, setPendingConvert] = useState<PendingConvert | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Listen for open-camp events (fired elsewhere)
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, title } = (e as CustomEvent<{ id: number; title?: string }>).detail || {};
      if (id) openCampModal(id, title || 'Табір');
    };
    window.addEventListener('itrobot-open-camp', handler);
    return () => window.removeEventListener('itrobot-open-camp', handler);
  }, [openCampModal]);

  const loadCamp = useCallback(async (campId: number) => {
    setLoading(prev => ({ ...prev, [campId]: true }));
    try {
      const [campRes, partsRes] = await Promise.all([
        fetch(`/api/camps/${campId}`),
        fetch(`/api/camps/${campId}/participants`),
      ]);
      if (!campRes.ok) throw new Error('Не вдалося завантажити табір');
      const campJson = await campRes.json();
      const partsJson = partsRes.ok ? await partsRes.json() : { participants: [] };
      setData(prev => ({
        ...prev,
        [campId]: {
          camp: campJson.camp,
          shifts: campJson.shifts || [],
          participants: partsJson.participants || [],
          effectivePrice: campJson.effective_price_per_day,
          globalPrice: campJson.global_price_per_day,
        },
      }));
    } catch (err) {
      console.error('Load camp error:', err);
    } finally {
      setLoading(prev => ({ ...prev, [campId]: false }));
    }
  }, []);

  const reloadCamp = useCallback(async (campId: number) => {
    await loadCamp(campId);
  }, [loadCamp]);

  const reloadParticipants = useCallback(async (campId: number) => {
    try {
      const res = await fetch(`/api/camps/${campId}/participants`);
      if (!res.ok) return;
      const json = await res.json();
      setData(prev => ({
        ...prev,
        [campId]: prev[campId]
          ? { ...prev[campId], participants: json.participants || [] }
          : prev[campId],
      }));
    } catch (err) {
      console.error('Reload participants error:', err);
    }
  }, []);

  useEffect(() => {
    openModals.forEach(modal => {
      if (modal.isOpen && !data[modal.id] && !loading[modal.id]) {
        loadCamp(modal.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openModals]);

  const handleClose = (campId: number) => closeCampModal(campId);
  const handleUpdatePosition = (campId: number, position: { x: number; y: number }) =>
    updateModalState(campId, { position });
  const handleUpdateSize = (campId: number, size: { width: number; height: number }) =>
    updateModalState(campId, { size });

  // --- Camp handlers ---
  const handleSaveCamp = async (campId: number, patch: Partial<Camp>) => {
    const res = await fetch(`/api/camps/${campId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Помилка збереження');
    }
    await reloadCamp(campId);
  };

  const handleDeleteCamp = async (campId: number) => {
    const bundle = data[campId];
    if (!bundle) return;
    if (!confirm(`Видалити табір "${bundle.camp.title}"? Усі зміни, учасники та оплати будуть видалені.`)) return;
    const res = await fetch(`/api/camps/${campId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Помилка видалення');
      return;
    }
    closeCampModal(campId);
    window.dispatchEvent(new CustomEvent('itrobot-camps-updated'));
  };

  // --- Shift handlers ---
  const handleCreateShift = async (campId: number, input: { title?: string; start_date: string; end_date: string; autoSkipWeekends: boolean }) => {
    const res = await fetch(`/api/camps/${campId}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не вдалося створити зміну');
    }
    await reloadCamp(campId);
  };

  const handleUpdateShift = async (campId: number, shiftId: number, patch: { title?: string; start_date?: string; end_date?: string }) => {
    const res = await fetch(`/api/camps/${campId}/shifts/${shiftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не вдалося оновити зміну');
    }
    await reloadCamp(campId);
  };

  const handleDeleteShift = async (campId: number, shiftId: number) => {
    if (!confirm('Видалити зміну?')) return;
    const res = await fetch(`/api/camps/${campId}/shifts/${shiftId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Помилка видалення');
      return;
    }
    await reloadCamp(campId);
  };

  const handleDuplicateShift = async (campId: number, shiftId: number) => {
    const res = await fetch(`/api/camps/${campId}/shifts/${shiftId}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не вдалося дублювати зміну');
    }
    await reloadCamp(campId);
  };

  const handleToggleDay = async (campId: number, shiftId: number, date: string) => {
    const res = await fetch(`/api/camps/${campId}/shifts/${shiftId}/days/${date}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не вдалося оновити день');
    }
    await reloadCamp(campId);
  };

  // --- Participants handlers ---
  const handleAddFromBase = async (campId: number, input: { student_id: number; shift_id: number | null; days: string[] }) => {
    const res = await fetch(`/api/camps/${campId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не вдалося додати учасника');
    }
    await reloadParticipants(campId);
  };

  const handleAddNewChild = async (campId: number, input: { first_name: string; last_name: string; parent_name: string | null; parent_phone: string | null; shift_id: number | null; days: string[] }) => {
    const res = await fetch(`/api/camps/${campId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не вдалося додати дитину');
    }
    await reloadParticipants(campId);
  };

  const handleUpdateParticipant = async (campId: number, id: number, patch: Partial<Participant>) => {
    const res = await fetch(`/api/camps/${campId}/participants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не вдалося оновити учасника');
    }
    await reloadParticipants(campId);
  };

  const handleSetDays = async (campId: number, id: number, days: string[]) => {
    const res = await fetch(`/api/camps/${campId}/participants/${id}/days`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не вдалося зберегти дні');
    }
    await reloadParticipants(campId);
  };

  const handleDeleteParticipant = async (campId: number, id: number) => {
    const bundle = data[campId];
    const p = bundle?.participants.find(x => x.id === id);
    const name = p ? `${p.last_name} ${p.first_name}`.trim() : 'учасника';
    if (!confirm(`Видалити ${name}? Якщо є оплати — учасника буде позначено як скасованого.`)) return;
    const res = await fetch(`/api/camps/${campId}/participants/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Помилка видалення');
      return;
    }
    await reloadParticipants(campId);
  };

  const handleRequestConvertToStudent = (campId: number, participant: Participant) => {
    // Build a prefill from participant data — admin then confirms/augments in the standard student-create modal.
    const fullName = [participant.last_name, participant.first_name].filter(Boolean).join(' ').trim();
    const prefill: CreateStudentPrefill = {
      full_name: fullName,
      parent_name: participant.parent_name ?? undefined,
      parent_phone: participant.parent_phone ?? undefined,
      notes: participant.notes ?? undefined,
    };
    setPendingConvert({ campId, participantId: participant.id, prefill });
  };

  const handleConvertModalClose = () => {
    setPendingConvert(null);
  };

  const handleConvertModalCreated = async (createdStudentId?: number) => {
    if (!pendingConvert) return;
    const { campId, participantId } = pendingConvert;
    setPendingConvert(null);
    if (!createdStudentId) {
      // No ID returned — still reload to reflect any collateral changes.
      await reloadParticipants(campId);
      return;
    }
    // Link the participant to the freshly created student so future flows recognise them as in-base.
    try {
      const res = await fetch(`/api/camps/${campId}/participants/${participantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: createdStudentId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Учня створено, але не вдалося прив\u02BCязати до учасника');
      }
    } catch (err) {
      console.error('Link participant to new student error:', err);
    } finally {
      await reloadParticipants(campId);
    }
  };

  const handleOpenPayments = (campId: number) => {
    setActiveTab(prev => ({ ...prev, [campId]: 'payments' }));
  };

  // --- Payment handlers ---
  const handleAddPayment = async (campId: number, participantId: number, input: { amount: number; method: 'cash' | 'account'; paid_at: string; note: string | null }) => {
    const res = await fetch(`/api/camps/${campId}/participants/${participantId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не вдалося додати оплату');
    }
    await reloadParticipants(campId);
  };

  const handleDeletePayment = async (campId: number, participantId: number, paymentId: number) => {
    const res = await fetch(`/api/camps/${campId}/participants/${participantId}/payments/${paymentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не вдалося видалити оплату');
    }
    await reloadParticipants(campId);
  };

  const loadAllPayments = async (campId: number) => {
    const res = await fetch(`/api/camps/${campId}/payments`);
    if (!res.ok) throw new Error('Не вдалося завантажити оплати');
    const json = await res.json();
    return json.payments || [];
  };

  const loadParticipantPayments = async (campId: number, participantId: number) => {
    const res = await fetch(`/api/camps/${campId}/participants/${participantId}/payments`);
    if (!res.ok) throw new Error('Не вдалося завантажити оплати');
    const json = await res.json();
    return json.payments || [];
  };

  if (!isHydrated) return null;

  return (
    <>
      {openModals.map(modal => {
        if (!modal.isOpen) return null;
        const bundle = data[modal.id];
        const isLoading = loading[modal.id];
        const currentTab = activeTab[modal.id] || 'overview';

        return (
          <DraggableModal
            key={modal.id}
            id={`camp-modal-${modal.id}`}
            isOpen={true}
            onClose={() => handleClose(modal.id)}
            title={bundle?.camp?.title || modal.title}
            initialWidth={modal.size?.width || 900}
            initialHeight={modal.size?.height || 680}
            initialPosition={modal.position}
            minWidth={640}
            minHeight={480}
            onPositionChange={(pos) => handleUpdatePosition(modal.id, pos)}
            onSizeChange={(size) => handleUpdateSize(modal.id, size)}
          >
            {isLoading && !bundle ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ color: '#6b7280' }}>Завантаження...</div>
              </div>
            ) : bundle ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Tabs */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.25rem',
                    borderBottom: '1px solid #e5e7eb',
                    padding: '0 0.5rem',
                    backgroundColor: '#fafafa',
                    flexShrink: 0,
                  }}
                >
                  {([
                    { key: 'overview' as const, label: 'Огляд' },
                    { key: 'participants' as const, label: `Учасники (${bundle.participants.filter(p => p.status === 'active').length})` },
                    { key: 'payments' as const, label: 'Оплати' },
                  ]).map(t => {
                    const isActive = currentTab === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setActiveTab(prev => ({ ...prev, [modal.id]: t.key }))}
                        style={{
                          padding: '0.625rem 1rem',
                          fontSize: '0.875rem',
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? '#1f2937' : '#6b7280',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                          cursor: 'pointer',
                          marginBottom: '-1px',
                          transition: 'all 0.15s',
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                  {currentTab === 'overview' && (
                    <CampOverviewTab
                      camp={bundle.camp}
                      shifts={bundle.shifts}
                      effectivePrice={bundle.effectivePrice}
                      globalPrice={bundle.globalPrice}
                      onSaveCamp={(patch) => handleSaveCamp(modal.id, patch)}
                      onDeleteCamp={() => handleDeleteCamp(modal.id)}
                      onCreateShift={(input) => handleCreateShift(modal.id, input)}
                      onUpdateShift={(shiftId, patch) => handleUpdateShift(modal.id, shiftId, patch)}
                      onDeleteShift={(shiftId) => handleDeleteShift(modal.id, shiftId)}
                      onDuplicateShift={(shiftId) => handleDuplicateShift(modal.id, shiftId)}
                      onToggleDay={(shiftId, date) => handleToggleDay(modal.id, shiftId, date)}
                    />
                  )}

                  {currentTab === 'participants' && (
                    <CampParticipantsTab
                      campId={modal.id}
                      shifts={bundle.shifts}
                      participants={bundle.participants}
                      effectivePrice={bundle.effectivePrice}
                      loading={false}
                      onAddFromBase={(input) => handleAddFromBase(modal.id, input)}
                      onAddNewChild={(input) => handleAddNewChild(modal.id, input)}
                      onUpdateParticipant={(id, patch) => handleUpdateParticipant(modal.id, id, patch)}
                      onSetDays={(id, days) => handleSetDays(modal.id, id, days)}
                      onDeleteParticipant={(id) => handleDeleteParticipant(modal.id, id)}
                      onConvertToStudent={(participant) => handleRequestConvertToStudent(modal.id, participant)}
                      onOpenPayments={() => handleOpenPayments(modal.id)}
                      onSwitchToOverview={() => setActiveTab(prev => ({ ...prev, [modal.id]: 'overview' }))}
                    />
                  )}

                  {currentTab === 'payments' && (
                    <CampPaymentsTab
                      campId={modal.id}
                      participants={bundle.participants.map(p => ({
                        id: p.id,
                        first_name: p.first_name,
                        last_name: p.last_name,
                        shift_id: p.shift_id,
                        shift_title: p.shift_title,
                        total_expected: p.total_expected,
                        total_paid: p.total_paid,
                        balance: p.balance,
                        status: p.status,
                      }))}
                      loading={false}
                      onAddPayment={(pid, input) => handleAddPayment(modal.id, pid, input)}
                      onDeletePayment={(pid, paymentId) => handleDeletePayment(modal.id, pid, paymentId)}
                      onLoadAllPayments={() => loadAllPayments(modal.id)}
                      onLoadParticipantPayments={(pid) => loadParticipantPayments(modal.id, pid)}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ color: '#ef4444' }}>Не вдалося завантажити табір</div>
              </div>
            )}
          </DraggableModal>
        );
      })}

      {/* Prefilled student-creation modal for converting a participant into a base student */}
      <CreateStudentModal
        isOpen={pendingConvert !== null}
        onClose={handleConvertModalClose}
        onCreated={handleConvertModalCreated}
        prefill={pendingConvert?.prefill ?? null}
      />
    </>
  );
}
