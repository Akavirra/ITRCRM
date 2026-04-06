'use client';

import { useState, useEffect } from 'react';
import DraggableModal from './DraggableModal';
import { useStudentModals } from './StudentModalsContext';
import { useGroupModals } from './GroupModalsContext';
import { useLessonModals } from './LessonModalsContext';

const MONTHS_UK = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const MONTHS_UK_GEN = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];

function getDefaultMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

type AttendanceStatus = 'present' | 'absent' | 'makeup_planned' | 'makeup_done';

interface StudentAttendanceLesson {
  lesson_id: number;
  lesson_date: string;
  lesson_status: string;
  attendance_status: AttendanceStatus | null;
  is_makeup: boolean;
  group_title: string | null;
  topic: string | null;
  lesson_teacher_name: string | null;
}

interface StudentAttendanceGroup {
  group_id: number | null;
  group_title: string | null;
  course_title: string | null;
  lessons: StudentAttendanceLesson[];
  total: number;
  present: number;
  absent: number;
  not_marked: number;
  makeup: number;
  rate: number;
  is_individual: boolean;
  is_makeup_group: boolean;
}

interface StudentAttendanceData {
  year: number;
  month: number;
  groups: StudentAttendanceGroup[];
}

interface StudentData {
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  notes: string | null;
  birth_date: string | null;
  photo: string | null;
  school: string | null;
  discount: number | null;
  parent_relation: string | null;
  parent2_name: string | null;
  parent2_relation: string | null;
  interested_courses: string | null;
  source: string | null;
  is_active: boolean;
  study_status: 'studying' | 'not_studying';
  created_at: string;
  updated_at: string;
}

interface StudentWithGroups extends StudentData {
  groups: Array<{
    id: number;
    title: string;
    course_title: string;
    join_date: string;
  }>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
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

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age >= 0 ? age : null;
}

const RELATION_OPTIONS = [
  { value: 'mother', label: 'Мама' },
  { value: 'father', label: 'Тато' },
  { value: 'grandmother', label: 'Бабуся' },
  { value: 'grandfather', label: 'Дідусь' },
  { value: 'other', label: 'Інше' },
];

function getRelationLabel(relation: string | null): string {
  if (!relation) return '';
  const option = RELATION_OPTIONS.find(opt => opt.value === relation);
  return option ? option.label : relation;
}

function getStatusBadge(status: 'studying' | 'not_studying') {
  const isStudying = status === 'studying';
  return (
    <span className={isStudying ? 'badge badge-success' : 'badge badge-gray'}>
      {isStudying ? 'Навчається' : 'Не навчається'}
    </span>
  );
}

export default function StudentModalsManager() {
  const { openModals, updateModalState, closeStudentModal, openStudentModal } = useStudentModals();
  const { openGroupModal } = useGroupModals();
  const { openLessonModal } = useLessonModals();
  const [studentData, setStudentData] = useState<Record<number, StudentWithGroups>>({});
  const [loadingStudents, setLoadingStudents] = useState<Record<number, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  // Notes editing state
  const [editingNotes, setEditingNotes] = useState<Record<number, boolean>>({});
  const [editedNotes, setEditedNotes] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({});

  // Copy state
  const [copiedField, setCopiedField] = useState<{ studentId: number; field: string } | null>(null);

  // Payments section state (per student)
  const [paymentsSectionOpen, setPaymentsSectionOpen] = useState<Record<number, boolean>>({});
  const [paymentsData, setPaymentsData] = useState<Record<number, {
    groups: Array<{
      group_id: number;
      group_title: string;
      lessons_count: number;
      effective_price: number;
      expected_amount: number;
      total_paid: number;
      debt: number;
    }>;
    individual: {
      lessons_paid: number;
      lessons_used: number;
      lessons_remaining: number;
    } | null;
  }>>({});
  const [paymentsLoading, setPaymentsLoading] = useState<Record<number, boolean>>({});
  const [paymentsMonth, setPaymentsMonth] = useState<Record<number, string>>({});

  // Stats section state (per student)
  const [statsSectionOpen, setStatsSectionOpen] = useState<Record<number, boolean>>({});
  const [statsMonthMap, setStatsMonthMap] = useState<Record<number, string>>({});
  const [statsDataMap, setStatsDataMap] = useState<Record<number, StudentAttendanceData>>({});
  const [statsLoadingMap, setStatsLoadingMap] = useState<Record<number, boolean>>({});
  const [lessonsListOpen, setLessonsListOpen] = useState<Record<number, boolean>>({});
  const [statsTypeFilter, setStatsTypeFilter] = useState<Record<number, 'all' | 'group' | 'individual' | 'makeup'>>({});

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Listen for open-student events dispatched from search or elsewhere
  useEffect(() => {
    const handler = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: number }>).detail;
      if (id) openStudentModal(id, `Картка учня`);
    };
    window.addEventListener('itrobot-open-student', handler);
    return () => window.removeEventListener('itrobot-open-student', handler);
  }, [openStudentModal]);

  const loadStudentData = async (studentId: number) => {
    if (studentData[studentId] || loadingStudents[studentId]) return;
    
    setLoadingStudents(prev => ({ ...prev, [studentId]: true }));
    
    try {
      const response = await fetch(`/api/students/${studentId}?withGroups=true`);
      if (response.ok) {
        const data = await response.json();
        setStudentData(prev => ({ ...prev, [studentId]: data.student }));
      }
    } catch (error) {
      console.error('Error loading student:', error);
    } finally {
      setLoadingStudents(prev => ({ ...prev, [studentId]: false }));
    }
  };

  useEffect(() => {
    openModals.forEach(modal => {
      if (modal.isOpen && !studentData[modal.id]) {
        loadStudentData(modal.id);
      }
      // Auto-load stats for newly opened modals (section is open by default)
      if (modal.isOpen && !statsDataMap[modal.id] && !statsLoadingMap[modal.id]) {
        const month = statsMonthMap[modal.id] || getDefaultMonth();
        setStatsMonthMap(prev => ({ ...prev, [modal.id]: prev[modal.id] || month }));
        fetchStudentStats(modal.id, month);
      }
    });
  }, [openModals]);

  const handleClose = (studentId: number) => {
    closeStudentModal(studentId);
  };

  const handleUpdatePosition = (studentId: number, position: { x: number; y: number }) => {
    updateModalState(studentId, { position });
  };

  const handleUpdateSize = (studentId: number, size: { width: number; height: number }) => {
    updateModalState(studentId, { size });
  };

  // ── Payments helpers ───────────────────────────────────────────────────────

  const loadStudentPayments = async (studentId: number, month?: string) => {
    const m = month || paymentsMonth[studentId] || new Date().toISOString().substring(0, 7) + '-01';
    setPaymentsLoading(prev => ({ ...prev, [studentId]: true }));
    try {
      // Get student's groups to fetch payment status per group
      const student = studentData[studentId];
      const groupPayments: Array<{
        group_id: number; group_title: string;
        lessons_count: number; effective_price: number;
        expected_amount: number; total_paid: number; debt: number;
      }> = [];

      if (student?.groups) {
        for (const g of student.groups) {
          const res = await fetch(`/api/groups/${g.id}/payments?month=${m}`);
          if (res.ok) {
            const json = await res.json();
            const ps = (json.paymentStatus || []).find((p: { student_id: number }) => p.student_id === studentId);
            if (ps) {
              groupPayments.push({
                group_id: g.id,
                group_title: g.title,
                lessons_count: ps.lessons_count,
                effective_price: ps.effective_price,
                expected_amount: ps.expected_amount,
                total_paid: ps.total_paid,
                debt: ps.debt,
              });
            }
          }
        }
      }

      // Individual balance
      let individual = null;
      try {
        const indRes = await fetch(`/api/students/${studentId}/individual-payments`);
        if (indRes.ok) {
          const indJson = await indRes.json();
          if (indJson.balance) {
            individual = indJson.balance;
          }
        }
      } catch { /* ignore */ }

      setPaymentsData(prev => ({ ...prev, [studentId]: { groups: groupPayments, individual } }));
    } catch {
      console.error('Error loading student payments');
    } finally {
      setPaymentsLoading(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const togglePaymentsSection = (studentId: number) => {
    const isOpen = paymentsSectionOpen[studentId] || false;
    setPaymentsSectionOpen(prev => ({ ...prev, [studentId]: !isOpen }));
    if (!isOpen && !paymentsData[studentId] && !paymentsLoading[studentId]) {
      const m = new Date().toISOString().substring(0, 7) + '-01';
      setPaymentsMonth(prev => ({ ...prev, [studentId]: m }));
      loadStudentPayments(studentId, m);
    }
  };

  const handlePaymentsMonthChange = (studentId: number, month: string) => {
    setPaymentsMonth(prev => ({ ...prev, [studentId]: month }));
    loadStudentPayments(studentId, month);
  };

  // ── Stats helpers ─────────────────────────────────────────────────────────

  const fetchStudentStats = async (studentId: number, month: string) => {
    const [year, mon] = month.split('-');
    setStatsLoadingMap(prev => ({ ...prev, [studentId]: true }));
    setStatsDataMap(prev => { const n = { ...prev }; delete n[studentId]; return n; });
    setLessonsListOpen(prev => ({ ...prev, [studentId]: false }));
    try {
      const res = await fetch(`/api/students/${studentId}/attendance?view=monthly&year=${year}&month=${parseInt(mon, 10)}`);
      if (res.ok) {
        const data = await res.json();
        setStatsDataMap(prev => ({ ...prev, [studentId]: data }));
      }
    } catch { /* silent */ } finally {
      setStatsLoadingMap(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const toggleStatsSection = (studentId: number) => {
    // undefined = open by default, so treat undefined as open
    const currentlyOpen = statsSectionOpen[studentId] !== false;
    setStatsSectionOpen(prev => ({ ...prev, [studentId]: !currentlyOpen }));
    if (!currentlyOpen && !statsDataMap[studentId] && !statsLoadingMap[studentId]) {
      const month = statsMonthMap[studentId] || getDefaultMonth();
      setStatsMonthMap(prev => ({ ...prev, [studentId]: prev[studentId] || month }));
      fetchStudentStats(studentId, month);
    }
  };

  if (!isHydrated || openModals.length === 0) return null;

  return (
    <>
      {openModals.map((modal) => {
        if (!modal.isOpen) return null;
        const student = studentData[modal.id];
        const isLoading = loadingStudents[modal.id];

        return (
          <DraggableModal
            key={modal.id}
            id={`student-modal-${modal.id}`}
            isOpen={true}
            onClose={() => handleClose(modal.id)}
            title={modal.title}
            groupUrl={`/students/${modal.id}`}
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
            ) : student ? (
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
                    {student.photo ? (
                      <img src={student.photo} alt={student.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.5rem', fontWeight: 600, color: '#2563eb' }}>
                        {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    )}
                  </div>
                  
                  {/* Name and status */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1f2937' }}>
                        {student.full_name}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {getStatusBadge(student.study_status)}
                      <span style={{ fontSize: '0.8125rem', color: '#6b7280', fontFamily: 'monospace' }}>
                        #{student.public_id}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.375rem', fontSize: '0.75rem', color: '#6b7280' }}>
                      {calculateAge(student.birth_date) !== null && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          {calculateAge(student.birth_date)} років
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Створено: {formatDateTime(student.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Контакти</span>
                  
                  {/* Основний контакт */}
                  {(student.parent_name || student.parent_phone) && (
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
                        backgroundColor: copiedField?.field === 'phone-main' && copiedField?.studentId === student.id ? '#86efac' : '#bbf7d0', 
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}>
                        {copiedField?.field === 'phone-main' && copiedField?.studentId === student.id ? (
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
                        <span style={{ fontSize: '0.6875rem', color: '#16a34a', fontWeight: '600' }}>Основний</span>
                        <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.125rem' }}>
                          {student.parent_name} {student.parent_relation && <span style={{ color: '#15803d' }}>({getRelationLabel(student.parent_relation)})</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <a
                          href={`tel:${student.parent_phone}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(student.parent_phone || '');
                            setCopiedField({ studentId: student.id, field: 'phone-main' });
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          style={{
                            color: copiedField?.field === 'phone-main' && copiedField?.studentId === student.id ? '#16a34a' : '#166534',
                            textDecoration: 'none',
                            fontSize: '0.8125rem',
                            fontWeight: '600',
                            transition: 'color 0.15s',
                          }}
                          title="Клікніть щоб скопіювати"
                        >
                          {formatPhone(student.parent_phone)}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {/* Додатковий контакт */}
                  {(student.parent2_name || student.phone) && (
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
                        backgroundColor: copiedField?.field === 'phone-parent' && copiedField?.studentId === student.id ? '#93c5fd' : '#bfdbfe', 
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}>
                        {copiedField?.field === 'phone-parent' && copiedField?.studentId === student.id ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.6875rem', color: '#2563eb', fontWeight: '600' }}>Додатковий</span>
                        <div style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '0.125rem' }}>
                          {student.parent2_name || 'Батьки'} {student.parent2_relation && <span style={{ color: '#1d4ed8' }}>({getRelationLabel(student.parent2_relation)})</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <a
                          href={`tel:${student.phone}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(student.phone || '');
                            setCopiedField({ studentId: student.id, field: 'phone-parent' });
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          style={{
                            color: copiedField?.field === 'phone-parent' && copiedField?.studentId === student.id ? '#2563eb' : '#1e40af',
                            textDecoration: 'none',
                            fontSize: '0.8125rem',
                            fontWeight: '600',
                            transition: 'color 0.15s',
                          }}
                          title="Клікніть щоб скопіювати"
                        >
                          {formatPhone(student.phone)}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {/* Email */}
                  {student.email && (
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
                        backgroundColor: copiedField?.field === 'email' && copiedField?.studentId === student.id ? '#f9a8d4' : '#fbcfe8', 
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}>
                        {copiedField?.field === 'email' && copiedField?.studentId === student.id ? (
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
                          href={`mailto:${student.email}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(student.email || '');
                            setCopiedField({ studentId: student.id, field: 'email' });
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          style={{
                            color: copiedField?.field === 'email' && copiedField?.studentId === student.id ? '#db2777' : '#831843',
                            textDecoration: 'none',
                            fontSize: '0.8125rem',
                            fontWeight: '600',
                            transition: 'color 0.15s',
                          }}
                          title="Клікніть щоб скопіювати"
                        >
                          {student.email}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {!student.parent_phone && !student.phone && !student.email && !student.parent2_name && (
                    <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>Контакти відсутні</span>
                  )}
                </div>

                {/* Groups */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Групи</span>
                  
                  {student.groups && student.groups.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {student.groups.map((group) => (
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
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Не бере участі в групах</span>
                    </div>
                  )}
                </div>

                {/* Additional Info */}
                {student.school && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Додатково</span>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                      {student.school && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                          </svg>
                          <span style={{ fontSize: '0.875rem', color: '#475569' }}>{student.school}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Нотатки</span>
                    {!editingNotes[student.id] && (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          onClick={() => {
                            setEditedNotes(prev => ({ ...prev, [student.id]: student.notes || '' }));
                            setEditingNotes(prev => ({ ...prev, [student.id]: true }));
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            border: 'none',
                            borderRadius: '0.375rem',
                            backgroundColor: '#f3f4f6',
                            color: '#6b7280',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e5e7eb';
                            e.currentTarget.style.color = '#374151';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.color = '#6b7280';
                          }}
                          title="Редагувати нотатки"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        {student.notes && (
                          <button
                            onClick={async () => {
                              setSavingNotes(prev => ({ ...prev, [student.id]: true }));
                              try {
                                const response = await fetch(`/api/students/${student.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ notes: '' }),
                                });
                                
                                if (response.ok) {
                                  setStudentData(prev => ({
                                    ...prev,
                                    [student.id]: { ...prev[student.id], notes: null }
                                  }));
                                }
                              } catch (error) {
                                console.error('Failed to clear notes:', error);
                              } finally {
                                setSavingNotes(prev => ({ ...prev, [student.id]: false }));
                              }
                            }}
                            disabled={savingNotes[student.id]}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              border: 'none',
                              borderRadius: '0.375rem',
                              backgroundColor: '#fef2f2',
                              color: '#ef4444',
                              cursor: savingNotes[student.id] ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              opacity: savingNotes[student.id] ? 0.5 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (!savingNotes[student.id]) {
                                e.currentTarget.style.backgroundColor = '#fee2e2';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#fef2f2';
                            }}
                            title="Очистити нотатки"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {editingNotes[student.id] ? (
                    <div>
                      <textarea
                        value={editedNotes[student.id] || ''}
                        onChange={(e) => setEditedNotes(prev => ({ ...prev, [student.id]: e.target.value }))}
                        placeholder="Додайте нотатки про учня..."
                        style={{
                          width: '100%',
                          minHeight: '100px',
                          padding: '0.75rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          lineHeight: '1.5',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          onClick={async () => {
                            setSavingNotes(prev => ({ ...prev, [student.id]: true }));
                            try {
                              const response = await fetch(`/api/students/${student.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ notes: editedNotes[student.id] || '' }),
                              });
                              
                              if (response.ok) {
                                setStudentData(prev => ({
                                  ...prev,
                                  [student.id]: { ...prev[student.id], notes: editedNotes[student.id] || null }
                                }));
                                setEditingNotes(prev => ({ ...prev, [student.id]: false }));
                              }
                            } catch (error) {
                              console.error('Failed to save notes:', error);
                            } finally {
                              setSavingNotes(prev => ({ ...prev, [student.id]: false }));
                            }
                          }}
                          disabled={savingNotes[student.id]}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '0.375rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            fontSize: '0.8125rem',
                            fontWeight: '500',
                            cursor: savingNotes[student.id] ? 'not-allowed' : 'pointer',
                            opacity: savingNotes[student.id] ? 0.7 : 1
                          }}
                        >
                          {savingNotes[student.id] ? 'Збереження...' : 'Зберегти'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingNotes(prev => ({ ...prev, [student.id]: false }));
                            setEditedNotes(prev => ({ ...prev, [student.id]: '' }));
                          }}
                          disabled={savingNotes[student.id]}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.5rem 1rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.375rem',
                            backgroundColor: 'white',
                            color: '#6b7280',
                            fontSize: '0.8125rem',
                            fontWeight: '500',
                            cursor: savingNotes[student.id] ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Скасувати
                        </button>
                      </div>
                    </div>
                  ) : (
                    student.notes ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.5, padding: '0.75rem', backgroundColor: '#fefce8', borderRadius: '0.5rem', border: '1px solid #fef08a', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{student.notes}</p>
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px dashed #d1d5db' }}>Нотаток немає</p>
                    )
                  )}
                </div>
                {/* ── Payments section ─────────────────────────────────────── */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  <button
                    onClick={() => togglePaymentsSection(student.id)}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem 0', gap: '0.5rem' }}
                  >
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, textAlign: 'left' }}>
                      Оплати
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{paymentsSectionOpen[student.id] ? '▲ Згорнути' : '▼ Розгорнути'}</span>
                  </button>

                  {paymentsSectionOpen[student.id] && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {/* Month picker */}
                      <select
                        value={paymentsMonth[student.id] || new Date().toISOString().substring(0, 7) + '-01'}
                        onChange={(e) => handlePaymentsMonthChange(student.id, e.target.value)}
                        style={{ width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                      >
                        {(() => {
                          const opts: { value: string; label: string }[] = [];
                          const now = new Date();
                          for (let i = -6; i <= 1; i++) {
                            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
                            const label = `${MONTHS_UK[d.getMonth()]} ${d.getFullYear()}`;
                            opts.push({ value, label });
                          }
                          return opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>);
                        })()}
                      </select>

                      {paymentsLoading[student.id] ? (
                        <div style={{ textAlign: 'center', color: '#6b7280', padding: '0.5rem', fontSize: '0.8125rem' }}>Завантаження...</div>
                      ) : paymentsData[student.id] ? (
                        <>
                          {/* Group payments */}
                          {paymentsData[student.id].groups.length > 0 ? (
                            paymentsData[student.id].groups.map(gp => (
                              <div key={gp.group_id} style={{
                                padding: '0.625rem',
                                borderRadius: '0.375rem',
                                backgroundColor: gp.debt > 0 ? '#fef2f2' : '#ecfdf5',
                                border: `1px solid ${gp.debt > 0 ? '#fecaca' : '#a7f3d0'}`,
                              }}>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                                  <button
                                    onClick={() => openGroupModal(gp.group_id, gp.group_title)}
                                    style={{ background: 'none', border: 'none', padding: 0, color: '#3b82f6', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, textDecoration: 'underline' }}
                                  >
                                    {gp.group_title}
                                  </button>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#6b7280' }}>
                                  <span>{gp.lessons_count} зан. × {gp.effective_price} ₴</span>
                                  <span>= {gp.expected_amount} ₴</span>
                                  <span>Опл: <b style={{ color: '#22c55e' }}>{gp.total_paid} ₴</b></span>
                                  {gp.debt > 0 ? (
                                    <span style={{ color: '#ef4444', fontWeight: 600 }}>Борг: {gp.debt} ₴</span>
                                  ) : (
                                    <span style={{ color: '#22c55e', fontWeight: 600 }}>Оплачено</span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center', padding: '0.25rem' }}>
                              Немає групових оплат за цей місяць
                            </div>
                          )}

                          {/* Individual balance */}
                          {paymentsData[student.id].individual && (
                            <div style={{
                              padding: '0.625rem',
                              borderRadius: '0.375rem',
                              backgroundColor: '#f0f9ff',
                              border: '1px solid #bae6fd',
                            }}>
                              <div style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem', color: '#0369a1' }}>
                                Індивідуальні заняття
                              </div>
                              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
                                <span>Оплачено: <b>{paymentsData[student.id].individual!.lessons_paid}</b></span>
                                <span>Використано: <b>{paymentsData[student.id].individual!.lessons_used}</b></span>
                                <span style={{
                                  fontWeight: 600,
                                  color: paymentsData[student.id].individual!.lessons_remaining < 0 ? '#ef4444' : '#22c55e',
                                }}>
                                  Залишок: {paymentsData[student.id].individual!.lessons_remaining}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* ── Stats section ──────────────────────────────────────────── */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  <button
                    onClick={() => toggleStatsSection(student.id)}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem 0', gap: '0.5rem' }}
                  >
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, textAlign: 'left' }}>
                      Статистика відвідуваності
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{statsSectionOpen[student.id] !== false ? '▲ Згорнути' : '▼ Розгорнути'}</span>
                  </button>

                  {statsSectionOpen[student.id] !== false && (
                    <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      {/* Month picker */}
                      <input
                        type="month"
                        value={statsMonthMap[student.id] || getDefaultMonth()}
                        onChange={e => {
                          setStatsMonthMap(prev => ({ ...prev, [student.id]: e.target.value }));
                          fetchStudentStats(student.id, e.target.value);
                        }}
                        style={{ padding: '0.375rem 0.625rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.8125rem', color: '#374151', background: '#f8fafc', cursor: 'pointer', width: 'fit-content' }}
                      />

                      {statsLoadingMap[student.id] ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>Завантаження...</div>
                      ) : (() => {
                        const sd = statsDataMap[student.id];
                        if (!sd) return null;

                        // Filter out future (non-done) lessons
                        const doneGroups: StudentAttendanceGroup[] = sd.groups.map(g => ({
                          ...g,
                          lessons: g.lessons.filter(l => l.lesson_status === 'done'),
                        })).filter(g => g.lessons.length > 0);

                        const typeFilter = statsTypeFilter[student.id] || 'all';

                        const visibleGroups = doneGroups.filter(g => {
                          if (typeFilter === 'group') return !g.is_individual && !g.is_makeup_group;
                          if (typeFilter === 'individual') return g.is_individual;
                          if (typeFilter === 'makeup') return g.is_makeup_group;
                          return true;
                        });

                        const allDoneLessons = doneGroups.flatMap(g => g.lessons);
                        const totalPresent = doneGroups.reduce((s, g) => s + g.present, 0);
                        const totalAbsent = doneGroups.reduce((s, g) => s + g.absent, 0);
                        const totalMakeup = doneGroups.reduce((s, g) => s + g.makeup, 0);
                        const totalLessons = doneGroups.reduce((s, g) => s + g.total, 0);
                        const rate = totalLessons > 0 ? Math.round((totalPresent + totalMakeup) / totalLessons * 100) : 0;

                        const isExpanded = !!lessonsListOpen[student.id];

                        const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                          present: { label: 'Присутній', color: '#16a34a', bg: '#f0fdf4' },
                          absent: { label: 'Відсутній', color: '#dc2626', bg: '#fef2f2' },
                          makeup_planned: { label: 'Заплановано', color: '#d97706', bg: '#fffbeb' },
                          makeup_done: { label: 'Відпрацював', color: '#2563eb', bg: '#eff6ff' },
                        };

                        return (
                          <>
                            {/* Summary pills */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                              {[
                                { label: 'Занять', value: totalLessons, color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
                                { label: 'Присутній', value: totalPresent, color: '#065f46', bg: '#f0fdf4', border: '#bbf7d0' },
                                { label: 'Відсутній', value: totalAbsent, color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
                                { label: 'Відпрац.', value: totalMakeup, color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
                                { label: '%', value: `${rate}%`, color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
                              ].map(p => (
                                <div key={p.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.375rem 0.625rem', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, minWidth: 52 }}>
                                  <span style={{ fontSize: '1rem', fontWeight: 700, color: p.color, lineHeight: 1.1 }}>{p.value}</span>
                                  <span style={{ fontSize: '0.625rem', color: p.color, opacity: 0.75, fontWeight: 600, marginTop: 1 }}>{p.label}</span>
                                </div>
                              ))}
                            </div>

                            {/* Lessons list (collapsible) */}
                            {allDoneLessons.length > 0 && (
                              <div>
                                {/* Toggle header */}
                                <button
                                  onClick={() => setLessonsListOpen(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: isExpanded ? '0.625rem' : 0, width: '100%', textAlign: 'left' }}
                                >
                                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Заняття ({allDoneLessons.length})
                                  </span>
                                  <span style={{ fontSize: '0.6875rem', color: '#94a3b8', marginLeft: 'auto' }}>{isExpanded ? '▲ Згорнути' : '▼ Розгорнути'}</span>
                                </button>

                                {isExpanded && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {/* Type filter tabs */}
                                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                      {([
                                        { key: 'all', label: 'Всі' },
                                        { key: 'group', label: 'Групові' },
                                        { key: 'individual', label: 'Індивід.' },
                                        { key: 'makeup', label: 'Відпрацювання' },
                                      ] as const).map(tab => {
                                        const isActive = typeFilter === tab.key;
                                        return (
                                          <button
                                            key={tab.key}
                                            onClick={() => setStatsTypeFilter(prev => ({ ...prev, [student.id]: tab.key }))}
                                            style={{ padding: '0.25rem 0.625rem', borderRadius: 8, border: `1px solid ${isActive ? '#3b82f6' : '#e2e8f0'}`, background: isActive ? '#eff6ff' : 'white', color: isActive ? '#1d4ed8' : '#64748b', fontSize: '0.75rem', fontWeight: isActive ? 700 : 500, cursor: 'pointer' }}
                                          >
                                            {tab.label}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {/* Groups */}
                                    {visibleGroups.length === 0 ? (
                                      <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 8, color: '#94a3b8', fontSize: '0.8125rem', textAlign: 'center' }}>Немає занять цього типу</div>
                                    ) : visibleGroups.map((group, gi) => (
                                      <div key={group.group_id ?? `group-${gi}`}>
                                        {/* Group header */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem', background: '#f8fafc', borderRadius: 6, marginBottom: '0.25rem' }}>
                                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', flex: 1 }}>
                                            {group.is_individual ? 'Індивідуальні' : group.is_makeup_group ? 'Відпрацювання' : (group.group_title || 'Без групи')}
                                          </span>
                                          {group.course_title && !group.is_individual && !group.is_makeup_group && (
                                            <span style={{ fontSize: '0.625rem', color: '#94a3b8' }}>{group.course_title}</span>
                                          )}
                                          <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#16a34a' }}>{group.present + group.makeup}/{group.lessons.length}</span>
                                        </div>
                                        {/* Lesson rows */}
                                        <div style={{ borderRadius: 8, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                                          {group.lessons.map((lesson, li) => {
                                            const d = new Date(lesson.lesson_date);
                                            const statusInfo = (lesson.attendance_status && statusMap[lesson.attendance_status]) || { label: 'Не відмічений', color: '#94a3b8', bg: '#f9fafb' };
                                            return (
                                              <div
                                                key={lesson.lesson_id}
                                                onClick={() => openLessonModal(lesson.lesson_id, `Заняття #${lesson.lesson_id}`, undefined)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.625rem', borderBottom: li < group.lessons.length - 1 ? '1px solid #f8fafc' : 'none', background: li % 2 === 0 ? 'white' : '#fafbfc', cursor: 'pointer' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                                                onMouseLeave={e => (e.currentTarget.style.background = li % 2 === 0 ? 'white' : '#fafbfc')}
                                              >
                                                <span style={{ fontSize: '0.8125rem', color: '#374151', whiteSpace: 'nowrap', minWidth: 60 }}>
                                                  {d.getUTCDate()} {MONTHS_UK_GEN[d.getUTCMonth()]}
                                                </span>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                  {lesson.is_makeup && (
                                                    <span style={{ background: '#f5f3ff', color: '#7c3aed', borderRadius: 6, padding: '0 0.3rem', fontSize: '0.5625rem', fontWeight: 700 }}>Відпрац.</span>
                                                  )}
                                                  {lesson.topic && (
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }} title={lesson.topic}>
                                                      {lesson.topic.length > 20 ? lesson.topic.slice(0, 20) + '…' : lesson.topic}
                                                    </span>
                                                  )}
                                                </div>
                                                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: statusInfo.color, background: statusInfo.bg, borderRadius: 6, padding: '0.1rem 0.375rem', whiteSpace: 'nowrap' }}>
                                                  {statusInfo.label}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {allDoneLessons.length === 0 && (
                              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 8, color: '#94a3b8', fontSize: '0.8125rem', textAlign: 'center' }}>Немає проведених занять за цей місяць</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

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
