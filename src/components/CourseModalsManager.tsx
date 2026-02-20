'use client';

import { useState, useEffect } from 'react';
import DraggableModal from './DraggableModal';
import { useCourseModals } from './CourseModalsContext';
import { useGroupModals } from './GroupModalsContext';
import { useStudentModals } from './StudentModalsContext';

interface CourseData {
  id: number;
  public_id: string;
  title: string;
  description: string | null;
  age_min: number;
  duration_months: number;
  program: string | null;
  flyer_path: string | null;
  is_active: number;
}

interface CourseGroup {
  id: number;
  public_id: string | null;
  title: string;
  weekly_day: number;
  start_time: string;
  teacher_id: number;
  status: string;
  teacher_name: string | null;
}

interface CourseStudent {
  id: number;
  public_id: string | null;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  groups: Array<{
    id: number;
    title: string;
    status: string;
  }>;
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

export default function CourseModalsManager() {
  const { openModals, updateModalState, closeCourseModal } = useCourseModals();
  const { openGroupModal } = useGroupModals();
  const { openStudentModal } = useStudentModals();
  const [courseData, setCourseData] = useState<Record<number, { course: CourseData; groups: CourseGroup[]; students: CourseStudent[] }>>({});
  const [loadingCourses, setLoadingCourses] = useState<Record<number, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [editingDescription, setEditingDescription] = useState<number | null>(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const loadCourseData = async (courseId: number) => {
    if (courseData[courseId] || loadingCourses[courseId]) return;
    
    setLoadingCourses(prev => ({ ...prev, [courseId]: true }));
    
    try {
      // Fetch course details
      const courseResponse = await fetch(`/api/courses/${courseId}`);
      if (courseResponse.ok) {
        const courseResult = await courseResponse.json();
        
        // Fetch groups for this course
        const groupsResponse = await fetch(`/api/courses/${courseId}/groups`);
        const groupsResult = await groupsResponse.json();
        
        // Fetch students for this course
        const studentsResponse = await fetch(`/api/courses/${courseId}/students`);
        const studentsResult = await studentsResponse.json();
        
        setCourseData(prev => ({ 
          ...prev, 
          [courseId]: { 
            course: courseResult.course, 
            groups: groupsResult.groups || [],
            students: studentsResult.students || []
          } 
        }));
      }
    } catch (error) {
      console.error('Error loading course:', error);
    } finally {
      setLoadingCourses(prev => ({ ...prev, [courseId]: false }));
    }
  };

  useEffect(() => {
    openModals.forEach(modal => {
      if (modal.isOpen && !courseData[modal.id]) {
        loadCourseData(modal.id);
      }
    });
  }, [openModals]);

  const handleClose = (courseId: number) => {
    setEditingDescription(null);
    closeCourseModal(courseId);
  };

  const handleUpdatePosition = (courseId: number, position: { x: number; y: number }) => {
    updateModalState(courseId, { position });
  };

  const handleUpdateSize = (courseId: number, size: { width: number; height: number }) => {
    updateModalState(courseId, { size });
  };

  const handleGroupClick = (groupId: number, groupTitle: string) => {
    openGroupModal(groupId, groupTitle);
  };

  const handleStudentClick = (studentId: number, studentName: string) => {
    openStudentModal(studentId, studentName);
  };

  const startEditDescription = (courseId: number, currentDescription: string) => {
    setEditingDescription(courseId);
    setDescriptionValue(currentDescription || '');
  };

  const saveDescription = async (courseId: number) => {
    setSavingDescription(true);
    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descriptionValue }),
      });
      
      if (response.ok) {
        setCourseData(prev => ({
          ...prev,
          [courseId]: {
            ...prev[courseId],
            course: {
              ...prev[courseId].course,
              description: descriptionValue
            }
          }
        }));
        setEditingDescription(null);
      }
    } catch (error) {
      console.error('Error saving description:', error);
    } finally {
      setSavingDescription(false);
    }
  };

  const cancelEditDescription = () => {
    setEditingDescription(null);
    setDescriptionValue('');
  };

  if (!isHydrated || openModals.length === 0) return null;

  return (
    <>
      {openModals.map((modal) => {
        if (!modal.isOpen) return null;
        const data = courseData[modal.id];
        const isLoading = loadingCourses[modal.id];
        const course = data?.course;

        return (
          <DraggableModal
            key={modal.id}
            id={`course-modal-${modal.id}`}
            isOpen={true}
            onClose={() => handleClose(modal.id)}
            title={modal.title}
            courseUrl={`/courses/${modal.id}`}
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
            ) : course ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${course.is_active === 1 ? 'badge-success' : 'badge-gray'}`}>
                    {course.is_active === 1 ? 'Активний' : 'Архівний'}
                  </span>
                </div>

                {/* Age and Duration */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Вік</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bae6fd' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#0369a1' }}>від {course.age_min} років</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Тривалість</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#fef3c7', borderRadius: '0.5rem', border: '1px solid #fde68a' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#b45309' }}>{course.duration_months} місяців</span>
                    </div>
                  </div>
                </div>

                {/* Description - Editable */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Опис</span>
                    {editingDescription !== modal.id && (
                      <button
                        onClick={() => startEditDescription(modal.id, course.description || '')}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          color: '#3b82f6',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: '0.25rem',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        Редагувати
                      </button>
                    )}
                  </div>
                  
                  {editingDescription === modal.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <textarea
                        value={descriptionValue}
                        onChange={(e) => setDescriptionValue(e.target.value)}
                        placeholder="Введіть опис курсу..."
                        style={{
                          width: '100%',
                          minHeight: '80px',
                          padding: '0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          outline: 'none',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={cancelEditDescription}
                          disabled={savingDescription}
                          style={{
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.8125rem',
                            color: '#6b7280',
                            background: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            cursor: savingDescription ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Скасувати
                        </button>
                        <button
                          onClick={() => saveDescription(modal.id)}
                          disabled={savingDescription}
                          style={{
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.8125rem',
                            color: 'white',
                            background: '#3b82f6',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: savingDescription ? 'not-allowed' : 'pointer',
                            opacity: savingDescription ? 0.7 : 1,
                          }}
                        >
                          {savingDescription ? 'Збереження...' : 'Зберегти'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      style={{ 
                        padding: '0.75rem', 
                        backgroundColor: course.description ? '#f8fafc' : '#f9fafb', 
                        borderRadius: '0.5rem', 
                        border: '1px solid #e2e8f0',
                        minHeight: '40px'
                      }}
                    >
                      {course.description ? (
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.5 }}>{course.description}</p>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>Опис відсутній</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Groups */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Групи</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#059669' }}>{data?.groups?.length || 0} груп</span>
                  </div>
                  
                  {data?.groups && data.groups.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '150px', overflowY: 'auto' }}>
                      {data.groups.map((group) => (
                        <div 
                          key={group.id}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem', 
                            padding: '0.625rem', 
                            backgroundColor: 'white', 
                            borderRadius: '0.5rem', 
                            border: '1px solid #e5e7eb', 
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onClick={() => handleGroupClick(group.id, group.title)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#3b82f6';
                            e.currentTarget.style.backgroundColor = '#f0f9ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '500', color: '#111827' }}>{group.title}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {getDayName(group.weekly_day)} {formatTime(group.start_time)}
                              </span>
                              {group.teacher_name && (
                                <>
                                  <span style={{ color: '#d1d5db' }}>•</span>
                                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{group.teacher_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span 
                            className={`badge ${group.status === 'active' ? 'badge-success' : group.status === 'completed' ? 'badge-gray' : 'badge-warning'}`}
                            style={{ fontSize: '0.6875rem' }}
                          >
                            {group.status === 'active' ? 'Активна' : group.status === 'completed' ? 'Завершена' : 'Відкрита'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {(!data?.groups || data.groups.length === 0) && (
                    <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px dashed #d1d5db' }}>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Немає груп для цього курсу</span>
                    </div>
                  )}
                </div>

                {/* Students */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Учні</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#059669' }}>{data?.students?.length || 0} учнів</span>
                  </div>
                  
                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder="Пошук учня..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.375rem 0.5rem',
                      fontSize: '0.8125rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      outline: 'none',
                      backgroundColor: 'white',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
                  />
                  
                  {data?.students && data.students.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '160px', overflowY: 'auto' }}>
                      {data.students
                        .filter(s => !studentSearchQuery || s.full_name.toLowerCase().includes(studentSearchQuery.toLowerCase()) || (s.public_id && s.public_id.toLowerCase().includes(studentSearchQuery.toLowerCase())))
                        .map((student) => (
                        <div 
                          key={student.id}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem', 
                            padding: '0.625rem', 
                            backgroundColor: 'white', 
                            borderRadius: '0.5rem', 
                            border: '1px solid #e5e7eb', 
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onClick={() => handleStudentClick(student.id, student.full_name)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#3b82f6';
                            e.currentTarget.style.backgroundColor = '#f0f9ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          <div style={{ 
                            width: '36px', 
                            height: '36px', 
                            borderRadius: '50%', 
                            backgroundColor: '#dbeafe', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0,
                            border: '2px solid #bfdbfe'
                          }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb' }}>
                              {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '500', color: '#111827' }}>{student.full_name}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.125rem' }}>
                              <span style={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'monospace' }}>#{student.public_id}</span>
                              {student.groups.length > 0 && (
                                <>
                                  <span style={{ color: '#d1d5db' }}>•</span>
                                  <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                                    {student.groups.map(g => g.title).join(', ')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {student.phone && (
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{student.phone}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {(!data?.students || data.students.length === 0) && (
                    <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px dashed #d1d5db' }}>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Немає учнів на цьому курсі</span>
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
