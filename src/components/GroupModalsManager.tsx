'use client';

import { useState, useEffect, useRef } from 'react';
import DraggableModal from './DraggableModal';
import { formatDateKyiv } from '@/lib/date-utils';
import { useGroupModals } from './GroupModalsContext';
import { useStudentModals } from './StudentModalsContext';

interface GroupData {
  id: number;
  title: string;
  status: string;
  is_active: boolean;
  weekly_day: number;
  start_time: string;
  end_time: string | null;
  course_title?: string;
  room?: string;
  notes?: string;
}

interface GroupStudent {
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  join_date: string;
  photo: string | null;
  student_group_id: number;
}

interface AvailableStudent {
  id: number;
  full_name: string;
  public_id: string;
}

interface StudentPaymentStatus {
  student_id: number;
  student_name: string;
  discount_percent: number;
  lesson_price: number;
  effective_price: number;
  lessons_count: number;
  expected_amount: number;
  total_paid: number;
  debt: number;
}

interface PaymentFormData {
  student_id: number;
  student_name: string;
  amount: string;
  method: 'cash' | 'account';
  note: string;
  paid_at: string;
  debt: number;
}

const MONTH_NAMES = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
];

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -6; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

function getDayName(day: number): string {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  return days[day - 1] || '';
}

function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes}`;
}

export default function GroupModalsManager() {
  const { openModals, updateModalState, closeGroupModal, openGroupModal } = useGroupModals();
  const { openStudentModal } = useStudentModals();
  const [groupData, setGroupData] = useState<Record<number, { group: GroupData; students: GroupStudent[] }>>({});
  const [loadingGroups, setLoadingGroups] = useState<Record<number, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Record<number, AvailableStudent[]>>({});
  const [showAddStudentModal, setShowAddStudentModal] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAvailableStudents, setLoadingAvailableStudents] = useState<Record<number, boolean>>({});
  const [addingStudents, setAddingStudents] = useState<Set<number>>(new Set());
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Tab state per modal
  const [activeTab, setActiveTab] = useState<Record<number, 'info' | 'payments'>>({});
  // Payment data per modal
  const [paymentData, setPaymentData] = useState<Record<number, StudentPaymentStatus[]>>({});
  const [loadingPayments, setLoadingPayments] = useState<Record<number, boolean>>({});
  const [paymentMonth, setPaymentMonth] = useState<Record<number, string>>({});
  // Inline payment form
  const [paymentForm, setPaymentForm] = useState<Record<number, PaymentFormData | null>>({});
  const [savingPayment, setSavingPayment] = useState<Record<number, boolean>>({});
  const [paymentError, setPaymentError] = useState<Record<number, string>>({});

  const monthOptions = getMonthOptions();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Listen for open-group events dispatched from search or elsewhere
  useEffect(() => {
    const handler = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: number }>).detail;
      if (id) openGroupModal(id, `Група`);
    };
    window.addEventListener('itrobot-open-group', handler);
    return () => window.removeEventListener('itrobot-open-group', handler);
  }, [openGroupModal]);

  const loadGroupData = async (groupId: number) => {
    if (groupData[groupId] || loadingGroups[groupId]) return;
    
    setLoadingGroups(prev => ({ ...prev, [groupId]: true }));
    
    try {
      const response = await fetch(`/api/groups/${groupId}?withStudents=true`);
      if (response.ok) {
        const data = await response.json();
        setGroupData(prev => ({ ...prev, [groupId]: data }));
      }
    } catch (error) {
      console.error('Error loading group:', error);
    } finally {
      setLoadingGroups(prev => ({ ...prev, [groupId]: false }));
    }
  };

  useEffect(() => {
    openModals.forEach(modal => {
      if (modal.isOpen && !groupData[modal.id]) {
        loadGroupData(modal.id);
      }
    });
  }, [openModals]);

  const handleClose = (groupId: number) => {
    closeGroupModal(groupId);
  };

  const handleUpdatePosition = (groupId: number, position: { x: number; y: number }) => {
    updateModalState(groupId, { position });
  };

  const handleUpdateSize = (groupId: number, size: { width: number; height: number }) => {
    updateModalState(groupId, { size });
  };

  const loadAvailableStudents = async (groupId: number, search: string = '') => {
    setLoadingAvailableStudents(prev => ({ ...prev, [groupId]: true }));
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const response = await fetch(`/api/students?${params}`);
      if (response.ok) {
        const data = await response.json();
        const groupStudents = groupData[groupId]?.students || [];
        const studentIdsInGroup = new Set(groupStudents.map(s => s.id));
        const available = (data.students || []).filter((s: AvailableStudent) => !studentIdsInGroup.has(s.id));
        setAvailableStudents(prev => ({ ...prev, [groupId]: available }));
      }
    } catch (error) {
      console.error('Error loading available students:', error);
    } finally {
      setLoadingAvailableStudents(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const handleRemoveStudent = async (groupId: number, studentGroupId: number, studentName: string) => {
    if (!confirm(`Видалити ${studentName} з групи?`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/groups/${groupId}/students?studentGroupId=${studentGroupId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        const response = await fetch(`/api/groups/${groupId}?withStudents=true`);
        if (response.ok) {
          const data = await response.json();
          setGroupData(prev => ({ ...prev, [groupId]: data }));
          setAvailableStudents(prev => {
            const newState = { ...prev };
            delete newState[groupId];
            return newState;
          });
        }
      }
    } catch (error) {
      console.error('Error removing student:', error);
    }
  };

  const handleAddStudent = async (groupId: number, studentId: number) => {
    setAddingStudents(prev => new Set(prev).add(studentId));
    try {
      const res = await fetch(`/api/groups/${groupId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });

      if (res.ok) {
        const result = await res.json();
        const studentToAdd = availableStudents[groupId]?.find(s => s.id === studentId);
        if (studentToAdd) {
          // Optimistic update — no re-fetch needed
          const newStudent: GroupStudent = {
            id: studentId,
            public_id: studentToAdd.public_id,
            full_name: studentToAdd.full_name,
            phone: null,
            join_date: new Date().toISOString(),
            photo: null,
            student_group_id: result.id,
          };
          setGroupData(prev => ({
            ...prev,
            [groupId]: {
              ...prev[groupId],
              students: [...(prev[groupId]?.students || []), newStudent],
            },
          }));
          setAvailableStudents(prev => ({
            ...prev,
            [groupId]: (prev[groupId] || []).filter(s => s.id !== studentId),
          }));
        }
      }
    } catch (error) {
      console.error('Error adding student:', error);
    } finally {
      setAddingStudents(prev => { const s = new Set(prev); s.delete(studentId); return s; });
    }
  };

  const loadPaymentData = async (groupId: number, month?: string) => {
    const m = month || paymentMonth[groupId] || new Date().toISOString().substring(0, 7) + '-01';
    setLoadingPayments(prev => ({ ...prev, [groupId]: true }));
    try {
      const res = await fetch(`/api/groups/${groupId}/payments?month=${m}`);
      if (res.ok) {
        const json = await res.json();
        setPaymentData(prev => ({ ...prev, [groupId]: json.paymentStatus || [] }));
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
    } finally {
      setLoadingPayments(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const handleTabChange = (groupId: number, tab: 'info' | 'payments') => {
    setActiveTab(prev => ({ ...prev, [groupId]: tab }));
    if (tab === 'payments' && !paymentData[groupId]) {
      const m = new Date().toISOString().substring(0, 7) + '-01';
      setPaymentMonth(prev => ({ ...prev, [groupId]: m }));
      loadPaymentData(groupId, m);
    }
  };

  const handlePaymentMonthChange = (groupId: number, month: string) => {
    setPaymentMonth(prev => ({ ...prev, [groupId]: month }));
    loadPaymentData(groupId, month);
  };

  const openPaymentForm = (groupId: number, ps: StudentPaymentStatus) => {
    setPaymentForm(prev => ({ ...prev, [groupId]: {
      student_id: ps.student_id,
      student_name: ps.student_name,
      amount: String(ps.debt),
      method: 'cash',
      note: '',
      paid_at: new Date().toISOString().split('T')[0],
      debt: ps.debt,
    }}));
    setPaymentError(prev => ({ ...prev, [groupId]: '' }));
  };

  const handleSavePayment = async (groupId: number) => {
    const form = paymentForm[groupId];
    if (!form) return;

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError(prev => ({ ...prev, [groupId]: 'Введіть коректну суму' }));
      return;
    }

    setSavingPayment(prev => ({ ...prev, [groupId]: true }));
    setPaymentError(prev => ({ ...prev, [groupId]: '' }));

    try {
      const month = paymentMonth[groupId] || new Date().toISOString().substring(0, 7) + '-01';
      const res = await fetch(`/api/groups/${groupId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: form.student_id,
          month,
          amount,
          method: form.method,
          note: form.note || undefined,
          paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setPaymentError(prev => ({ ...prev, [groupId]: err.error || 'Помилка збереження' }));
      } else {
        setPaymentForm(prev => ({ ...prev, [groupId]: null }));
        loadPaymentData(groupId, month);
      }
    } catch {
      setPaymentError(prev => ({ ...prev, [groupId]: 'Помилка мережі' }));
    } finally {
      setSavingPayment(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const openAddStudentModal = async (groupId: number) => {
    setShowAddStudentModal(groupId);
    setSearchQuery('');
    await loadAvailableStudents(groupId);
  };

  const handleSearchChange = (groupId: number, query: string) => {
    setSearchQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      loadAvailableStudents(groupId, query);
    }, 300);
  };

  if (!isHydrated || openModals.length === 0) return null;

  return (
    <>
      <style>{`@keyframes gmm-spin { to { transform: rotate(360deg); } }`}</style>
      {openModals.map((modal) => {
        if (!modal.isOpen) return null;
        const data = groupData[modal.id];
        const isLoading = loadingGroups[modal.id];
        const group = data?.group;

        return (
          <DraggableModal
            key={modal.id}
            id={`group-modal-${modal.id}`}
            isOpen={true}
            onClose={() => handleClose(modal.id)}
            title={modal.title}
            groupUrl={`/groups/${modal.id}`}
            initialWidth={modal.size?.width || 520}
            initialHeight={modal.size?.height || 480}
            initialPosition={modal.position}
            onPositionChange={(pos) => handleUpdatePosition(modal.id, pos)}
            onSizeChange={(size) => handleUpdateSize(modal.id, size)}
          >
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ color: '#6b7280' }}>Завантаження...</div>
              </div>
            ) : group ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' }}>
                  {(['info', 'payments'] as const).map(t => {
                    const isActive = (activeTab[modal.id] || 'info') === t;
                    return (
                      <button
                        key={t}
                        onClick={() => handleTabChange(modal.id, t)}
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.8125rem',
                          fontWeight: isActive ? '600' : '400',
                          color: isActive ? '#1f2937' : '#6b7280',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                          cursor: 'pointer',
                          marginBottom: '-1px',
                          transition: 'all 0.15s',
                        }}
                      >
                        {t === 'info' ? 'Інфо' : 'Оплати'}
                      </button>
                    );
                  })}
                </div>

                {/* Info Tab */}
                {(activeTab[modal.id] || 'info') === 'info' && (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${group.is_active ? 'badge-success' : 'badge-gray'}`}>
                    {group.is_active ? 'Активна' : 'Неактивна'}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                    {group.status === 'active' ? 'Активна' : group.status === 'completed' ? 'Завершена' : 'Архівна'}
                  </span>
                </div>

                {group.course_title && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Курс</span>
                    <span style={{ fontSize: '0.9375rem', color: '#1f2937' }}>{group.course_title}</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Розклад</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bae6fd' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#0369a1' }}>{getDayName(group.weekly_day)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#fef3c7', borderRadius: '0.5rem', border: '1px solid #fde68a' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#b45309' }}>{formatTime(group.start_time)}{group.end_time && ` - ${formatTime(group.end_time)}`}</span>
                    </div>
                    {group.room && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#f3e8ff', borderRadius: '0.5rem', border: '1px solid #d8b4fe' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#7e22ce' }}>{group.room}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Студенти</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', backgroundColor: '#ecfdf5', borderRadius: '0.5rem', border: '1px solid #a7f3d0' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#047857' }}>{data?.students?.length || 0} студентів</span>
                    </div>
                  </div>
                  <button onClick={() => openAddStudentModal(modal.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', opacity: loadingAvailableStudents[modal.id] ? 0.7 : 1 }}>
                    {loadingAvailableStudents[modal.id] ? (
                      <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'gmm-spin 0.7s linear infinite', flexShrink: 0 }} />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    )}
                    Додати
                  </button>
                </div>

                {/* Add Student Panel - appears above student list */}
                {showAddStudentModal === modal.id && (
                  <div style={{ padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bae6fd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#0369a1' }}>Додати учня до групи</h4>
                      <button onClick={() => setShowAddStudentModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#0369a1' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                    
                    {/* Search Input */}
                    <input
                      type="text"
                      placeholder="Пошук учня..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(modal.id, e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #7dd3fc', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '0.75rem', outline: 'none' }}
                    />

                    {/* Students List with Add Buttons */}
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {loadingAvailableStudents[modal.id] && !availableStudents[modal.id] ? (
                        <p style={{ color: '#0369a1', textAlign: 'center', fontSize: '0.875rem', margin: '0.5rem 0' }}>Завантаження...</p>
                      ) : availableStudents[modal.id]?.length === 0 ? (
                        <p style={{ color: '#0369a1', textAlign: 'center', fontSize: '0.875rem', margin: '0.5rem 0' }}>Немає доступних учнів</p>
                      ) : (
                        availableStudents[modal.id]?.map((student) => {
                          const isAdding = addingStudents.has(student.id);
                          return (
                            <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: 'white', borderRadius: '0.375rem', border: '1px solid #bfdbfe' }}>
                              <div>
                                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' }}>{student.full_name}</span>
                                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>#{student.public_id}</span>
                              </div>
                              <button
                                onClick={() => handleAddStudent(modal.id, student.id)}
                                disabled={isAdding}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 500, cursor: isAdding ? 'default' : 'pointer', opacity: isAdding ? 0.7 : 1 }}
                              >
                                {isAdding ? (
                                  <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'gmm-spin 0.7s linear infinite' }} />
                                ) : (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                )}
                                Додати
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Students List */}
                {data?.students && data.students.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {data.students.map((student) => (
                        <div 
                          key={student.id} 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)', cursor: 'pointer' }}
                          onClick={() => openStudentModal(student.id, student.full_name)}
                        >
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid #bfdbfe' }}>
                            {student.photo ? <img src={student.photo} alt={student.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#2563eb' }}>{student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '500', color: '#111827' }}>{student.full_name}</p>
                            <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>#{student.public_id}</p>
                          </div>
                          <button onClick={() => handleRemoveStudent(modal.id, student.student_group_id, student.full_name)} title="Видалити з групи" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', cursor: 'pointer', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {group.notes && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Нотатки</span>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.5 }}>{group.notes}</p>
                  </div>
                )}
                </>)}

                {/* Payments Tab */}
                {activeTab[modal.id] === 'payments' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Month selector */}
                    <select
                      className="form-input"
                      value={paymentMonth[modal.id] || new Date().toISOString().substring(0, 7) + '-01'}
                      onChange={(e) => handlePaymentMonthChange(modal.id, e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                    >
                      {monthOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>

                    {loadingPayments[modal.id] ? (
                      <div style={{ textAlign: 'center', color: '#6b7280', padding: '1rem' }}>Завантаження...</div>
                    ) : (paymentData[modal.id] || []).length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#6b7280', padding: '1rem' }}>Немає даних за цей місяць</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(paymentData[modal.id] || []).map(ps => (
                          <div key={ps.student_id} style={{
                            padding: '0.75rem',
                            backgroundColor: ps.debt > 0 ? '#fef2f2' : '#ecfdf5',
                            borderRadius: '0.5rem',
                            border: `1px solid ${ps.debt > 0 ? '#fecaca' : '#a7f3d0'}`,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                              <button
                                onClick={() => openStudentModal(ps.student_id, ps.student_name)}
                                style={{ background: 'none', border: 'none', padding: 0, color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'underline', textAlign: 'left' }}
                              >
                                {ps.student_name}
                              </button>
                              {ps.debt > 0 && (
                                <button
                                  onClick={() => openPaymentForm(modal.id, ps)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                                >
                                  + Оплата
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#6b7280' }}>
                              <span>{ps.lessons_count} зан.</span>
                              <span>{ps.effective_price} ₴/зан</span>
                              {ps.discount_percent > 0 && <span className="badge badge-info" style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem' }}>-{ps.discount_percent}%</span>}
                              <span>До сплати: <b>{ps.expected_amount} ₴</b></span>
                              <span>Опл: <b style={{ color: '#22c55e' }}>{ps.total_paid} ₴</b></span>
                              {ps.debt > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>Борг: {ps.debt} ₴</span>}
                              {ps.debt === 0 && <span style={{ color: '#22c55e', fontWeight: 600 }}>Оплачено</span>}
                            </div>

                            {/* Inline payment form for this student */}
                            {paymentForm[modal.id]?.student_id === ps.student_id && (
                              <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'white', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                  <input
                                    type="number"
                                    placeholder="Сума"
                                    value={paymentForm[modal.id]?.amount || ''}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, [modal.id]: { ...prev[modal.id]!, amount: e.target.value } }))}
                                    style={{ flex: '1', minWidth: '80px', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '0.25rem' }}
                                  />
                                  <select
                                    value={paymentForm[modal.id]?.method || 'cash'}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, [modal.id]: { ...prev[modal.id]!, method: e.target.value as 'cash' | 'account' } }))}
                                    style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '0.25rem' }}
                                  >
                                    <option value="cash">Готівка</option>
                                    <option value="account">Безготівково</option>
                                  </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                  <input
                                    type="date"
                                    value={paymentForm[modal.id]?.paid_at || ''}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, [modal.id]: { ...prev[modal.id]!, paid_at: e.target.value } }))}
                                    style={{ flex: '1', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '0.25rem' }}
                                  />
                                  <input
                                    type="text"
                                    placeholder="Примітка"
                                    value={paymentForm[modal.id]?.note || ''}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, [modal.id]: { ...prev[modal.id]!, note: e.target.value } }))}
                                    style={{ flex: '1', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '0.25rem' }}
                                  />
                                </div>
                                {paymentError[modal.id] && (
                                  <div style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: '0.375rem' }}>{paymentError[modal.id]}</div>
                                )}
                                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => setPaymentForm(prev => ({ ...prev, [modal.id]: null }))}
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '0.25rem', cursor: 'pointer' }}
                                  >
                                    Скасувати
                                  </button>
                                  <button
                                    onClick={() => handleSavePayment(modal.id)}
                                    disabled={savingPayment[modal.id]}
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', opacity: savingPayment[modal.id] ? 0.7 : 1 }}
                                  >
                                    {savingPayment[modal.id] ? 'Зберігаю...' : 'Зберегти'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ color: '#ef4444' }}>Не вдалося завантажити дані</div>
              </div>
            )}
          </DraggableModal>
        );
      })}
    </>
  );
}
