'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DraggableModal from './DraggableModal';
import { useLessonModals } from './LessonModalsContext';
import { useGroupModals } from './GroupModalsContext';
import { useCourseModals } from './CourseModalsContext';
import { useTeacherModals } from './TeacherModalsContext';
import { Clock, BookOpen, User, Check, X, Calendar, Trash2, UserMinus, Users, MoreVertical, Edit2, Save, RefreshCw } from 'lucide-react';

interface Teacher {
  id: number;
  name: string;
  public_id: string;
}

interface AttendanceRecord {
  student_id: number;
  student_name: string;
  student_phone: string | null;
  attendance_id: number | null;
  status: 'present' | 'absent' | 'makeup_planned' | 'makeup_done' | null;
  comment: string | null;
  makeup_lesson_id: number | null;
}

interface LessonData {
  id: number;
  groupId: number;
  groupTitle: string;
  courseTitle: string;
  courseId: number;
  teacherId: number;
  teacherName: string;
  originalTeacherId?: number;
  isReplaced?: boolean;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'done' | 'canceled';
  topic: string | null;
  notes: string | null;
  topicSetBy: string | null;
  topicSetAt: string | null;
  topicSetByTelegramId: string | null;
  notesSetBy: string | null;
  notesSetAt: string | null;
  notesSetByTelegramId: string | null;
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
  const { openGroupModal } = useGroupModals();
  const { openCourseModal } = useCourseModals();
  const { openTeacherModal } = useTeacherModals();
  const [lessonData, setLessonData] = useState<Record<number, LessonData>>({});
  const [loadingLessons, setLoadingLessons] = useState<Record<number, boolean>>({});
  const loadingRef = useRef<Record<string, boolean>>({}); // Track loading state without causing re-renders
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Form state
  const [lessonTopic, setLessonTopic] = useState<Record<number, string>>({});
  const [lessonNotes, setLessonNotes] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [savingTopic, setSavingTopic] = useState<Record<number, boolean>>({});
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({});
  const [editingTopic, setEditingTopic] = useState<Record<number, boolean>>({});
  const [editingNotes, setEditingNotes] = useState<Record<number, boolean>>({});
  // Refs for editing state - used by polling to avoid stale closures
  const editingTopicRef = useRef<Record<number, boolean>>({});
  const editingNotesRef = useRef<Record<number, boolean>>({});
  const [showActionsMenu, setShowActionsMenu] = useState<Record<number, boolean>>({});
  const [teachers, setTeachers] = useState<Record<number, Teacher[]>>({});
  const [showTeacherSelect, setShowTeacherSelect] = useState<Record<number, boolean>>({});
  const [selectedTeacherId, setSelectedTeacherId] = useState<Record<number, number | null>>({});
  const [replacementReason, setReplacementReason] = useState<Record<number, string>>({});
  const [teachersLoading, setTeachersLoading] = useState<Record<number, boolean>>({});
  
  // Attendance state
  const [attendance, setAttendance] = useState<Record<number, AttendanceRecord[]>>({});
  const [attendanceLoading, setAttendanceLoading] = useState<Record<number, boolean>>({});
  const [attendanceSaving, setAttendanceSaving] = useState<Record<number, boolean>>({});

  // Load teachers list
  const loadTeachers = async (lessonId: number) => {
    if ((teachers[lessonId]?.length ?? 0) > 0 || teachersLoading[lessonId]) return;
    
    setTeachersLoading(prev => ({ ...prev, [lessonId]: true }));
    try {
      const response = await fetch('/api/teachers');
      if (response.ok) {
        const data = await response.json();
        // API returns array directly, not { teachers: [] }
        setTeachers(prev => ({ ...prev, [lessonId]: data || [] }));
      }
    } catch (error) {
      console.error('Error loading teachers:', error);
    } finally {
      setTeachersLoading(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  // Load attendance for lesson
  const loadAttendance = async (lessonId: number) => {
    // Always fetch fresh data - don't check loading state to ensure we get latest
    // Use a separate tracking to avoid duplicate requests
    if (loadingRef.current[`att_${lessonId}`]) return;
    loadingRef.current[`att_${lessonId}`] = true;
    
    setAttendanceLoading(prev => ({ ...prev, [lessonId]: true }));
    try {
      const response = await fetch(`/api/lessons/${lessonId}/attendance`);
      if (response.ok) {
        const data = await response.json();
        setAttendance(prev => ({ ...prev, [lessonId]: data.attendance || [] }));
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      loadingRef.current[`att_${lessonId}`] = false;
      setAttendanceLoading(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  // Set attendance for a student
  const setStudentAttendance = async (lessonId: number, studentId: number, status: 'present' | 'absent') => {
    setAttendanceSaving(prev => ({ ...prev, [lessonId]: true }));
    try {
      const response = await fetch(`/api/lessons/${lessonId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', studentId, status }),
      });
      if (response.ok) {
        // Update local state
        const updatedAttendance = (attendance[lessonId] || []).map(a => 
          a.student_id === studentId ? { ...a, status } : a
        );
        setAttendance(prev => ({
          ...prev,
          [lessonId]: updatedAttendance,
        }));
        
        // Check if this is the first attendance being set - auto-mark lesson as done
        const currentLesson = lessonData[lessonId];
        if (currentLesson && currentLesson.status === 'scheduled') {
          // Check if any attendance was set before this change
          const hadAttendanceBefore = (attendance[lessonId] || []).some(a => a.status !== null);
          const hasAttendanceNow = updatedAttendance.some(a => a.status !== null);
          
          // If this is the first attendance being set, mark lesson as done
          if (!hadAttendanceBefore && hasAttendanceNow) {
            // Update lesson status to done
            const statusResponse = await fetch(`/api/lessons/${lessonId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'done' }),
            });
            if (statusResponse.ok) {
              const data = await statusResponse.json();
              setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
              updateModalState(lessonId, { 
                lessonData: {
                  ...lessonData[lessonId],
                  status: 'done',
                }
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error setting attendance:', error);
    } finally {
      setAttendanceSaving(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const loadLessonData = useCallback(async (lessonId: number) => {
    // Validate lessonId before making request
    if (!lessonId || typeof lessonId !== 'number' || isNaN(lessonId)) {
      console.error('Invalid lessonId:', lessonId);
      return;
    }
    
    // Use ref to check if already loading to avoid duplicate requests
    if (loadingRef.current[lessonId]) return;
    loadingRef.current[lessonId] = true;
    
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
            courseId: data.lesson.courseId,
            teacherId: data.lesson.teacherId,
            teacherName: data.lesson.teacherName,
            startTime: data.lesson.startTime,
            endTime: data.lesson.endTime,
            status: data.lesson.status,
            topic: data.lesson.topic,
            notes: data.lesson.notes,
            topicSetBy: data.lesson.topicSetBy,
            topicSetAt: data.lesson.topicSetAt,
            notesSetBy: data.lesson.notesSetBy,
            notesSetAt: data.lesson.notesSetAt,
          }
        });
        setLessonTopic(prev => ({ ...prev, [lessonId]: data.lesson.topic || '' }));
        setLessonNotes(prev => ({ ...prev, [lessonId]: data.lesson.notes || '' }));
      }
    } catch (error) {
      console.error('Error loading lesson:', error);
    } finally {
      loadingRef.current[lessonId] = false;
      setLoadingLessons(prev => ({ ...prev, [lessonId]: false }));
    }
  }, [updateModalState]);

  // Auto-refresh lesson data every 10 seconds when modal is open
  // Use refs to avoid recreating interval
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadLessonDataRef = useRef(loadLessonData);
  
  // Keep ref in sync
  useEffect(() => {
    loadLessonDataRef.current = loadLessonData;
  }, [loadLessonData]);
  
  useEffect(() => {
    const openLessonIds = openModals
      .filter(modal => modal.isOpen && modal.id && typeof modal.id === 'number')
      .map(modal => modal.id as number);
    
    if (openLessonIds.length === 0) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }
    
    // Don't set up interval if already running
    if (refreshIntervalRef.current) return;
    
    refreshIntervalRef.current = setInterval(() => {
      openLessonIds.forEach(lessonId => {
        loadLessonDataRef.current(lessonId);
      });
    }, 10000); // Refresh every 10 seconds
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [openModals.length > 0]);

  useEffect(() => {
    openModals.forEach(modal => {
      // Validate modal has valid id
      if (!modal.isOpen || !modal.id || typeof modal.id !== 'number') {
        return;
      }
      
      // Try to fetch fresh data from API when modal opens
      // but don't block if we already have modalData
      const hasModalData = modal.lessonData && modal.lessonData.groupTitle;
      const hasApiData = lessonData[modal.id] && lessonData[modal.id].groupTitle;
      
      if (!hasModalData && !hasApiData && !loadingRef.current[modal.id]) {
        loadLessonData(modal.id);
      }
      // Initialize topic from stored modal data or API data
      const topicSource = modal.lessonData?.topic ?? lessonData[modal.id]?.topic;
      if (topicSource !== undefined && !lessonTopic[modal.id]) {
        setLessonTopic(prev => ({ ...prev, [modal.id]: topicSource || '' }));
      }
      
      // Load attendance if not loaded
      if (!attendance[modal.id] && !attendanceLoading[modal.id]) {
        loadAttendance(modal.id);
      }
    });
  }, [openModals, lessonData, lessonTopic, loadLessonData, attendance, attendanceLoading]);

  const handleClose = (lessonId: number) => {
    closeLessonModal(lessonId);
  };

  const handleUpdatePosition = (lessonId: number, position: { x: number; y: number }) => {
    updateModalState(lessonId, { position });
  };

  const handleUpdateSize = (lessonId: number, size: { width: number; height: number }) => {
    updateModalState(lessonId, { size });
  };

  // Start editing topic
  const startEditingTopic = (lessonId: number) => {
    editingTopicRef.current[lessonId] = true;
    setEditingTopic(prev => ({ ...prev, [lessonId]: true }));
  };

  // Cancel editing topic
  const cancelEditingTopic = (lessonId: number) => {
    editingTopicRef.current[lessonId] = false;
    setLessonTopic(prev => ({ ...prev, [lessonId]: lessonData[lessonId]?.topic || '' }));
    setEditingTopic(prev => ({ ...prev, [lessonId]: false }));
  };

  // Save topic
  const saveTopic = async (lessonId: number) => {
    const newTopic = lessonTopic[lessonId];
    const currentLessonData = lessonData[lessonId];
    
    setSavingTopic(prev => ({ ...prev, [lessonId]: true }));
    try {
      // If lesson is not done yet, automatically mark it as done when topic is added
      const statusUpdate = currentLessonData?.status !== 'done' ? { status: 'done' } : {};
      
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: newTopic, ...statusUpdate }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
        updateModalState(lessonId, { 
          lessonData: {
            ...currentLessonData,
            topic: newTopic,
            status: data.lesson.status,
            topicSetBy: data.lesson.topicSetBy,
            topicSetAt: data.lesson.topicSetAt,
          }
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || 'Не вдалося зберегти тему');
      }
    } catch (error) {
      console.error('Failed to save topic:', error);
      alert('Не вдалося зберегти тему');
    } finally {
      editingTopicRef.current[lessonId] = false;
      setSavingTopic(prev => ({ ...prev, [lessonId]: false }));
      setEditingTopic(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  // Start editing notes
  const startEditingNotes = (lessonId: number) => {
    editingNotesRef.current[lessonId] = true;
    setEditingNotes(prev => ({ ...prev, [lessonId]: true }));
  };

  // Cancel editing notes
  const cancelEditingNotes = (lessonId: number) => {
    editingNotesRef.current[lessonId] = false;
    setLessonNotes(prev => ({ ...prev, [lessonId]: lessonData[lessonId]?.notes || '' }));
    setEditingNotes(prev => ({ ...prev, [lessonId]: false }));
  };

  // Save notes
  const saveNotes = async (lessonId: number) => {
    const newNotes = lessonNotes[lessonId];
    const currentLessonData = lessonData[lessonId];
    
    setSavingNotes(prev => ({ ...prev, [lessonId]: true }));
    try {
      // If lesson is not done yet, automatically mark it as done when notes are added
      const statusUpdate = currentLessonData?.status !== 'done' ? { status: 'done' } : {};
      
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes, ...statusUpdate }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
        updateModalState(lessonId, { 
          lessonData: {
            ...currentLessonData,
            notes: newNotes,
            status: data.lesson.status,
            notesSetBy: data.lesson.notesSetBy,
            notesSetAt: data.lesson.notesSetAt,
          }
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || 'Не вдалося зберегти нотатки');
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
      alert('Не вдалося зберегти нотатки');
    } finally {
      editingNotesRef.current[lessonId] = false;
      setSavingNotes(prev => ({ ...prev, [lessonId]: false }));
      setEditingNotes(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  // Polling for live updates when modal is open
  // Use refs to avoid recreating interval on every render
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const openModalsRef = useRef(openModals);
  
  // Keep ref in sync
  useEffect(() => {
    openModalsRef.current = openModals;
  }, [openModals]);
  
  useEffect(() => {
    if (openModals.length === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }
    
    // Don't set up interval if already running
    if (pollingIntervalRef.current) return;
    
    pollingIntervalRef.current = setInterval(() => {
      const currentModals = openModalsRef.current;
      currentModals.forEach(modal => {
        if (modal.isOpen && modal.id) {
          // Silently refresh lesson data
          fetch(`/api/lessons/${modal.id}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data?.lesson) {
                const serverLesson = data.lesson;
                const serverTopic = serverLesson.topic || '';
                const serverNotes = serverLesson.notes || '';
                
                // Get current local state
                const currentLesson = lessonData[modal.id];
                const localTopic = lessonTopic[modal.id] ?? '';
                const localNotes = lessonNotes[modal.id] ?? '';
                const currentLocalTopic = currentLesson?.topic || '';
                const currentLocalNotes = currentLesson?.notes || '';
                
                // Update lesson data (always update to get latest status, teacher info, etc.)
                setLessonData(prev => ({ ...prev, [modal.id]: serverLesson }));
                
                // Only update modal state with fresh server data if user is NOT editing topic/notes
                // This prevents overwriting user's unsaved changes
                const isEditing = editingTopicRef.current[modal.id] || editingNotesRef.current[modal.id];
                
                if (!isEditing) {
                  updateModalState(modal.id, { 
                    lessonData: {
                      ...modal.lessonData,
                      ...serverLesson,
                    }
                  });
                }
                
                // Only update local input state if user is not editing
                // (values match what was last known from server)
                if (!editingTopicRef.current[modal.id] && localTopic === currentLocalTopic && serverTopic !== currentLocalTopic) {
                  setLessonTopic(prev => ({ ...prev, [modal.id]: serverTopic }));
                }
                if (!editingNotesRef.current[modal.id] && localNotes === currentLocalNotes && serverNotes !== currentLocalNotes) {
                  setLessonNotes(prev => ({ ...prev, [modal.id]: serverNotes }));
                }
                
                // Refresh attendance data
                loadAttendance(modal.id);
              }
            })
            .catch(err => console.error('Polling error:', err));
        }
      });
    }, 3000); // Poll every 3 seconds for more responsive updates
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [openModals.length > 0]); // Only re-run if modals open/close

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
        
        // Use modalData if it exists and has required fields, otherwise fall back to API data
        // CRITICAL: Prefer API data (lessonData) which is kept fresh by polling over modalData which may be stale
        const apiData = lessonData[modal.id];
        const modalData = modal.lessonData as LessonData | undefined;
        let lesson: LessonData | undefined;
        
        // Always prefer API data as it's kept fresh by polling
        if (apiData && (apiData.groupTitle || apiData.startTime)) {
          lesson = apiData;
        } else if (modalData && modalData.groupTitle) {
          // Fall back to modal data only if API data is not available
          lesson = modalData;
        }
        
        const isLoading = loadingLessons[modal.id] && !lesson;
        const isSaving = saving[modal.id];
        const currentTopic = lessonTopic[modal.id] ?? lesson?.topic ?? '';

        return (
          <DraggableModal
            key={modal.id}
            id={`lesson-modal-${modal.id}`}
            isOpen={true}
            onClose={() => handleClose(modal.id)}
            title="Групове заняття"
            groupUrl={`/groups/${lesson?.groupId}`}
            initialWidth={modal.size?.width || 420}
            initialHeight={modal.size?.height || 480}
            initialPosition={modal.position}
            onPositionChange={(pos) => handleUpdatePosition(modal.id, pos)}
            onSizeChange={(size) => handleUpdateSize(modal.id, size)}
            headerAction={
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowActionsMenu(prev => ({ ...prev, [modal.id]: !prev[modal.id] }))}
                  disabled={isSaving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    backgroundColor: showActionsMenu[modal.id] ? '#f3f4f6' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    color: '#64748b',
                    transition: 'all 0.15s ease',
                    opacity: isSaving ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    if (!showActionsMenu[modal.id]) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  title="Дії"
                >
                  <MoreVertical size={14} />
                </button>
                
                {showActionsMenu[modal.id] && (
                  <>
                    {/* Backdrop to close menu */}
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                      onClick={() => setShowActionsMenu(prev => ({ ...prev, [modal.id]: false }))}
                    />
                    
                    {/* Dropdown menu */}
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      border: '1px solid #e5e7eb',
                      minWidth: '180px',
                      zIndex: 50,
                      overflow: 'hidden',
                    }}>
                      {lesson?.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => {
                              setShowActionsMenu(prev => ({ ...prev, [modal.id]: false }));
                              loadTeachers(modal.id);
                              setShowTeacherSelect(prev => ({ ...prev, [modal.id]: true }));
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              width: '100%',
                              padding: '0.625rem 0.75rem',
                              fontSize: '0.8125rem',
                              color: '#374151',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <UserMinus size={14} />
                            Замінити викладача
                          </button>
                          
                          <button
                            onClick={() => {
                              setShowActionsMenu(prev => ({ ...prev, [modal.id]: false }));
                              handleCancelLesson(modal.id);
                            }}
                            disabled={isSaving}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              width: '100%',
                              padding: '0.625rem 0.75rem',
                              fontSize: '0.8125rem',
                              color: '#f59e0b',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: isSaving ? 'not-allowed' : 'pointer',
                              textAlign: 'left',
                              opacity: isSaving ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fffbeb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <X size={14} />
                            Скасувати заняття
                          </button>
                          
                          <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0' }} />
                        </>
                      )}
                      
                      <button
                        onClick={() => {
                          setShowActionsMenu(prev => ({ ...prev, [modal.id]: false }));
                          handleDeleteLesson(modal.id);
                        }}
                        disabled={isSaving}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          width: '100%',
                          padding: '0.625rem 0.75rem',
                          fontSize: '0.8125rem',
                          color: '#dc2626',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: isSaving ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          opacity: isSaving ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 size={14} />
                        Видалити заняття
                      </button>
                    </div>
                  </>
                )}
              </div>
            }
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
                  <button
                    onClick={() => openGroupModal(lesson.groupId, lesson.groupTitle)}
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#3b82f6',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#3b82f6'}
                  >
                    <Users size={14} />
                    {lesson.groupTitle}
                  </button>
                </div>
                
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>Курс</div>
                  <button
                    onClick={() => openCourseModal(lesson.courseId, lesson.courseTitle)}
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#3b82f6',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#3b82f6'}
                  >
                    <BookOpen size={14} />
                    {lesson.courseTitle}
                  </button>
                </div>
                
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>Викладач</div>
                  <button
                    onClick={() => openTeacherModal(lesson.teacherId, lesson.teacherName)}
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#3b82f6',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#3b82f6'}
                  >
                    <User size={14} />
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
                  </button>
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
                ) : lesson.isReplaced ? (
                  /* Show cancel replacement button if replaced */
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
                    Скасувати заміну викладача
                  </button>
                ) : null}
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>Час</div>
                  <div style={{ fontSize: '0.875rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Clock size={14} />
                    {formatDateTime(lesson.startTime, lesson.endTime)}
                  </div>
                </div>
                
                {/* Topic field */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>
                      Тема заняття
                      {lesson?.topicSetBy && lesson?.topicSetAt && (
                        <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: '0.5rem' }}>
                          ({lesson.topicSetBy}, {lesson.topicSetAt})
                        </span>
                      )}
                    </div>
                    {!editingTopic[modal.id] && (
                      <button
                        onClick={() => startEditingTopic(modal.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          padding: 0,
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: '#6b7280',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3f4f6';
                          e.currentTarget.style.color = '#3b82f6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#6b7280';
                        }}
                        title="Редагувати тему"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                  
                  {editingTopic[modal.id] ? (
                    <div>
                      <input
                        type="text"
                        value={currentTopic}
                        onChange={(e) => setLessonTopic(prev => ({ ...prev, [modal.id]: e.target.value }))}
                        placeholder="Введіть тему заняття"
                        disabled={savingTopic[modal.id]}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.875rem',
                          border: '1px solid #3b82f6',
                          borderRadius: '0.375rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                          backgroundColor: savingTopic[modal.id] ? '#f9fafb' : 'white',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          onClick={() => saveTopic(modal.id)}
                          disabled={savingTopic[modal.id]}
                          className="btn btn-primary"
                          style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                        >
                          {savingTopic[modal.id] ? 'Збереження...' : 'Зберегти'}
                        </button>
                        <button
                          onClick={() => cancelEditingTopic(modal.id)}
                          disabled={savingTopic[modal.id]}
                          className="btn"
                          style={{ 
                            flex: 1, 
                            justifyContent: 'center', 
                            background: '#f3f4f6', 
                            border: '1px solid #d1d5db',
                            fontSize: '0.8125rem', 
                            padding: '0.375rem 0.75rem' 
                          }}
                        >
                          Скасувати
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '0.5rem 0.75rem', 
                      fontSize: '0.875rem', 
                      color: currentTopic ? '#374151' : '#9ca3af',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.375rem',
                      border: '1px solid #e5e7eb',
                      minHeight: '2.375rem',
                    }}>
                      {currentTopic || 'Тема не вказана'}
                    </div>
                  )}
                </div>
                
                {/* Notes field */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>
                      Нотатки
                      {lesson?.notesSetBy && lesson?.notesSetAt && (
                        <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: '0.5rem' }}>
                          ({lesson.notesSetBy}, {lesson.notesSetAt})
                        </span>
                      )}
                    </div>
                    {!editingNotes[modal.id] && (
                      <button
                        onClick={() => startEditingNotes(modal.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          padding: 0,
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: '#6b7280',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3f4f6';
                          e.currentTarget.style.color = '#3b82f6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#6b7280';
                        }}
                        title="Редагувати нотатки"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                  
                  {editingNotes[modal.id] ? (
                    <div>
                      <textarea
                        value={lessonNotes[modal.id] ?? lesson?.notes ?? ''}
                        onChange={(e) => setLessonNotes(prev => ({ ...prev, [modal.id]: e.target.value }))}
                        placeholder="Введіть нотатки до заняття"
                        rows={3}
                        disabled={savingNotes[modal.id]}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.875rem',
                          border: '1px solid #3b82f6',
                          borderRadius: '0.375rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          backgroundColor: savingNotes[modal.id] ? '#f9fafb' : 'white',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          onClick={() => saveNotes(modal.id)}
                          disabled={savingNotes[modal.id]}
                          className="btn btn-primary"
                          style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                        >
                          {savingNotes[modal.id] ? 'Збереження...' : 'Зберегти'}
                        </button>
                        <button
                          onClick={() => cancelEditingNotes(modal.id)}
                          disabled={savingNotes[modal.id]}
                          className="btn"
                          style={{ 
                            flex: 1, 
                            justifyContent: 'center', 
                            background: '#f3f4f6', 
                            border: '1px solid #d1d5db',
                            fontSize: '0.8125rem', 
                            padding: '0.375rem 0.75rem' 
                          }}
                        >
                          Скасувати
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '0.5rem 0.75rem', 
                      fontSize: '0.875rem', 
                      color: (lessonNotes[modal.id] ?? lesson?.notes) ? '#374151' : '#9ca3af',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.375rem',
                      border: '1px solid #e5e7eb',
                      minHeight: '2.375rem',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {(lessonNotes[modal.id] ?? lesson?.notes) || 'Нотатки відсутні'}
                    </div>
                  )}
                </div>
                
                {/* Attendance section */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Відвідуваність
                    {attendanceLoading[modal.id] && <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>Завантаження...</span>}
                  </div>
                  
                  {attendance[modal.id] && attendance[modal.id].length > 0 ? (
                    <div style={{ 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '0.5rem', 
                      overflow: 'hidden',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {attendance[modal.id].map((att, idx) => (
                        <div 
                          key={att.student_id}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.75rem',
                            borderBottom: idx < attendance[modal.id].length - 1 ? '1px solid #e5e7eb' : 'none',
                            backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb'
                          }}
                        >
                          <span style={{ fontSize: '0.8125rem', color: '#374151' }}>
                            {att.student_name}
                          </span>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              onClick={() => setStudentAttendance(modal.id, att.student_id, 'present')}
                              disabled={attendanceSaving[modal.id]}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                padding: 0,
                                border: '1px solid',
                                borderColor: att.status === 'present' ? '#22c55e' : '#d1d5db',
                                borderRadius: '0.25rem',
                                backgroundColor: att.status === 'present' ? '#dcfce7' : 'white',
                                color: att.status === 'present' ? '#16a34a' : '#6b7280',
                                cursor: attendanceSaving[modal.id] ? 'not-allowed' : 'pointer',
                                opacity: attendanceSaving[modal.id] ? 0.5 : 1,
                                transition: 'all 0.15s ease',
                              }}
                              title="Присутній"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setStudentAttendance(modal.id, att.student_id, 'absent')}
                              disabled={attendanceSaving[modal.id]}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                padding: 0,
                                border: '1px solid',
                                borderColor: att.status === 'absent' ? '#ef4444' : '#d1d5db',
                                borderRadius: '0.25rem',
                                backgroundColor: att.status === 'absent' ? '#fee2e2' : 'white',
                                color: att.status === 'absent' ? '#dc2626' : '#6b7280',
                                cursor: attendanceSaving[modal.id] ? 'not-allowed' : 'pointer',
                                opacity: attendanceSaving[modal.id] ? 0.5 : 1,
                                transition: 'all 0.15s ease',
                              }}
                              title="Відсутній"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !attendanceLoading[modal.id] ? (
                    <div style={{ 
                      padding: '0.75rem', 
                      backgroundColor: '#f9fafb', 
                      borderRadius: '0.5rem',
                      color: '#6b7280',
                      fontSize: '0.8125rem',
                      textAlign: 'center'
                    }}>
                      Немає студентів у групі
                    </div>
                  ) : null}
                </div>
                
                {/* Actions - removed "Проведено" and "Скасовано" buttons, status is now auto-set based on attendance */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.25rem' }}>
                  {/* Delete button - only for scheduled lessons - MOVED TO HEADER */}
                  {/* Old delete button removed - now in header */}
                </div>
                
                {/* Submission info section */}
                <div style={{ 
                  marginTop: '1rem', 
                  paddingTop: '1rem', 
                  borderTop: '1px solid #e5e7eb',
                }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Інформація про передачу даних
                  </div>
                  
                  {/* Calculate the latest transfer info */}
                  {(() => {
                    const topicDate = lesson?.topicSetAt ? new Date(lesson.topicSetAt.replace(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})/, '$3-$2-$1T$4:$5:00')) : null;
                    const notesDate = lesson?.notesSetAt ? new Date(lesson.notesSetAt.replace(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})/, '$3-$2-$1T$4:$5:00')) : null;
                    
                    const hasTopicData = lesson?.topicSetBy || lesson?.topicSetAt;
                    const hasNotesData = lesson?.notesSetBy || lesson?.notesSetAt;
                    
                    if (!hasTopicData && !hasNotesData) {
                      return (
                        <div style={{ 
                          fontSize: '0.8125rem', 
                          color: '#9ca3af',
                          fontStyle: 'italic',
                        }}>
                          Дані ще не надані
                        </div>
                      );
                    }
                    
                    // Determine which one is more recent or use whichever is available
                    let dataSetBy: string | null = null;
                    let dataSetAt: string | null = null;
                    let dataSetByTelegramId: string | null = null;
                    
                    if (topicDate && notesDate) {
                      if (topicDate >= notesDate) {
                        dataSetBy = lesson.topicSetBy;
                        dataSetAt = lesson.topicSetAt;
                        dataSetByTelegramId = lesson.topicSetByTelegramId || null;
                      } else {
                        dataSetBy = lesson.notesSetBy;
                        dataSetAt = lesson.notesSetAt;
                        dataSetByTelegramId = lesson.notesSetByTelegramId || null;
                      }
                    } else if (topicDate) {
                      dataSetBy = lesson.topicSetBy;
                      dataSetAt = lesson.topicSetAt;
                      dataSetByTelegramId = lesson.topicSetByTelegramId || null;
                    } else if (notesDate) {
                      dataSetBy = lesson.notesSetBy;
                      dataSetAt = lesson.notesSetAt;
                      dataSetByTelegramId = lesson.notesSetByTelegramId || null;
                    }
                    
                    return (
                      <div style={{ fontSize: '0.8125rem', color: '#374151' }}>
                        {dataSetBy && dataSetAt ? (
                          <span>
                            <span style={{ color: '#6b7280' }}>Дані передано:</span>{' '}
                            <span style={{ fontWeight: 500 }}>{dataSetBy}</span>
                            {dataSetByTelegramId && (
                              <span style={{ color: '#9ca3af' }}> (чий id телеграма був використаний)</span>
                            )}
                            <span style={{ color: '#9ca3af', marginLeft: '0.5rem' }}>{dataSetAt}</span>
                          </span>
                        ) : dataSetAt ? (
                          <span style={{ color: '#6b7280' }}>Дані передано: {dataSetAt}</span>
                        ) : null}
                      </div>
                    );
                  })()}
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
