'use client';

import { useState, useEffect, useCallback } from 'react';
import DraggableModal from './DraggableModal';
import { useLessonModals } from './LessonModalsContext';
import { Clock, BookOpen, User, Check, X, Calendar, Trash2, ArrowRightCircle, UserMinus, Users } from 'lucide-react';

interface Teacher {
  id: number;
  name: string;
  public_id: string;
}

interface LessonData {
  id: number;
  groupId: number;
  groupTitle: string;
  courseTitle: string;
  teacherId: number;
  teacherName: string;
  originalTeacherId?: number;
  isReplaced?: boolean;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'done' | 'canceled';
  topic: string | null;
}

function formatDateTime(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}

function getStatusBadge(status: 'scheduled' | 'done' | 'canceled') {
  const styles = {
    scheduled: { background: '#3b82f6', color: 'white' as const },
    done: { background: '#22c55e', color: 'white' as const },
    canceled: { background: '#ef4444', color: 'white' as const },
  };
  const labels = {
    scheduled: 'Заплановано',
    done: 'Проведено',
    canceled: 'Скасовано',
  };
  const icons = {
    scheduled: Calendar,
    done: Check,
    canceled: X,
  };
  const Icon = icons[status];
  return (
    <span style={{ 
      ...styles[status],
      fontSize: '0.6875rem',
      padding: '0.25rem 0.5rem',
      borderRadius: '0.25rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.125rem',
    }}>
      <Icon size={8} />
      {labels[status]}
    </span>
  );
}

export default function LessonModalsManager() {
  const { openModals, updateModalState, closeLessonModal } = useLessonModals();
  const [lessonData, setLessonData] = useState<Record<number, LessonData>>({});
  const [loadingLessons, setLoadingLessons] = useState<Record<number, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Form state
  const [lessonTopic, setLessonTopic] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [teachers, setTeachers] = useState<Record<number, Teacher[]>>({});
  const [showTeacherSelect, setShowTeacherSelect] = useState<Record<number, boolean>>({});
  const [selectedTeacherId, setSelectedTeacherId] = useState<Record<number, number | null>>({});
  const [replacementReason, setReplacementReason] = useState<Record<number, string>>({});
  const [teachersLoading, setTeachersLoading] = useState<Record<number, boolean>>({});

  // Load teachers list
  const loadTeachers = async (lessonId: number) => {
    if (teachers[lessonId]?.length > 0 || teachersLoading[lessonId]) return;
    
    setTeachersLoading(prev => ({ ...prev, [lessonId]: true }));
    try {
      const response = await fetch('/api/teachers');
      if (response.ok) {
        const data = await response.json();
        setTeachers(prev => ({ ...prev, [lessonId]: data.teachers || [] }));
      }
    } catch (error) {
      console.error('Error loading teachers:', error);
    } finally {
      setTeachersLoading(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const loadLessonData = async (lessonId: number) => {
    if (lessonData[lessonId] || loadingLessons[lessonId]) return;
    
    setLoadingLessons(prev => ({ ...prev, [lessonId]: true }));
    
    try {
      const response = await fetch(`/api/lessons/${lessonId}`);
      if (response.ok) {
        const data = await response.json();
        setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
        // Also update the modal with the fresh data
        updateModalState(lessonId, { 
          lessonData: {
            id: data.lesson.id,
            groupId: data.lesson.groupId,
            groupTitle: data.lesson.groupTitle,
            courseTitle: data.lesson.courseTitle,
            teacherId: data.lesson.teacherId,
            teacherName: data.lesson.teacherName,
            startTime: data.lesson.startTime,
            endTime: data.lesson.endTime,
            status: data.lesson.status,
            topic: data.lesson.topic,
          }
        });
        setLessonTopic(prev => ({ ...prev, [lessonId]: data.lesson.topic || '' }));
      }
    } catch (error) {
      console.error('Error loading lesson:', error);
    } finally {
      setLoadingLessons(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  useEffect(() => {
    openModals.forEach(modal => {
      if (modal.isOpen && !lessonData[modal.id]) {
        loadLessonData(modal.id);
      }
      // Initialize topic from stored modal data
      if (modal.isOpen && modal.lessonData && !lessonTopic[modal.id]) {
        setLessonTopic(prev => ({ ...prev, [modal.id]: modal.lessonData?.topic || '' }));
      }
    });
  }, [openModals]);

  const handleClose = (lessonId: number) => {
    closeLessonModal(lessonId);
  };

  const handleUpdatePosition = (lessonId: number, position: { x: number; y: number }) => {
    updateModalState(lessonId, { position });
  };

  const handleUpdateSize = (lessonId: number, size: { width: number; height: number }) => {
    updateModalState(lessonId, { size });
  };

  const handleSaveTopic = async (lessonId: number) => {
    setSaving(prev => ({ ...prev, [lessonId]: true }));
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: lessonTopic[lessonId] }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
        // Update modal data as well
        updateModalState(lessonId, { 
          lessonData: {
            ...lessonData[lessonId],
            topic: lessonTopic[lessonId],
          }
        });
      }
    } catch (error) {
      console.error('Failed to save topic:', error);
    } finally {
      setSaving(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  const handleCancelLesson = async (lessonId: number) => {
    setSaving(prev => ({ ...prev, [lessonId]: true }));
    try {
      const res = await fetch(`/api/lessons/${lessonId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Скасовано адміністратором' }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
        // Update modal data as well
        updateModalState(lessonId, { 
          lessonData: {
            ...lessonData[lessonId],
            status: 'canceled',
          }
        });
      }
    } catch (error) {
      console.error('Failed to cancel lesson:', error);
    } finally {
      setSaving(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  const handleMarkDone = async (lessonId: number) => {
    setSaving(prev => ({ ...prev, [lessonId]: true }));
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
        // Update modal data as well
        updateModalState(lessonId, { 
          lessonData: {
            ...lessonData[lessonId],
            status: 'done',
          }
        });
      }
    } catch (error) {
      console.error('Failed to mark done:', error);
    } finally {
      setSaving(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (!confirm('Ви впевнені, що хочете видалити це заняття? Цю дію неможливо скасувати.')) {
      return;
    }
    
    setSaving(prev => ({ ...prev, [lessonId]: true }));
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        // Close the modal
        closeLessonModal(lessonId);
        // Dispatch event to notify schedule page to refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('itrobot-lesson-deleted'));
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Не вдалося видалити заняття');
      }
    } catch (error) {
      console.error('Failed to delete lesson:', error);
      alert('Не вдалося видалити заняття');
    } finally {
      setSaving(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  const handleReplaceTeacher = async (lessonId: number) => {
    const teacherId = selectedTeacherId[lessonId];
    if (!teacherId) {
      alert('Оберіть викладача для заміни');
      return;
    }
    
    setSaving(prev => ({ ...prev, [lessonId]: true }));
    try {
      const res = await fetch(`/api/lessons/${lessonId}/replace-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          replacementTeacherId: teacherId,
          reason: replacementReason[lessonId] || ''
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
        setShowTeacherSelect(prev => ({ ...prev, [lessonId]: false }));
        setSelectedTeacherId(prev => ({ ...prev, [lessonId]: null }));
        setReplacementReason(prev => ({ ...prev, [lessonId]: '' }));
        // Dispatch event to notify schedule page to refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('itrobot-lesson-updated'));
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Не вдалося замінити викладача');
      }
    } catch (error) {
      console.error('Failed to replace teacher:', error);
      alert('Не вдалося замінити викладача');
    } finally {
      setSaving(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  const handleCancelReplacement = async (lessonId: number) => {
    if (!confirm('Скасувати заміну викладача?')) {
      return;
    }
    
    setSaving(prev => ({ ...prev, [lessonId]: true }));
    try {
      const res = await fetch(`/api/lessons/${lessonId}/replace-teacher`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        const data = await res.json();
        setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
        // Dispatch event to notify schedule page to refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('itrobot-lesson-updated'));
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Не вдалося скасувати заміну');
      }
    } catch (error) {
      console.error('Failed to cancel replacement:', error);
      alert('Не вдалося скасувати заміну');
    } finally {
      setSaving(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  if (!isHydrated || openModals.length === 0) return null;

  return (
    <>
      {openModals.map((modal) => {
        if (!modal.isOpen) return null;
        
        // Prefer stored modal data, fall back to API data if it has all required fields
        const apiData = lessonData[modal.id];
        const modalData = modal.lessonData as LessonData;
        const lesson = (apiData && apiData.groupTitle) ? apiData : modalData;
        const isLoading = loadingLessons[modal.id];
        const isSaving = saving[modal.id];
        const currentTopic = lessonTopic[modal.id] ?? lesson?.topic ?? '';

        return (
          <DraggableModal
            key={modal.id}
            id={`lesson-modal-${modal.id}`}
            isOpen={true}
            onClose={() => handleClose(modal.id)}
            title="Деталі заняття"
            groupUrl={`/groups/${lesson?.groupId}`}
            initialWidth={modal.size?.width || 420}
            initialHeight={modal.size?.height || 480}
            initialPosition={modal.position}
            onPositionChange={(pos) => handleUpdatePosition(modal.id, pos)}
            onSizeChange={(size) => handleUpdateSize(modal.id, size)}
          >
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ color: '#6b7280' }}>Завантаження...</div>
              </div>
            ) : lesson ? (
              <div style={{ padding: '1.25rem', overflow: 'auto', height: '100%' }}>
                {/* Status badge */}
                <div style={{ marginBottom: '1rem' }}>
                  {getStatusBadge(lesson.status)}
                </div>
              
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>Група</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{lesson.groupTitle}</div>
                </div>
                
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>Курс</div>
                  <div style={{ fontSize: '0.875rem', color: '#374151' }}>{lesson.courseTitle}</div>
                </div>
                
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>Викладач</div>
                  <div style={{ fontSize: '0.875rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={14} />
                    {lesson.teacherName}
                    {lesson.isReplaced && (
                      <span style={{ 
                        background: '#fef3c7', 
                        color: '#d97706', 
                        fontSize: '0.6875rem', 
                        padding: '0.125rem 0.375rem', 
                        borderRadius: '0.25rem',
                        marginLeft: '0.25rem'
                      }}>
                        (Зам.)
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Teacher replacement section */}
                {showTeacherSelect[modal.id] ? (
                  <div style={{ 
                    marginBottom: '1rem', 
                    padding: '1rem', 
                    background: '#f9fafb', 
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                      Заміна викладача
                    </div>
                    
                    <select
                      value={selectedTeacherId[modal.id] || ''}
                      onChange={(e) => setSelectedTeacherId(prev => ({ ...prev, [modal.id]: e.target.value ? parseInt(e.target.value) : null }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        marginBottom: '0.5rem',
                        background: 'white'
                      }}
                    >
                      <option value="">Оберіть викладача...</option>
                      {teachers[modal.id]?.filter(t => t.id !== lesson.teacherId).map(teacher => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                    
                    <input
                      type="text"
                      value={replacementReason[modal.id] || ''}
                      onChange={(e) => setReplacementReason(prev => ({ ...prev, [modal.id]: e.target.value }))}
                      placeholder="Причина заміни (необов'язково)"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        marginBottom: '0.5rem',
                        boxSizing: 'border-box'
                      }}
                    />
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleReplaceTeacher(modal.id)}
                        disabled={isSaving || !selectedTeacherId[modal.id]}
                        className="btn btn-primary"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem', padding: '0.375rem' }}
                      >
                        {isSaving ? 'Збереження...' : 'Замінити'}
                      </button>
                      <button
                        onClick={() => {
                          setShowTeacherSelect(prev => ({ ...prev, [modal.id]: false }));
                          setSelectedTeacherId(prev => ({ ...prev, [modal.id]: null }));
                          setReplacementReason(prev => ({ ...prev, [modal.id]: '' }));
                        }}
                        className="btn"
                        style={{ 
                          flex: 1, 
                          justifyContent: 'center', 
                          background: '#f3f4f6', 
                          border: '1px solid #d1d5db',
                          fontSize: '0.8125rem', 
                          padding: '0.375rem' 
                        }}
                      >
                        Скасувати
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      loadTeachers(modal.id);
                      setShowTeacherSelect(prev => ({ ...prev, [modal.id]: true }));
                    }}
                    className="btn"
                    style={{ 
                      width: '100%', 
                      justifyContent: 'center',
                      background: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #fcd34d',
                      marginBottom: '1rem',
                      fontSize: '0.8125rem',
                      padding: '0.375rem'
                    }}
                  >
                    <UserMinus size={14} />
                    Замінити викладача
                  </button>
                )}
                
                {/* Show cancel replacement button if replaced */}
                {lesson.isReplaced && !showTeacherSelect[modal.id] && (
                  <button
                    onClick={() => handleCancelReplacement(modal.id)}
                    disabled={isSaving}
                    className="btn"
                    style={{ 
                      width: '100%', 
                      justifyContent: 'center',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      marginBottom: '1rem',
                      fontSize: '0.8125rem',
                      padding: '0.375rem'
                    }}
                  >
                    <X size={14} />
                    Скасувати заміну
                  </button>
                )}
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>Час</div>
                  <div style={{ fontSize: '0.875rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Clock size={14} />
                    {formatDateTime(lesson.startTime, lesson.endTime)}
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.375rem' }}>Тема заняття</div>
                  <input
                    type="text"
                    value={currentTopic}
                    onChange={(e) => setLessonTopic(prev => ({ ...prev, [modal.id]: e.target.value }))}
                    placeholder="Введіть тему заняття"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>
                
                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.25rem' }}>
                  <button
                    onClick={() => handleSaveTopic(modal.id)}
                    disabled={isSaving}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {isSaving ? 'Збереження...' : 'Зберегти тему'}
                  </button>
                  
                  {lesson.status === 'scheduled' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleMarkDone(modal.id)}
                        disabled={isSaving}
                        className="btn btn-success"
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <Check size={14} />
                        Проведено
                      </button>
                      <button
                        onClick={() => handleCancelLesson(modal.id)}
                        disabled={isSaving}
                        className="btn btn-danger"
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <X size={14} />
                        Скасувати
                      </button>
                    </div>
                  )}
                  
                  {/* Delete button - only for scheduled lessons */}
                  {lesson.status === 'scheduled' && (
                    <button
                      onClick={() => handleDeleteLesson(modal.id)}
                      disabled={isSaving}
                      className="btn"
                      style={{ 
                        width: '100%', 
                        justifyContent: 'center',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                      }}
                    >
                      <Trash2 size={14} />
                      {isSaving ? 'Видалення...' : 'Видалити заняття'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ color: '#6b7280' }}>Дані не знайдено</div>
              </div>
            )}
          </DraggableModal>
        );
      })}
    </>
  );
}
