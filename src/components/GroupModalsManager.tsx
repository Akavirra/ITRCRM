'use client';

import { useState, useEffect } from 'react';
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
  const { openModals, updateModalState, closeGroupModal } = useGroupModals();
  const { openStudentModal } = useStudentModals();
  const [groupData, setGroupData] = useState<Record<number, { group: GroupData; students: GroupStudent[] }>>({});
  const [loadingGroups, setLoadingGroups] = useState<Record<number, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Record<number, AvailableStudent[]>>({});
  const [showAddStudentModal, setShowAddStudentModal] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
    try {
      const params = new URLSearchParams({ withGroupCount: 'true' });
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
    try {
      const res = await fetch(`/api/groups/${groupId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });
      
      if (res.ok) {
        const response = await fetch(`/api/groups/${groupId}?withStudents=true`);
        if (response.ok) {
          const data = await response.json();
          setGroupData(prev => ({ ...prev, [groupId]: data }));
          // Remove added student from available list
          setAvailableStudents(prev => ({
            ...prev,
            [groupId]: (prev[groupId] || []).filter(s => s.id !== studentId)
          }));
        }
      }
    } catch (error) {
      console.error('Error adding student:', error);
    }
  };

  const openAddStudentModal = async (groupId: number) => {
    setShowAddStudentModal(groupId);
    setSearchQuery('');
    await loadAvailableStudents(groupId);
  };

  const handleSearchChange = async (groupId: number, query: string) => {
    setSearchQuery(query);
    await loadAvailableStudents(groupId, query);
  };

  if (!isHydrated || openModals.length === 0) return null;

  return (
    <>
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
                  <button onClick={() => openAddStudentModal(modal.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
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
                      {availableStudents[modal.id]?.length === 0 ? (
                        <p style={{ color: '#0369a1', textAlign: 'center', fontSize: '0.875rem', margin: '0.5rem 0' }}>Немає доступних учнів</p>
                      ) : (
                        availableStudents[modal.id]?.map((student) => (
                          <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: 'white', borderRadius: '0.375rem', border: '1px solid #bfdbfe' }}>
                            <div>
                              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' }}>{student.full_name}</span>
                              <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>#{student.public_id}</span>
                            </div>
                            <button onClick={() => handleAddStudent(modal.id, student.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                              Додати
                            </button>
                          </div>
                        ))
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
