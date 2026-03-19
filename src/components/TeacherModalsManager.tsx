'use client';

import { useState, useEffect } from 'react';
import DraggableModal from './DraggableModal';
import { useTeacherModals } from './TeacherModalsContext';
import { useGroupModals } from './GroupModalsContext';
import { useLessonModals } from './LessonModalsContext';

const MONTHS_UK = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const MONTHS_UK_GEN = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];

function getDefaultMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface TeacherData {
  id: number;
  public_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  telegram_id: string | null;
  photo_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface TeacherWithGroups extends TeacherData {
  groups: Array<{
    id: number;
    public_id: string;
    title: string;
    course_id: number;
    weekly_day: number;
    start_time: string;
    duration_minutes: number;
    course_title: string;
  }>;
}

interface SalaryExtraItem { id: number; description: string; amount: number; created_at: string; }

interface TeacherSalaryData {
  teacher: { id: number; name: string };
  year: number;
  month: number;
  salary_group_rate: number;
  salary_individual_rate: number;
  lessons: Array<{
    lesson_id: number;
    lesson_date: string;
    group_title: string | null;
    is_individual: boolean;
    is_replacement: boolean;
    present_count: number;
    makeup_count: number;
    makeup_lesson_id: number | null;
    rate: number;
    salary: number;
  }>;
  extra_items: SalaryExtraItem[];
  lessons_total: number;
  extras_total: number;
  grand_total: number;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12) {
    return `+${digits.slice(0, 3)} (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
  }
  return phone;
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

function getStatusBadge(isActive: boolean) {
  return (
    <span className={isActive ? 'badge badge-success' : 'badge badge-gray'}>
      {isActive ? 'Активний' : 'Неактивний'}
    </span>
  );
}

export default function TeacherModalsManager() {
  const { openModals, updateModalState, closeTeacherModal } = useTeacherModals();
  const { openGroupModal } = useGroupModals();
  const { openLessonModal } = useLessonModals();
  const [teacherData, setTeacherData] = useState<Record<number, TeacherWithGroups>>({});
  const [loadingTeachers, setLoadingTeachers] = useState<Record<number, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  // Notes editing state
  const [editingNotes, setEditingNotes] = useState<Record<number, boolean>>({});
  const [editedNotes, setEditedNotes] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({});

  // Copy state
  const [copiedField, setCopiedField] = useState<{ teacherId: number; field: string } | null>(null);

  // Stats & Salary state (per teacher)
  const [statsSectionOpen, setStatsSectionOpen] = useState<Record<number, boolean>>({});
  const [salaryMonthMap, setSalaryMonthMap] = useState<Record<number, string>>({});
  const [salaryDataMap, setSalaryDataMap] = useState<Record<number, TeacherSalaryData>>({});
  const [salaryLoadingMap, setSalaryLoadingMap] = useState<Record<number, boolean>>({});
  const [lessonsListOpen, setLessonsListOpen] = useState<Record<number, boolean>>({});
  const [newItemDescMap, setNewItemDescMap] = useState<Record<number, string>>({});
  const [newItemAmountMap, setNewItemAmountMap] = useState<Record<number, string>>({});
  const [addingItemMap, setAddingItemMap] = useState<Record<number, boolean>>({});
  const [deletingItemMap, setDeletingItemMap] = useState<Record<number, number | null>>({});

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const loadTeacherData = async (teacherId: number) => {
    if (teacherData[teacherId] || loadingTeachers[teacherId]) return;

    setLoadingTeachers(prev => ({ ...prev, [teacherId]: true }));

    try {
      const response = await fetch(`/api/teachers/${teacherId}`);
      if (response.ok) {
        const data = await response.json();
        setTeacherData(prev => ({ ...prev, [teacherId]: data }));
      }
    } catch (error) {
      console.error('Error loading teacher:', error);
    } finally {
      setLoadingTeachers(prev => ({ ...prev, [teacherId]: false }));
    }
  };

  useEffect(() => {
    openModals.forEach(modal => {
      if (modal.isOpen && !teacherData[modal.id]) {
        loadTeacherData(modal.id);
      }
    });
  }, [openModals]);

  const handleClose = (teacherId: number) => {
    closeTeacherModal(teacherId);
  };

  const handleUpdatePosition = (teacherId: number, position: { x: number; y: number }) => {
    updateModalState(teacherId, { position });
  };

  const handleUpdateSize = (teacherId: number, size: { width: number; height: number }) => {
    updateModalState(teacherId, { size });
  };

  const handleSaveNotes = async (teacherId: number) => {
    const teacher = teacherData[teacherId];
    if (!teacher) return;

    setSavingNotes(prev => ({ ...prev, [teacherId]: true }));

    try {
      const response = await fetch(`/api/teachers/${teacherId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teacher.name,
          email: teacher.email,
          notes: editedNotes[teacherId] || ''
        })
      });

      if (response.ok) {
        setTeacherData(prev => ({
          ...prev,
          [teacherId]: { ...prev[teacherId], notes: editedNotes[teacherId] || null }
        }));
        setEditingNotes(prev => ({ ...prev, [teacherId]: false }));
      }
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setSavingNotes(prev => ({ ...prev, [teacherId]: false }));
    }
  };

  const startEditingNotes = (teacherId: number, currentNotes: string | null) => {
    setEditingNotes(prev => ({ ...prev, [teacherId]: true }));
    setEditedNotes(prev => ({ ...prev, [teacherId]: currentNotes || '' }));
  };

  const cancelEditingNotes = (teacherId: number) => {
    setEditingNotes(prev => ({ ...prev, [teacherId]: false }));
    setEditedNotes(prev => {
      const newState = { ...prev };
      delete newState[teacherId];
      return newState;
    });
  };

  // ── Salary helpers ────────────────────────────────────────────────────────

  const fetchTeacherSalary = async (teacherId: number, month: string) => {
    const [year, mon] = month.split('-');
    setSalaryLoadingMap(prev => ({ ...prev, [teacherId]: true }));
    setSalaryDataMap(prev => { const n = { ...prev }; delete n[teacherId]; return n; });
    setLessonsListOpen(prev => ({ ...prev, [teacherId]: false }));
    try {
      const res = await fetch(`/api/teachers/${teacherId}/salary?year=${year}&month=${parseInt(mon, 10)}`);
      if (res.ok) {
        const data = await res.json();
        setSalaryDataMap(prev => ({ ...prev, [teacherId]: data }));
      }
    } catch { /* silent */ } finally {
      setSalaryLoadingMap(prev => ({ ...prev, [teacherId]: false }));
    }
  };

  const toggleStatsSection = (teacherId: number) => {
    const willOpen = !statsSectionOpen[teacherId];
    setStatsSectionOpen(prev => ({ ...prev, [teacherId]: willOpen }));
    if (willOpen && !salaryDataMap[teacherId] && !salaryLoadingMap[teacherId]) {
      const month = salaryMonthMap[teacherId] || getDefaultMonth();
      setSalaryMonthMap(prev => ({ ...prev, [teacherId]: prev[teacherId] || month }));
      fetchTeacherSalary(teacherId, month);
    }
  };

  const addSalaryItem = async (teacherId: number) => {
    const desc = (newItemDescMap[teacherId] || '').trim();
    const amount = parseFloat(newItemAmountMap[teacherId] || '');
    if (!desc || isNaN(amount) || amount < 0) return;
    const sd = salaryDataMap[teacherId];
    if (!sd) return;
    setAddingItemMap(prev => ({ ...prev, [teacherId]: true }));
    try {
      const res = await fetch(`/api/teachers/${teacherId}/salary/extra-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: sd.year, month: sd.month, description: desc, amount }),
      });
      if (res.ok) {
        const { item } = await res.json();
        setNewItemDescMap(prev => ({ ...prev, [teacherId]: '' }));
        setNewItemAmountMap(prev => ({ ...prev, [teacherId]: '' }));
        setSalaryDataMap(prev => {
          const d = prev[teacherId];
          if (!d) return prev;
          const extras = [...d.extra_items, item];
          const extrasTotal = extras.reduce((s, i) => s + i.amount, 0);
          return { ...prev, [teacherId]: { ...d, extra_items: extras, extras_total: extrasTotal, grand_total: d.lessons_total + extrasTotal } };
        });
      }
    } catch { /* silent */ } finally {
      setAddingItemMap(prev => ({ ...prev, [teacherId]: false }));
    }
  };

  const deleteSalaryItem = async (teacherId: number, itemId: number) => {
    setDeletingItemMap(prev => ({ ...prev, [teacherId]: itemId }));
    try {
      await fetch(`/api/teachers/${teacherId}/salary/extra-items?itemId=${itemId}`, { method: 'DELETE' });
      setSalaryDataMap(prev => {
        const d = prev[teacherId];
        if (!d) return prev;
        const extras = d.extra_items.filter(i => i.id !== itemId);
        const extrasTotal = extras.reduce((s, i) => s + i.amount, 0);
        return { ...prev, [teacherId]: { ...d, extra_items: extras, extras_total: extrasTotal, grand_total: d.lessons_total + extrasTotal } };
      });
    } catch { /* silent */ } finally {
      setDeletingItemMap(prev => ({ ...prev, [teacherId]: null }));
    }
  };

  if (!isHydrated || openModals.length === 0) return null;

  return (
    <>
      {openModals.map((modal) => {
        if (!modal.isOpen) return null;
        const teacher = teacherData[modal.id];
        const isLoading = loadingTeachers[modal.id];

        return (
          <DraggableModal
            key={modal.id}
            id={`teacher-modal-${modal.id}`}
            isOpen={true}
            onClose={() => handleClose(modal.id)}
            title={modal.title}
            groupUrl={`/teachers/${modal.id}`}
            initialWidth={modal.size?.width || 520}
            initialHeight={modal.size?.height || 520}
            initialPosition={modal.position}
            onPositionChange={(pos) => handleUpdatePosition(modal.id, pos)}
            onSizeChange={(size) => handleUpdateSize(modal.id, size)}
          >
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ color: '#6b7280' }}>Завантаження...</div>
              </div>
            ) : teacher ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Header with photo and basic info */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  {/* Avatar */}
                  <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: '#dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '3px solid #bfdbfe'
                  }}>
                    {teacher.photo_url ? (
                      <img src={teacher.photo_url} alt={teacher.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.5rem', fontWeight: 600, color: '#2563eb' }}>
                        {teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    )}
                  </div>

                  {/* Name and status */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1f2937' }}>
                        {teacher.name}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {getStatusBadge(teacher.is_active)}
                      <span style={{ fontSize: '0.8125rem', color: '#6b7280', fontFamily: 'monospace' }}>
                        #{teacher.public_id || teacher.id}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.375rem', fontSize: '0.75rem', color: '#6b7280' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Створено: {formatDateTime(teacher.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Контакти</span>

                  {/* Phone */}
                  {teacher.phone && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#f0fdf4',
                        borderRadius: '0.5rem',
                        border: '1px solid #bbf7d0',
                        transition: 'background-color 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                    >
                      <div style={{
                        padding: '0.25rem',
                        backgroundColor: copiedField?.field === 'phone' && copiedField?.teacherId === teacher.id ? '#86efac' : '#bbf7d0',
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}>
                        {copiedField?.field === 'phone' && copiedField?.teacherId === teacher.id ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.6875rem', color: '#16a34a', fontWeight: '600' }}>Телефон</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <a
                          href={`tel:${teacher.phone}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(teacher.phone || '');
                            setCopiedField({ teacherId: teacher.id, field: 'phone' });
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          style={{
                            color: copiedField?.field === 'phone' && copiedField?.teacherId === teacher.id ? '#16a34a' : '#166534',
                            textDecoration: 'none',
                            fontSize: '0.8125rem',
                            fontWeight: '600',
                            transition: 'color 0.15s',
                          }}
                          title="Клікніть щоб скопіювати"
                        >
                          {formatPhone(teacher.phone)}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Telegram */}
                  {teacher.telegram_id && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#eff6ff',
                        borderRadius: '0.5rem',
                        border: '1px solid #bfdbfe',
                        transition: 'background-color 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                    >
                      <div style={{
                        padding: '0.25rem',
                        backgroundColor: copiedField?.field === 'telegram' && copiedField?.teacherId === teacher.id ? '#93c5fd' : '#bfdbfe',
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}>
                        {copiedField?.field === 'telegram' && copiedField?.teacherId === teacher.id ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.6875rem', color: '#2563eb', fontWeight: '600' }}>Telegram</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <a
                          href={`https://t.me/${teacher.telegram_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            navigator.clipboard.writeText(teacher.telegram_id || '');
                            setCopiedField({ teacherId: teacher.id, field: 'telegram' });
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          style={{
                            color: copiedField?.field === 'telegram' && copiedField?.teacherId === teacher.id ? '#2563eb' : '#1e40af',
                            textDecoration: 'none',
                            fontSize: '0.8125rem',
                            fontWeight: '600',
                            transition: 'color 0.15s',
                          }}
                          title="Клікніть щоб скопіювати"
                        >
                          @{teacher.telegram_id}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  {teacher.email && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#fdf2f8',
                        borderRadius: '0.5rem',
                        border: '1px solid #fbcfe8',
                        transition: 'background-color 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fce7f3'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fdf2f8'}
                    >
                      <div style={{
                        padding: '0.25rem',
                        backgroundColor: copiedField?.field === 'email' && copiedField?.teacherId === teacher.id ? '#f9a8d4' : '#fbcfe8',
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}>
                        {copiedField?.field === 'email' && copiedField?.teacherId === teacher.id ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.6875rem', color: '#db2777', fontWeight: '600' }}>Email</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <a
                          href={`mailto:${teacher.email}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(teacher.email || '');
                            setCopiedField({ teacherId: teacher.id, field: 'email' });
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          style={{
                            color: copiedField?.field === 'email' && copiedField?.teacherId === teacher.id ? '#db2777' : '#831843',
                            textDecoration: 'none',
                            fontSize: '0.8125rem',
                            fontWeight: '600',
                            transition: 'color 0.15s',
                          }}
                          title="Клікніть щоб скопіювати"
                        >
                          {teacher.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {!teacher.phone && !teacher.telegram_id && !teacher.email && (
                    <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>Контакти відсутні</span>
                  )}
                </div>

                {/* Groups */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Групи</span>

                  {teacher.groups && teacher.groups.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {teacher.groups.map((group) => (
                        <div
                          key={group.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.625rem 0.75rem',
                            backgroundColor: 'white',
                            borderRadius: '0.5rem',
                            border: '1px solid #e5e7eb',
                            cursor: 'pointer',
                          }}
                          onClick={() => openGroupModal(group.id, group.title)}
                        >
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '0.5rem',
                            backgroundColor: '#ede9fe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: '#111827' }}>{group.title}</p>
                            <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>{group.course_title}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>
                              {getDayName(group.weekly_day)} {formatTime(group.start_time)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>Немає груп</span>
                  )}
                </div>

                {/* Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Нотатки</span>

                  {editingNotes[teacher.id] ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <textarea
                        value={editedNotes[teacher.id] || ''}
                        onChange={(e) => setEditedNotes(prev => ({ ...prev, [teacher.id]: e.target.value }))}
                        placeholder="Введіть нотатку..."
                        style={{
                          width: '100%',
                          minHeight: '80px',
                          padding: '0.625rem',
                          fontSize: '0.875rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => cancelEditingNotes(teacher.id)}
                          disabled={savingNotes[teacher.id]}
                          style={{
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            backgroundColor: 'white',
                            color: '#374151',
                            cursor: savingNotes[teacher.id] ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Скасувати
                        </button>
                        <button
                          onClick={() => handleSaveNotes(teacher.id)}
                          disabled={savingNotes[teacher.id]}
                          style={{
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            border: 'none',
                            borderRadius: '0.375rem',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            cursor: savingNotes[teacher.id] ? 'not-allowed' : 'pointer',
                            opacity: savingNotes[teacher.id] ? 0.7 : 1,
                          }}
                        >
                          {savingNotes[teacher.id] ? 'Збереження...' : 'Зберегти'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        padding: '0.625rem 0.75rem',
                        backgroundColor: teacher.notes ? '#fefce8' : '#f9fafb',
                        borderRadius: '0.5rem',
                        border: `1px solid ${teacher.notes ? '#fef08a' : '#e5e7eb'}`,
                        cursor: 'pointer',
                        minHeight: '44px',
                      }}
                      onClick={() => startEditingNotes(teacher.id, teacher.notes)}
                    >
                      <div style={{ flex: 1 }}>
                        {teacher.notes ? (
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#1f2937', whiteSpace: 'pre-wrap' }}>{teacher.notes}</p>
                        ) : (
                          <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>Натисніть щоб додати нотатку</span>
                        )}
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* ── Stats & Salary ─────────────────────────────────────────── */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  {/* Section header toggle */}
                  <button
                    onClick={() => toggleStatsSection(teacher.id)}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem 0', gap: '0.5rem' }}
                  >
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, textAlign: 'left' }}>
                      Статистика та зарплата
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{statsSectionOpen[teacher.id] ? '▲ Згорнути' : '▼ Розгорнути'}</span>
                  </button>

                  {statsSectionOpen[teacher.id] && (
                    <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      {/* Month picker */}
                      <input
                        type="month"
                        value={salaryMonthMap[teacher.id] || getDefaultMonth()}
                        onChange={e => {
                          setSalaryMonthMap(prev => ({ ...prev, [teacher.id]: e.target.value }));
                          fetchTeacherSalary(teacher.id, e.target.value);
                        }}
                        style={{ padding: '0.375rem 0.625rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.8125rem', color: '#374151', background: '#f8fafc', cursor: 'pointer', width: 'fit-content' }}
                      />

                      {salaryLoadingMap[teacher.id] ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>Завантаження...</div>
                      ) : (() => {
                        const sd = salaryDataMap[teacher.id];
                        if (!sd) return null;
                        const groupCount = sd.lessons.filter(l => !l.is_individual && !l.is_replacement).length;
                        const indCount = sd.lessons.filter(l => l.is_individual).length;
                        const makeupCount = sd.lessons.filter(l => l.makeup_count > 0).length;
                        const totalStudents = sd.lessons.reduce((s, l) => s + l.present_count, 0);
                        const isExpanded = !!lessonsListOpen[teacher.id];
                        return (
                          <>
                            {/* Summary pills */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                              {[
                                { label: 'Усіх', value: sd.lessons.length, color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
                                { label: 'Групових', value: groupCount, color: '#065f46', bg: '#f0fdf4', border: '#bbf7d0' },
                                { label: 'Індивід.', value: indCount, color: '#5b21b6', bg: '#f5f3ff', border: '#ddd6fe' },
                                { label: 'Відпрац.', value: makeupCount, color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
                                { label: 'Учнів', value: totalStudents, color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
                              ].map(p => (
                                <div key={p.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.375rem 0.625rem', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, minWidth: 52 }}>
                                  <span style={{ fontSize: '1rem', fontWeight: 700, color: p.color, lineHeight: 1.1 }}>{p.value}</span>
                                  <span style={{ fontSize: '0.625rem', color: p.color, opacity: 0.75, fontWeight: 600, marginTop: 1 }}>{p.label}</span>
                                </div>
                              ))}
                            </div>

                            {/* Lessons list (collapsible) */}
                            <div>
                              <button
                                onClick={() => setLessonsListOpen(prev => ({ ...prev, [teacher.id]: !prev[teacher.id] }))}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: isExpanded ? '0.5rem' : 0, width: '100%', textAlign: 'left' }}
                              >
                                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                  Заняття ({sd.lessons.length})
                                </span>
                                <span style={{ fontSize: '0.6875rem', color: '#94a3b8', marginLeft: 'auto' }}>{isExpanded ? '▲ Згорнути' : '▼ Розгорнути'}</span>
                              </button>

                              {isExpanded && (sd.lessons.length === 0 ? (
                                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 8, color: '#94a3b8', fontSize: '0.8125rem', textAlign: 'center' }}>Немає занять за цей місяць</div>
                              ) : (
                                <div style={{ borderRadius: 8, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                    <thead>
                                      <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '0.375rem 0.625rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.625rem', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Дата</th>
                                        <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.625rem', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Група / тип</th>
                                        <th style={{ padding: '0.375rem 0.5rem', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.625rem', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Учн.</th>
                                        <th style={{ padding: '0.375rem 0.625rem', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.625rem', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Сума</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sd.lessons.map((l, i) => {
                                        const d = new Date(l.lesson_date);
                                        const targetId = l.makeup_count > 0 && l.makeup_lesson_id ? l.makeup_lesson_id : l.lesson_id;
                                        return (
                                          <tr
                                            key={l.lesson_id}
                                            onClick={() => openLessonModal(targetId, `Заняття #${targetId}`, undefined)}
                                            style={{ borderBottom: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc', cursor: 'pointer' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                                            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafbfc')}
                                          >
                                            <td style={{ padding: '0.375rem 0.625rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                                              {d.getUTCDate()} {MONTHS_UK_GEN[d.getUTCMonth()]}
                                            </td>
                                            <td style={{ padding: '0.375rem 0.5rem' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                <span style={{ color: '#374151', fontSize: '0.8125rem' }}>{l.group_title || 'Без групи'}</span>
                                                {l.is_individual && <span style={{ background: '#f5f3ff', color: '#7c3aed', borderRadius: 6, padding: '0 0.3rem', fontSize: '0.5625rem', fontWeight: 700 }}>Інд.</span>}
                                                {l.is_replacement && <span style={{ background: '#fff7ed', color: '#c2410c', borderRadius: 6, padding: '0 0.3rem', fontSize: '0.5625rem', fontWeight: 700 }}>Заміна</span>}
                                                {l.makeup_count > 0 && <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, padding: '0 0.3rem', fontSize: '0.5625rem', fontWeight: 700 }}>Відпр.</span>}
                                              </div>
                                            </td>
                                            <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center', fontWeight: 600, color: '#16a34a', fontSize: '0.8125rem' }}>{l.present_count}</td>
                                            <td style={{ padding: '0.375rem 0.625rem', textAlign: 'right', fontWeight: 600, color: '#0f172a', fontSize: '0.8125rem' }}>{l.salary.toLocaleString()} ₴</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot>
                                      <tr style={{ background: '#f0fdf4', borderTop: '1.5px solid #bbf7d0' }}>
                                        <td colSpan={3} style={{ padding: '0.375rem 0.625rem', fontWeight: 700, color: '#14532d', fontSize: '0.75rem' }}>Разом</td>
                                        <td style={{ padding: '0.375rem 0.625rem', textAlign: 'right', fontWeight: 800, color: '#14532d', fontSize: '0.875rem' }}>{sd.lessons_total.toLocaleString()} ₴</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              ))}
                            </div>

                            {/* Extra items */}
                            <div>
                              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                                Додаткові нарахування
                              </div>
                              {sd.extra_items.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
                                  {sd.extra_items.map(item => (
                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.625rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                                      <span style={{ flex: 1, fontSize: '0.8125rem', color: '#374151' }}>{item.description}</span>
                                      <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{item.amount.toLocaleString()} ₴</span>
                                      <button
                                        onClick={() => deleteSalaryItem(teacher.id, item.id)}
                                        disabled={deletingItemMap[teacher.id] === item.id}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.125rem', opacity: deletingItemMap[teacher.id] === item.id ? 0.4 : 1, lineHeight: 1 }}
                                        title="Видалити"
                                      >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                                        </svg>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Add item form */}
                              <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  placeholder="Опис (майстер-клас...)"
                                  value={newItemDescMap[teacher.id] || ''}
                                  onChange={e => setNewItemDescMap(prev => ({ ...prev, [teacher.id]: e.target.value }))}
                                  style={{ flex: 1, padding: '0.375rem 0.5rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.8125rem', minWidth: 0 }}
                                />
                                <input
                                  type="number"
                                  placeholder="₴"
                                  value={newItemAmountMap[teacher.id] || ''}
                                  onChange={e => setNewItemAmountMap(prev => ({ ...prev, [teacher.id]: e.target.value }))}
                                  style={{ width: 70, padding: '0.375rem 0.5rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}
                                />
                                <button
                                  onClick={() => addSalaryItem(teacher.id)}
                                  disabled={addingItemMap[teacher.id] || !newItemDescMap[teacher.id]?.trim() || !newItemAmountMap[teacher.id]}
                                  style={{ padding: '0.375rem 0.625rem', borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', opacity: addingItemMap[teacher.id] ? 0.6 : 1, whiteSpace: 'nowrap' }}
                                >
                                  + Додати
                                </button>
                              </div>
                            </div>

                            {/* Receipt card */}
                            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: 14, padding: '1rem 1.125rem', color: 'white' }}>
                              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
                                {MONTHS_UK[sd.month - 1]} {sd.year}
                              </div>
                              <div style={{ fontSize: '0.6875rem', color: '#64748b', marginBottom: '0.75rem' }}>
                                Ставки: {sd.salary_group_rate} ₴ груп. / {sd.salary_individual_rate} ₴ інд.
                              </div>
                              <div style={{ borderTop: '1px dashed #334155', borderBottom: '1px dashed #334155', padding: '0.625rem 0', marginBottom: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                                  <span style={{ color: '#94a3b8' }}>Заняття ({sd.lessons.length} шт.)</span>
                                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{sd.lessons_total.toLocaleString()} ₴</span>
                                </div>
                                {sd.extra_items.map(item => (
                                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                                    <span style={{ color: '#94a3b8' }}>{item.description}</span>
                                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>+{item.amount.toLocaleString()} ₴</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>РАЗОМ</span>
                                <span style={{ fontSize: '1.375rem', fontWeight: 800, color: '#4ade80' }}>{sd.grand_total.toLocaleString()} ₴</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ color: '#6b7280' }}>Помилка завантаження даних</div>
              </div>
            )}
          </DraggableModal>
        );
      })}
    </>
  );
}
