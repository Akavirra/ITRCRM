'use client';

import { useState, useEffect } from 'react';
import DraggableModal from './DraggableModal';
import { useStudentModals } from './StudentModalsContext';
import { useGroupModals } from './GroupModalsContext';

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
  discount: string | null;
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
  const { openModals, updateModalState, closeStudentModal } = useStudentModals();
  const { openGroupModal } = useGroupModals();
  const [studentData, setStudentData] = useState<Record<number, StudentWithGroups>>({});
  const [loadingStudents, setLoadingStudents] = useState<Record<number, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Notes editing state
  const [editingNotes, setEditingNotes] = useState<Record<number, boolean>>({});
  const [editedNotes, setEditedNotes] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({});
  
  // Copy state
  const [copiedField, setCopiedField] = useState<{ studentId: number; field: string } | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
