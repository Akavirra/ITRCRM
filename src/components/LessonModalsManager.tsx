'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DraggableModal from './DraggableModal';
import { useLessonModals } from './LessonModalsContext';
import { useStudentModals } from './StudentModalsContext';
import { useGroupModals } from './GroupModalsContext';
import { useCourseModals } from './CourseModalsContext';
import { useTeacherModals } from './TeacherModalsContext';
import { useMediaViewer, type MediaFile } from './MediaViewerProvider';
import { Clock, BookOpen, User, Check, X, Calendar, Trash2, UserMinus, Users, MoreVertical, Edit2, Save, RefreshCw, ExternalLink, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import { getUploadErrorMessage, prepareImageFilesForUpload, uploadFileToMediaService } from '@/lib/client-photo-upload';
import { isVideoMimeType } from '@/lib/lesson-media';

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
  payment_status: 'paid' | 'partial' | 'unpaid' | null;
  payment_label: string | null;
}

interface LessonData {
  id: number;
  groupId: number | null;
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
  originalDate?: string | null;
  isRescheduled?: boolean;
  isMakeup?: boolean;
}

interface MakeupForItem {
  attendance_id: number;
  student_id: number;
  student_name: string;
  original_lesson_id: number;
  original_lesson_date: string;
  original_start_time: string | null;
  original_lesson_topic: string | null;
  original_group_id: number | null;
  original_group_title: string | null;
  original_course_title: string | null;
}

interface ChangeHistoryEntry {
  id: number;
  lesson_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: number | null;
  changed_by_name: string | null;
  changed_by_telegram_id: string | null;
  changed_via: string;
  created_at: string;
}

interface LessonPhotoFolder {
  id: string;
  name: string;
  url: string;
  exists: boolean;
}

interface LessonPhotoFile {
  id: number;
  driveFileId: string;
  url: string;
  downloadUrl: string;
  thumbnailUrl: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  uploadedAt: string;
  uploadedBy: string | null;
  uploadedVia: 'admin' | 'telegram';
}

function isVideoLessonMedia(photo: LessonPhotoFile): boolean {
  return isVideoMimeType(photo.mimeType);
}

function parseUploadedAt(value: string): Date | null {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, dd, mm, yyyy, hh, min] = match;
  const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isDriveVideoProcessing(photo: LessonPhotoFile, isPending: boolean = false, isReady: boolean = false): boolean {
  return isVideoLessonMedia(photo) && isPending && !isReady;
}

function toLessonMediaViewerFile(photo: LessonPhotoFile): MediaFile {
  return {
    id: photo.id,
    topic_id: 0,
    topic_name: 'Заняття',
    file_name: photo.fileName,
    file_type: isVideoLessonMedia(photo) ? 'video' : 'photo',
    file_size: photo.size ?? 0,
    drive_file_id: photo.driveFileId,
    drive_view_url: photo.url,
    drive_download_url: photo.downloadUrl,
    uploaded_by_name: photo.uploadedBy,
    created_at: photo.uploadedAt,
    media_width: null,
    media_height: null,
  };
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
  const { openModals, updateModalState, closeLessonModal, openLessonModal } = useLessonModals();
  const { openStudentModal } = useStudentModals();
  const { openGroupModal } = useGroupModals();
  const { openCourseModal } = useCourseModals();
  const { openTeacherModal } = useTeacherModals();
  const { openMediaViewer } = useMediaViewer();
  const [lessonData, setLessonData] = useState<Record<number, LessonData>>({});
  const [makeupForData, setMakeupForData] = useState<Record<number, MakeupForItem[]>>({});
  const [loadingLessons, setLoadingLessons] = useState<Record<number, boolean>>({});
  const loadingRef = useRef<Record<string, boolean>>({}); // Track loading state without causing re-renders
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Form state
  const [lessonTopic, setLessonTopic] = useState<Record<number, string>>({});
  const [lessonNotes, setLessonNotes] = useState<Record<number, string>>({});
  const [changeHistory, setChangeHistory] = useState<Record<number, ChangeHistoryEntry[]>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [savingTopic, setSavingTopic] = useState<Record<number, boolean>>({});
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({});
  const [editingTopic, setEditingTopic] = useState<Record<number, boolean>>({});
  const [editingNotes, setEditingNotes] = useState<Record<number, boolean>>({});
  // Refs for editing state - used by polling to avoid stale closures
  const editingTopicRef = useRef<Record<number, boolean>>({});
  const editingNotesRef = useRef<Record<number, boolean>>({});
  // Refs for current state values - prevent stale closures in polling intervals
  const lessonDataRef = useRef<Record<number, LessonData>>({});
  const lessonTopicRef = useRef<Record<number, string>>({});
  const lessonNotesRef = useRef<Record<number, string>>({});
  const [showActionsMenu, setShowActionsMenu] = useState<Record<number, boolean>>({});
  const [teachers, setTeachers] = useState<Record<number, Teacher[]>>({});
  const [showTeacherSelect, setShowTeacherSelect] = useState<Record<number, boolean>>({});
  const [selectedTeacherId, setSelectedTeacherId] = useState<Record<number, number | null>>({});
  const [replacementReason, setReplacementReason] = useState<Record<number, string>>({});
  const [teachersLoading, setTeachersLoading] = useState<Record<number, boolean>>({});
  
  // Reschedule state
  const [showRescheduleForm, setShowRescheduleForm] = useState<Record<number, boolean>>({});
  const [rescheduleData, setRescheduleData] = useState<Record<number, { newDate: string, newStartTime: string, newEndTime: string }>>({});
  
  // Attendance state
  const [attendance, setAttendance] = useState<Record<number, AttendanceRecord[]>>({});
  const [attendanceLoading, setAttendanceLoading] = useState<Record<number, boolean>>({});
  const [attendanceSaving, setAttendanceSaving] = useState<Record<number, boolean>>({});
  const [photoFolders, setPhotoFolders] = useState<Record<number, LessonPhotoFolder | null>>({});
  const [lessonPhotos, setLessonPhotos] = useState<Record<number, LessonPhotoFile[]>>({});
  const [canManagePhotos, setCanManagePhotos] = useState<Record<number, boolean>>({});
  const [showAllPhotos, setShowAllPhotos] = useState<Record<number, boolean>>({});
  const [photoUploading, setPhotoUploading] = useState<Record<number, boolean>>({});
  const [photoUploadProgress, setPhotoUploadProgress] = useState<Record<number, { current: number; total: number } | null>>({});
  const [photoDeleting, setPhotoDeleting] = useState<Record<number, number | null>>({});
  const [readyLessonVideos, setReadyLessonVideos] = useState<Record<number, boolean>>({});
  const [processingLessonVideos, setProcessingLessonVideos] = useState<Record<number, boolean>>({});

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
        // Update local attendance state
        const updatedAttendance = (attendance[lessonId] || []).map(a =>
          a.student_id === studentId ? { ...a, status } : a
        );
        setAttendance(prev => ({ ...prev, [lessonId]: updatedAttendance }));

        // Re-fetch lesson to get the actual status set by the backend
        // (backend may have auto-cancelled or auto-done the lesson)
        const lessonResponse = await fetch(`/api/lessons/${lessonId}`);
        if (lessonResponse.ok) {
          const lessonDataRes = await lessonResponse.json();
          setLessonData(prev => ({ ...prev, [lessonId]: lessonDataRes.lesson }));
          updateModalState(lessonId, { lessonData: lessonDataRes.lesson });
        }

        // Notify schedule page to silently refresh
        window.dispatchEvent(new Event('itrobot-lesson-updated'));
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

  // Listen for open-lesson events dispatched from notification panel or elsewhere
  useEffect(() => {
    const handler = (e: Event) => {
      const { lessonId } = (e as CustomEvent<{ lessonId: number }>).detail;
      if (lessonId) openLessonModal(lessonId, `Заняття #${lessonId}`, undefined);
    };
    window.addEventListener('itrobot-open-lesson', handler);
    return () => window.removeEventListener('itrobot-open-lesson', handler);
  }, [openLessonModal]);

  // Keep refs in sync with state so polling intervals always read current values
  useEffect(() => { lessonDataRef.current = lessonData; }, [lessonData]);
  useEffect(() => { lessonTopicRef.current = lessonTopic; }, [lessonTopic]);
  useEffect(() => { lessonNotesRef.current = lessonNotes; }, [lessonNotes]);

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
      if (response.status === 404) {
        // Lesson no longer exists — close the stale modal
        closeLessonModal(lessonId);
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
        if (data.makeupFor) {
          setMakeupForData(prev => ({ ...prev, [lessonId]: data.makeupFor }));
        }
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
        // Only update the editable fields if user is not actively editing them
        if (!editingTopicRef.current[lessonId]) {
          setLessonTopic(prev => ({ ...prev, [lessonId]: data.lesson.topic || '' }));
        }
        if (!editingNotesRef.current[lessonId]) {
          setLessonNotes(prev => ({ ...prev, [lessonId]: data.lesson.notes || '' }));
        }
        
        // Update change history if available
        if (data.changeHistory) {
          setChangeHistory(prev => ({ ...prev, [lessonId]: data.changeHistory }));
        }
        setPhotoFolders(prev => ({ ...prev, [lessonId]: data.photoFolder || null }));
        setLessonPhotos(prev => ({ ...prev, [lessonId]: data.photos || [] }));
        setCanManagePhotos(prev => ({ ...prev, [lessonId]: Boolean(data.canManagePhotos) }));
      }
    } catch (error) {
      console.error('Error loading lesson:', error);
    } finally {
      loadingRef.current[lessonId] = false;
      setLoadingLessons(prev => ({ ...prev, [lessonId]: false }));
    }
  }, [updateModalState]);

  // Keep loadLessonData ref in sync for use in effects/intervals
  const loadLessonDataRef = useRef(loadLessonData);
  useEffect(() => {
    loadLessonDataRef.current = loadLessonData;
  }, [loadLessonData]);

  const openLessonMediaGallery = useCallback((photos: LessonPhotoFile[], photoId: number) => {
    const visualFiles = photos.map(toLessonMediaViewerFile);
    const index = visualFiles.findIndex((photo) => photo.id === photoId);
    if (index !== -1) {
      openMediaViewer(visualFiles, index);
    }
  }, [openMediaViewer]);

  // Track which lesson IDs have been fetched since opening (reset when modal closes)
  const fetchedOnOpenRef = useRef<Set<number>>(new Set());

  // When a modal opens, always fetch fresh data from API immediately
  // (avoids showing stale localStorage data on open)
  useEffect(() => {
    openModals.forEach(modal => {
      if (!modal.isOpen || !modal.id || typeof modal.id !== 'number') return;

      if (!fetchedOnOpenRef.current.has(modal.id) && !loadingRef.current[modal.id]) {
        fetchedOnOpenRef.current.add(modal.id);
        loadLessonDataRef.current(modal.id);
        loadAttendance(modal.id);
      }
    });

    // Remove IDs for closed modals so they re-fetch when reopened
    const openIds = new Set(
      openModals.filter(m => m.isOpen && m.id).map(m => m.id as number)
    );
    for (const id of Array.from(fetchedOnOpenRef.current)) {
      if (!openIds.has(id)) fetchedOnOpenRef.current.delete(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Mark as done when topic is added, but only if still scheduled (don't override canceled)
      const statusUpdate = currentLessonData?.status === 'scheduled' ? { status: 'done' } : {};
      
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: newTopic, ...statusUpdate }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
        setLessonTopic(prev => ({ ...prev, [lessonId]: newTopic }));
        updateModalState(lessonId, {
          lessonData: {
            ...currentLessonData,
            topic: newTopic,
            status: data.lesson.status,
            topicSetBy: data.lesson.topicSetBy,
            topicSetAt: data.lesson.topicSetAt,
          }
        });
        if (data.changeHistory) {
          setChangeHistory(prev => ({ ...prev, [lessonId]: data.changeHistory }));
        }
        setPhotoFolders(prev => ({ ...prev, [lessonId]: data.photoFolder || null }));
        setLessonPhotos(prev => ({ ...prev, [lessonId]: data.photos || [] }));
        setCanManagePhotos(prev => ({ ...prev, [lessonId]: Boolean(data.canManagePhotos) }));
        window.dispatchEvent(new Event('itrobot-lesson-updated'));
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
      // Mark as done when notes are added, but only if still scheduled (don't override canceled)
      const statusUpdate = currentLessonData?.status === 'scheduled' ? { status: 'done' } : {};
      
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes, ...statusUpdate }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setLessonData(prev => ({ ...prev, [lessonId]: data.lesson }));
        // Also update local notes state
        setLessonNotes(prev => ({ ...prev, [lessonId]: newNotes }));
        updateModalState(lessonId, {
          lessonData: {
            ...currentLessonData,
            notes: newNotes,
            status: data.lesson.status,
            notesSetBy: data.lesson.notesSetBy,
            notesSetAt: data.lesson.notesSetAt,
          }
        });
        if (data.changeHistory) {
          setChangeHistory(prev => ({ ...prev, [lessonId]: data.changeHistory }));
        }
        setPhotoFolders(prev => ({ ...prev, [lessonId]: data.photoFolder || null }));
        setLessonPhotos(prev => ({ ...prev, [lessonId]: data.photos || [] }));
        setCanManagePhotos(prev => ({ ...prev, [lessonId]: Boolean(data.canManagePhotos) }));
        window.dispatchEvent(new Event('itrobot-lesson-updated'));
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

  const handlePhotoUpload = async (lessonId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setPhotoUploading(prev => ({ ...prev, [lessonId]: true }));
    setPhotoUploadProgress(prev => ({ ...prev, [lessonId]: { current: 0, total: files.length } }));

    try {
      const preparedFiles = await prepareImageFilesForUpload(Array.from(files));
      const videoFiles = preparedFiles.filter((file) => isVideoMimeType(file.type));
      const imageFiles = preparedFiles.filter((file) => !isVideoMimeType(file.type));
      const batches = imageFiles.map((file) => [file]);
      let latestData: { photoFolder?: LessonPhotoFolder | null; photos?: LessonPhotoFile[]; canManagePhotos?: boolean } | null = null;
      let uploadedCount = 0;
      let knownPhotoIds = new Set((lessonPhotos[lessonId] || []).map((photo) => photo.id));

      for (const file of videoFiles) {
        const startRes = await fetch(`/api/lessons/${lessonId}/photos/direct`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start',
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
          }),
        });

        const startData = await startRes.json().catch(() => ({}));
        if (!startRes.ok) {
          throw new Error(getUploadErrorMessage(startData, 'Не вдалося підготувати завантаження відео'));
        }

        latestData = await uploadFileToMediaService(startData.uploadUrl, startData.uploadToken, lessonId, file);
        const newVideoIds = (latestData.photos || [])
          .filter((photo) => isVideoLessonMedia(photo) && !knownPhotoIds.has(photo.id))
          .map((photo) => photo.id);

        if (newVideoIds.length > 0) {
          setProcessingLessonVideos((prev) => {
            const next = { ...prev };
            newVideoIds.forEach((photoId) => {
              next[photoId] = true;
            });
            return next;
          });
        }

        knownPhotoIds = new Set((latestData.photos || []).map((photo) => photo.id));
        uploadedCount += 1;
        setPhotoUploadProgress(prev => ({ ...prev, [lessonId]: { current: uploadedCount, total: preparedFiles.length } }));
      }

      for (const batch of batches) {
        const formData = new FormData();
        batch.forEach((file) => {
          formData.append('files', file);
        });

        const res = await fetch(`/api/lessons/${lessonId}/photos`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (res.status === 413) {
            throw new Error('Забагато фото за один пакет. Система може завантажувати їх частинами, але один із пакетів усе ще завеликий.');
          }
          throw new Error(getUploadErrorMessage(data, 'Не вдалося завантажити фото'));
        }

        latestData = data;
        uploadedCount += batch.length;
        setPhotoUploadProgress(prev => ({ ...prev, [lessonId]: { current: uploadedCount, total: preparedFiles.length } }));
      }

      setPhotoFolders(prev => ({ ...prev, [lessonId]: latestData?.photoFolder || null }));
      setLessonPhotos(prev => ({ ...prev, [lessonId]: latestData?.photos || [] }));
      setCanManagePhotos(prev => ({ ...prev, [lessonId]: Boolean(latestData?.canManagePhotos) }));
      await loadLessonDataRef.current(lessonId);
      window.dispatchEvent(new Event('itrobot-lesson-updated'));
    } catch (error) {
      console.error('Failed to upload lesson photos:', error);
      alert(error instanceof Error ? error.message : 'Не вдалося завантажити медіа');
    } finally {
      setPhotoUploading(prev => ({ ...prev, [lessonId]: false }));
      setPhotoUploadProgress(prev => ({ ...prev, [lessonId]: null }));
    }
  };

  const handlePhotoDelete = async (lessonId: number, photoId: number) => {
    if (!confirm('Видалити це медіа заняття?')) return;

    setPhotoDeleting(prev => ({ ...prev, [lessonId]: photoId }));

    try {
      const res = await fetch(`/api/lessons/${lessonId}/photos/${photoId}`, {
        method: 'DELETE',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Не вдалося видалити фото');
      }

      setLessonPhotos(prev => ({
        ...prev,
        [lessonId]: (prev[lessonId] || []).filter((photo) => photo.id !== photoId),
      }));
      setProcessingLessonVideos((prev) => {
        if (!(photoId in prev)) {
          return prev;
        }

        const next = { ...prev };
        delete next[photoId];
        return next;
      });
      setReadyLessonVideos((prev) => {
        if (!(photoId in prev)) {
          return prev;
        }

        const next = { ...prev };
        delete next[photoId];
        return next;
      });
      await loadLessonDataRef.current(lessonId);
    } catch (error) {
      console.error('Failed to delete lesson photo:', error);
      alert(error instanceof Error ? error.message : 'Не вдалося видалити фото');
    } finally {
      setPhotoDeleting(prev => ({ ...prev, [lessonId]: null }));
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
                
                // Read current values from refs (avoids stale closure problem)
                const currentLesson = lessonDataRef.current[modal.id];
                const localTopic = lessonTopicRef.current[modal.id] ?? '';
                const localNotes = lessonNotesRef.current[modal.id] ?? '';
                const currentLocalTopic = currentLesson?.topic || '';
                const currentLocalNotes = currentLesson?.notes || '';

                // Update lesson data (always update to get latest status, teacher info, etc.)
                setLessonData(prev => ({ ...prev, [modal.id]: serverLesson }));

                // Only update modal state if user is NOT editing
                const isEditing = editingTopicRef.current[modal.id] || editingNotesRef.current[modal.id];
                if (!isEditing) {
                  updateModalState(modal.id, {
                    lessonData: {
                      ...modal.lessonData,
                      ...serverLesson,
                    }
                  });
                }

                // Update local input state only when not editing and server has newer value
                if (!editingTopicRef.current[modal.id] && localTopic === currentLocalTopic && serverTopic !== localTopic) {
                  setLessonTopic(prev => ({ ...prev, [modal.id]: serverTopic }));
                }
                if (!editingNotesRef.current[modal.id] && localNotes === currentLocalNotes && serverNotes !== localNotes) {
                  setLessonNotes(prev => ({ ...prev, [modal.id]: serverNotes }));
                }

                // Update change history (used by "Інформація про передачу даних")
                  if (data.changeHistory) {
                    setChangeHistory(prev => ({ ...prev, [modal.id]: data.changeHistory }));
                  }
                  setPhotoFolders(prev => ({ ...prev, [modal.id]: data.photoFolder || null }));
                  setLessonPhotos(prev => ({ ...prev, [modal.id]: data.photos || [] }));
                  setCanManagePhotos(prev => ({ ...prev, [modal.id]: Boolean(data.canManagePhotos) }));

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
        window.dispatchEvent(new Event('itrobot-lesson-updated'));
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
        updateModalState(lessonId, {
          lessonData: {
            ...lessonData[lessonId],
            status: 'done',
          }
        });
        window.dispatchEvent(new Event('itrobot-lesson-updated'));
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

  const handleReschedule = async (lessonId: number) => {
    const data = rescheduleData[lessonId];
    if (!data || !data.newDate || !data.newStartTime || !data.newEndTime) {
      alert('Вкажіть дату та час');
      return;
    }
    
    setSaving(prev => ({ ...prev, [lessonId]: true }));
    try {
      const res = await fetch(`/api/lessons/${lessonId}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (res.ok) {
        const result = await res.json();
        setLessonData(prev => ({ ...prev, [lessonId]: result.lesson }));
        setShowRescheduleForm(prev => ({ ...prev, [lessonId]: false }));
        // Dispatch event to notify schedule page to refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('itrobot-lesson-updated'));
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Не вдалося перенести заняття');
      }
    } catch (error) {
      console.error('Failed to reschedule:', error);
      alert('Не вдалося перенести заняття');
    } finally {
      setSaving(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  const handleRescheduleFromCanceled = async (lessonId: number, lesson: NonNullable<typeof lessonData[number]>) => {
    setShowActionsMenu(prev => ({ ...prev, [lessonId]: false }));

    const isMakeup = !!(lesson as any).isMakeup;
    const isGroup = !!lesson.groupId && !isMakeup;

    if (isGroup) {
      // Group: reuse existing inline reschedule form (backend resets status to 'scheduled')
      setRescheduleData(prev => ({
        ...prev,
        [lessonId]: {
          newDate: new Date().toISOString().split('T')[0],
          newStartTime: lesson.startTime || '10:00',
          newEndTime: lesson.endTime || '11:30',
        },
      }));
      setShowRescheduleForm(prev => ({ ...prev, [lessonId]: true }));
      return;
    }

    // Individual / makeup: call prep-reschedule to get data, then open CreateLessonModal
    setSaving(prev => ({ ...prev, [lessonId]: true }));
    try {
      const res = await fetch(`/api/lessons/${lessonId}/prep-reschedule`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Не вдалося підготувати перенесення');
        return;
      }
      window.dispatchEvent(new CustomEvent('itrobot-open-create-lesson', {
        detail: {
          tab: isMakeup ? 'makeup' : 'lesson',
          teacherId: data.teacherId ?? null,
          courseId: data.courseId ?? null,
          studentIds: data.studentIds ?? [],
          absenceIds: data.absenceIds ?? [],
        },
      }));
    } catch {
      alert('Не вдалося підготувати перенесення');
    } finally {
      setSaving(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  if (!isHydrated || openModals.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes lmm-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40%            { transform: translateY(-3px); opacity: 1; }
        }
        @keyframes lmm-skeleton {
          0%   { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
        .spin {
          animation: lmm-spin 1s linear infinite;
        }
        @keyframes lmm-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .lmm-skeleton {
          background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
          background-size: 400px 100%;
          animation: lmm-skeleton 1.4s ease infinite;
          border-radius: 0.25rem;
        }
      `}</style>
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
            title={(lesson?.isMakeup ?? (modal.lessonData as any)?.isMakeup) ? 'Відпрацювання' : (lesson?.groupId ?? (modal.lessonData as any)?.groupId) ? 'Групове заняття' : 'Індивідуальне заняття'}
            groupUrl={lesson?.groupId ? `/groups/${lesson.groupId}` : undefined}
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
                      {lesson?.status === 'canceled' && (
                        <>
                          <button
                            onClick={() => lesson && handleRescheduleFromCanceled(modal.id, lesson)}
                            disabled={isSaving}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              width: '100%',
                              padding: '0.625rem 0.75rem',
                              fontSize: '0.8125rem',
                              color: '#3b82f6',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: isSaving ? 'not-allowed' : 'pointer',
                              textAlign: 'left',
                              opacity: isSaving ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Calendar size={14} />
                            Перенести заняття
                          </button>
                          <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0' }} />
                        </>
                      )}

                      {lesson?.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => {
                              setShowActionsMenu(prev => ({ ...prev, [modal.id]: false }));
                              // Default to today if lesson date isn't directly available
                              const defaultDate = new Date().toISOString().split('T')[0];
                              setRescheduleData(prev => ({
                                ...prev,
                                [modal.id]: {
                                  newDate: defaultDate,
                                  newStartTime: lesson.startTime || '10:00',
                                  newEndTime: lesson.endTime || '11:30'
                                }
                              }));
                              setShowRescheduleForm(prev => ({ ...prev, [modal.id]: true }));
                              setShowTeacherSelect(prev => ({ ...prev, [modal.id]: false }));
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              width: '100%',
                              padding: '0.625rem 0.75rem',
                              fontSize: '0.8125rem',
                              color: '#3b82f6',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Calendar size={14} />
                            Перенести заняття
                          </button>
                          
                          <button
                            onClick={() => {
                              setShowActionsMenu(prev => ({ ...prev, [modal.id]: false }));
                              setShowRescheduleForm(prev => ({ ...prev, [modal.id]: false }));
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
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="lmm-skeleton" style={{ width: '40%', height: '20px' }} />
                <div className="lmm-skeleton" style={{ width: '70%', height: '14px' }} />
                <div className="lmm-skeleton" style={{ width: '55%', height: '14px' }} />
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="lmm-skeleton" style={{ width: `${50 + i * 10}px`, height: '12px' }} />
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <div className="lmm-skeleton" style={{ width: '28px', height: '28px', borderRadius: '0.25rem' }} />
                        <div className="lmm-skeleton" style={{ width: '28px', height: '28px', borderRadius: '0.25rem' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : lesson ? (
              <div style={{ padding: '1.25rem', overflow: 'auto', height: '100%' }}>
                {/* Status badge + makeup badge */}
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {lesson.isMakeup && (
                    <span style={{
                      background: '#fff7ed', color: '#c2410c',
                      border: '1px solid #fed7aa', borderRadius: '0.25rem',
                      fontSize: '0.6875rem', fontWeight: 700,
                      padding: '0.25rem 0.5rem',
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      textTransform: 'uppercase', letterSpacing: '0.4px',
                    }}>
                      <RefreshCw size={9} />
                      Відпрацювання
                    </span>
                  )}
                  {getStatusBadge(lesson.status)}
                </div>

                {false && (() => {
                  const allLessonPhotos = lessonPhotos[modal.id] || [];
                  const isPhotosExpanded = Boolean(showAllPhotos[modal.id]);
                  const visibleLessonPhotos = isPhotosExpanded ? allLessonPhotos : allLessonPhotos.slice(0, 3);
                  const hiddenPhotosCount = Math.max(0, allLessonPhotos.length - visibleLessonPhotos.length);
                  const compactDriveProcessingUi = (modal.size?.width ?? 640) < 560;

                  return lesson?.groupId !== null && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <ImageIcon size={12} />
                          Фото заняття
                        </div>
                        {photoFolders[modal.id]?.url && (
                          <a
                            href={photoFolders[modal.id]!.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '0.75rem', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                          >
                            <ExternalLink size={12} />
                            Папка на Drive
                          </a>
                        )}
                      </div>

                      {!lesson?.topic && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#9a3412',
                          background: '#fff7ed',
                          border: '1px solid #fed7aa',
                          borderRadius: '0.5rem',
                          padding: '0.625rem 0.75rem',
                          marginBottom: '0.75rem',
                          lineHeight: 1.5,
                        }}>
                          Папка заняття буде створена з тимчасовою назвою <strong>Без теми</strong>, а після збереження теми автоматично перейменується.
                        </div>
                      )}

                      <div style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        background: '#fafafa',
                      }}>
                        {canManagePhotos[modal.id] && (
                          <>
                            <label style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              padding: '0.625rem 0.75rem',
                              border: '1px dashed #93c5fd',
                              borderRadius: '0.5rem',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              cursor: photoUploading[modal.id] ? 'not-allowed' : 'pointer',
                              opacity: photoUploading[modal.id] ? 0.7 : 1,
                              marginBottom: photoUploadProgress[modal.id] ? '0.5rem' : '0.75rem',
                            }}>
                              {photoUploading[modal.id] ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                              <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                                {photoUploading[modal.id]
                                  ? `Завантаження ${photoUploadProgress[modal.id]?.current ?? 0} з ${photoUploadProgress[modal.id]?.total ?? 0}`
                                  : 'Додати фото'}
                              </span>
                              <input
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                disabled={photoUploading[modal.id]}
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  handlePhotoUpload(modal.id, e.target.files);
                                  e.currentTarget.value = '';
                                }}
                              />
                            </label>
                          </>
                        )}

                        {allLessonPhotos.length > 0 ? (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}>
                              {visibleLessonPhotos.map((photo) => (
                                <div key={photo.id} style={{ position: 'relative' }}>
                                    {isVideoLessonMedia(photo) ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => openLessonMediaGallery(allLessonPhotos, photo.id)}
                                          style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                        >
                                          <video
                                            src={photo.downloadUrl}
                                            preload="metadata"
                                            muted
                                            onLoadedData={() => {
                                              setReadyLessonVideos((prev) => prev[photo.id] ? prev : { ...prev, [photo.id]: true });
                                              setProcessingLessonVideos((prev) => {
                                                if (!prev[photo.id]) {
                                                  return prev;
                                                }

                                                const next = { ...prev };
                                                delete next[photo.id];
                                                return next;
                                              });
                                            }}
                                            onCanPlay={() => {
                                              setReadyLessonVideos((prev) => prev[photo.id] ? prev : { ...prev, [photo.id]: true });
                                              setProcessingLessonVideos((prev) => {
                                                if (!prev[photo.id]) {
                                                  return prev;
                                                }

                                                const next = { ...prev };
                                                delete next[photo.id];
                                                return next;
                                              });
                                            }}
                                            style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid #e5e7eb', display: 'block', background: '#000' }}
                                          />
                                        </button>
                                        {isDriveVideoProcessing(photo, Boolean(processingLessonVideos[photo.id]), Boolean(readyLessonVideos[photo.id])) && (
                                          <div style={{
                                            position: 'absolute',
                                            inset: '0',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.375rem',
                                            background: 'rgba(17, 24, 39, 0.68)',
                                            color: 'white',
                                            borderRadius: '0.5rem',
                                            textAlign: 'center',
                                            padding: '0.75rem',
                                            pointerEvents: 'none',
                                          }}>
                                            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                            {!compactDriveProcessingUi && (
                                              <>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Google Drive обробляє відео</div>
                                                <div style={{ fontSize: '0.6875rem', opacity: 0.9 }}>Попередній перегляд може зʼявитися не одразу</div>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openLessonMediaGallery(allLessonPhotos, photo.id)}
                                        style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                      >
                                        <img
                                          src={photo.thumbnailUrl}
                                          alt={photo.fileName}
                                          style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid #e5e7eb', display: 'block' }}
                                        />
                                      </button>
                                    )}
                                  {canManagePhotos[modal.id] && (
                                    <button
                                      onClick={() => handlePhotoDelete(modal.id, photo.id)}
                                      disabled={photoDeleting[modal.id] === photo.id}
                                      title="Видалити фото"
                                      style={{
                                        position: 'absolute',
                                        top: '0.35rem',
                                        right: '0.35rem',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '999px',
                                        border: 'none',
                                        background: 'rgba(17, 24, 39, 0.8)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {photoDeleting[modal.id] === photo.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            {allLessonPhotos.length > 3 && (
                              <button
                                onClick={() => setShowAllPhotos((prev) => ({ ...prev, [modal.id]: !prev[modal.id] }))}
                                style={{
                                  marginTop: '0.75rem',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: '0.5rem',
                                  border: '1px solid #dbeafe',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  fontSize: '0.8125rem',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                }}
                              >
                                {isPhotosExpanded ? 'Сховати зайві фото' : `Показати ще ${allLessonPhotos.length - 3} фото`}
                              </button>
                            )}
                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                              Завантажено фото: {allLessonPhotos.length}
                              {hiddenPhotosCount > 0 && !isPhotosExpanded ? `, у треї ще ${hiddenPhotosCount}` : ''}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '0.8125rem', color: '#9ca3af', fontStyle: 'italic' }}>
                            Фото заняття ще не завантажені.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Makeup: which original lessons are being covered */}
                {lesson.isMakeup && (() => {
                  const items = makeupForData[modal.id] || [];
                  if (items.length === 0) return null;

                  // Group by student
                  const byStudent: Record<number, { name: string; items: MakeupForItem[] }> = {};
                  for (const item of items) {
                    if (!byStudent[item.student_id]) {
                      byStudent[item.student_id] = { name: item.student_name, items: [] };
                    }
                    byStudent[item.student_id].items.push(item);
                  }

                  return (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                        За які заняття
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {Object.values(byStudent).map((group) => (
                          <div key={group.name} style={{ borderLeft: '2px solid #fb923c', paddingLeft: '0.625rem' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <User size={11} style={{ color: '#9ca3af' }} />
                              {group.name}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                              {group.items.map(item => {
                                const dateStr = item.original_lesson_date.slice(0, 10);
                                const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
                                const context = [item.original_group_title, item.original_course_title].filter(Boolean).join(' / ');
                                return (
                                  <div key={item.attendance_id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                        {dateLabel}{item.original_start_time ? `, ${item.original_start_time}` : ''}{context ? ` · ${context}` : ''}
                                      </div>
                                      {item.original_lesson_topic ? (
                                        <div style={{ fontSize: '0.75rem', color: '#374151', marginTop: '0.125rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem' }}>
                                          <BookOpen size={10} style={{ color: '#9ca3af', marginTop: '0.2rem', flexShrink: 0 }} />
                                          <span>{item.original_lesson_topic}</span>
                                        </div>
                                      ) : (
                                        <div style={{ fontSize: '0.75rem', color: '#d1d5db', marginTop: '0.125rem', fontStyle: 'italic' }}>
                                          Тема не вказана
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => openLessonModal(item.original_lesson_id, `Заняття #${item.original_lesson_id}`, undefined)}
                                      title="Відкрити заняття"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fb923c', padding: '0.125rem', display: 'flex', flexShrink: 0, marginTop: '0.125rem' }}
                                    >
                                      <ExternalLink size={12} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {lesson.groupId && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>Група</div>
                  <button
                    onClick={() => lesson.groupId && openGroupModal(lesson.groupId, lesson.groupTitle)}
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
                )}
                
                {!lesson.isMakeup && (
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
                )}
                
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
                
                {showRescheduleForm[modal.id] ? (
                  <div style={{ 
                    marginBottom: '1rem', 
                    padding: '1rem', 
                    background: '#f0fdf4', 
                    borderRadius: '0.5rem',
                    border: '1px solid #bbf7d0'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534', marginBottom: '0.5rem' }}>
                      Перенесення заняття
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.6875rem', color: '#166534', marginBottom: '0.25rem' }}>Дата</label>
                        <input
                          type="date"
                          value={rescheduleData[modal.id]?.newDate || ''}
                          onChange={(e) => setRescheduleData(prev => ({ ...prev, [modal.id]: { ...prev[modal.id], newDate: e.target.value } }))}
                          style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem', border: '1px solid #86efac', borderRadius: '0.375rem' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.6875rem', color: '#166534', marginBottom: '0.25rem' }}>Початок</label>
                          <input
                            type="time"
                            value={rescheduleData[modal.id]?.newStartTime || ''}
                            onChange={(e) => setRescheduleData(prev => ({ ...prev, [modal.id]: { ...prev[modal.id], newStartTime: e.target.value } }))}
                            style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem', border: '1px solid #86efac', borderRadius: '0.375rem' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.6875rem', color: '#166534', marginBottom: '0.25rem' }}>Кінець</label>
                          <input
                            type="time"
                            value={rescheduleData[modal.id]?.newEndTime || ''}
                            onChange={(e) => setRescheduleData(prev => ({ ...prev, [modal.id]: { ...prev[modal.id], newEndTime: e.target.value } }))}
                            style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem', border: '1px solid #86efac', borderRadius: '0.375rem' }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleReschedule(modal.id)}
                        disabled={isSaving}
                        className="btn btn-primary"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem', padding: '0.375rem', background: '#16a34a', borderColor: '#16a34a' }}
                      >
                        {isSaving ? 'Збереження...' : 'Перенести'}
                      </button>
                      <button
                        onClick={() => setShowRescheduleForm(prev => ({ ...prev, [modal.id]: false }))}
                        className="btn"
                        style={{ flex: 1, justifyContent: 'center', background: 'white', border: '1px solid #86efac', color: '#166534', fontSize: '0.8125rem', padding: '0.375rem' }}
                      >
                        Скасувати
                      </button>
                    </div>
                  </div>
                ) : null}

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>Час</div>
                  <div style={{ fontSize: '0.875rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Clock size={14} />
                    {formatDateTime(lesson.startTime, lesson.endTime)}
                  </div>
                  {lesson.isRescheduled && lesson.originalDate && (
                    <div style={{
                      marginTop: '0.25rem',
                      fontSize: '0.75rem',
                      color: '#7c3aed',
                      background: '#f5f3ff',
                      border: '1px solid #ddd6fe',
                      borderRadius: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}>
                      <RefreshCw size={10} />
                      Перенесено з {lesson.originalDate}
                    </div>
                  )}
                </div>
                
                {/* Topic field — hidden for makeup lessons (topic lives on the original lessons) */}
                {!lesson.isMakeup && (<div style={{ marginBottom: '1rem' }}>
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
                </div>)}

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
                
                {false ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <ImageIcon size={12} />
                        Фото заняття
                      </div>
                      {photoFolders[modal.id]?.url && (
                        <a
                          href={photoFolders[modal.id]!.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.75rem', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                        >
                          <ExternalLink size={12} />
                          Папка на Drive
                        </a>
                      )}
                    </div>

                    {!lesson?.topic && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#9a3412',
                        background: '#fff7ed',
                        border: '1px solid #fed7aa',
                        borderRadius: '0.5rem',
                        padding: '0.625rem 0.75rem',
                        marginBottom: '0.5rem',
                      }}>
                        Тема ще не вказана. Папка заняття буде створена з тимчасовою назвою "Без теми" і автоматично перейменується після збереження теми.
                      </div>
                    )}

                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      background: '#fafafa',
                    }}>
                      {canManagePhotos[modal.id] && (
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          padding: '0.625rem 0.75rem',
                          border: '1px dashed #93c5fd',
                          borderRadius: '0.5rem',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          cursor: photoUploading[modal.id] ? 'not-allowed' : 'pointer',
                          opacity: photoUploading[modal.id] ? 0.7 : 1,
                          marginBottom: '0.75rem',
                        }}>
                          {photoUploading[modal.id] ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                          <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                            {photoUploading[modal.id] ? 'Завантаження...' : 'Додати фото'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            disabled={photoUploading[modal.id]}
                            onChange={(e) => {
                              handlePhotoUpload(modal.id, e.target.files);
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>
                      )}

                      {lessonPhotos[modal.id] && lessonPhotos[modal.id].length > 0 ? (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}>
                            {lessonPhotos[modal.id].map((photo) => (
                              <div key={photo.id} style={{ position: 'relative' }}>
                                <a href={photo.url} target="_blank" rel="noreferrer">
                                  <img
                                    src={photo.thumbnailUrl}
                                    alt={photo.fileName}
                                    style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid #e5e7eb', display: 'block' }}
                                  />
                                </a>
                                {canManagePhotos[modal.id] && (
                                  <button
                                    onClick={() => handlePhotoDelete(modal.id, photo.id)}
                                    disabled={photoDeleting[modal.id] === photo.id}
                                    title="Видалити фото"
                                    style={{
                                      position: 'absolute',
                                      top: '0.35rem',
                                      right: '0.35rem',
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '999px',
                                      border: 'none',
                                      background: 'rgba(17, 24, 39, 0.8)',
                                      color: 'white',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {photoDeleting[modal.id] === photo.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                            Завантажено фото: {lessonPhotos[modal.id].length}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '0.8125rem', color: '#9ca3af', fontStyle: 'italic' }}>
                          Фото заняття ще не завантажені.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Attendance section */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    Відвідуваність
                    {/* Show 3-dot pulse only during background refresh (data already loaded) */}
                    {attendanceLoading[modal.id] && attendance[modal.id] && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        {[0, 1, 2].map(i => (
                          <span key={i} style={{
                            width: '3px', height: '3px', borderRadius: '50%',
                            background: '#9ca3af',
                            display: 'inline-block',
                            animation: `lmm-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                          }} />
                        ))}
                      </span>
                    )}
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' as const, flex: 1, minWidth: 0 }}>
                            <button
                              onClick={() => openStudentModal(att.student_id, att.student_name)}
                              style={{ fontSize: '0.8125rem', color: '#374151', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#2563eb'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = '#374151'; }}
                              title={`Відкрити профіль: ${att.student_name}`}
                            >
                              {att.student_name}
                            </button>
                            {att.status !== 'makeup_done' && att.status !== 'makeup_planned' && att.payment_status === 'paid' && (
                              <span style={{ padding: '1px 5px', borderRadius: 4, backgroundColor: '#dcfce7', color: '#16a34a', fontSize: '0.5625rem', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                                Оплачено
                              </span>
                            )}
                            {att.status !== 'makeup_done' && att.status !== 'makeup_planned' && att.payment_status === 'unpaid' && (
                              <span style={{ padding: '1px 5px', borderRadius: 4, backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.5625rem', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                                Не оплачено
                              </span>
                            )}
                            {att.status !== 'makeup_done' && att.status !== 'makeup_planned' && att.payment_status === 'partial' && (
                              <span style={{ padding: '1px 5px', borderRadius: 4, backgroundColor: '#fef9c3', color: '#a16207', fontSize: '0.5625rem', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                                Частково
                              </span>
                            )}
                            {att.status === 'makeup_done' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span style={{ padding: '1px 5px', borderRadius: 4, backgroundColor: '#fef9c3', color: '#a16207', fontSize: '0.5625rem', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                                  ↺ Відпрацьовано
                                </span>
                                {att.makeup_lesson_id && (
                                  <button
                                    onClick={() => openLessonModal(att.makeup_lesson_id!, `Заняття #${att.makeup_lesson_id}`, undefined)}
                                    title="Відкрити заняття відпрацювання"
                                    style={{ padding: '1px 5px', borderRadius: 4, backgroundColor: '#fefce8', border: '1px solid #fde047', color: '#a16207', fontSize: '0.5625rem', cursor: 'pointer', fontWeight: 500, lineHeight: 1.2 }}
                                  >
                                    →
                                  </button>
                                )}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
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
                                borderColor: att.status === 'makeup_done' ? '#f59e0b' : att.status === 'present' ? '#22c55e' : '#d1d5db',
                                borderRadius: '0.25rem',
                                backgroundColor: att.status === 'makeup_done' ? '#fef3c7' : att.status === 'present' ? '#dcfce7' : 'white',
                                color: att.status === 'makeup_done' ? '#d97706' : att.status === 'present' ? '#16a34a' : '#6b7280',
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
                  ) : attendanceLoading[modal.id] ? (
                    /* First-time skeleton — shown only before any data arrives */
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          borderBottom: i < 3 ? '1px solid #e5e7eb' : 'none',
                          backgroundColor: i % 2 === 0 ? '#f9fafb' : 'white',
                        }}>
                          <div className="lmm-skeleton" style={{ width: `${55 + i * 12}px`, height: '12px' }} />
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <div className="lmm-skeleton" style={{ width: '28px', height: '28px', borderRadius: '0.25rem' }} />
                            <div className="lmm-skeleton" style={{ width: '28px', height: '28px', borderRadius: '0.25rem' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
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
                  )}
                </div>
                
                {/* Actions - removed "Проведено" and "Скасовано" buttons, status is now auto-set based on attendance */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.25rem' }}>
                  {/* Delete button - only for scheduled lessons - MOVED TO HEADER */}
                  {/* Old delete button removed - now in header */}
                </div>
                
                {(() => {
                  const allLessonPhotos = lessonPhotos[modal.id] || [];
                  const isPhotosExpanded = Boolean(showAllPhotos[modal.id]);
                  const visibleLessonPhotos = isPhotosExpanded ? allLessonPhotos : allLessonPhotos.slice(0, 3);
                  const hiddenPhotosCount = Math.max(0, allLessonPhotos.length - visibleLessonPhotos.length);
                  const compactDriveProcessingUi = (modal.size?.width ?? 640) < 560;

                  return lesson.groupId !== null && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <ImageIcon size={12} />
                          Медіа заняття
                        </div>
                        {photoFolders[modal.id]?.url && (
                          <a
                            href={photoFolders[modal.id]!.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '0.75rem', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                          >
                            <ExternalLink size={12} />
                            Папка на Drive
                          </a>
                        )}
                      </div>

                      {!lesson?.topic && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#9a3412',
                          background: '#fff7ed',
                          border: '1px solid #fed7aa',
                          borderRadius: '0.5rem',
                          padding: '0.625rem 0.75rem',
                          marginBottom: '0.75rem',
                          lineHeight: 1.5,
                        }}>
                          Папка заняття буде створена з тимчасовою назвою <strong>Без теми</strong>, а після збереження теми автоматично перейменується.
                        </div>
                      )}

                      <div style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        background: '#fafafa',
                      }}>
                        {canManagePhotos[modal.id] && (
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.625rem 0.75rem',
                            border: '1px dashed #93c5fd',
                            borderRadius: '0.5rem',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            cursor: photoUploading[modal.id] ? 'not-allowed' : 'pointer',
                            opacity: photoUploading[modal.id] ? 0.7 : 1,
                            marginBottom: photoUploadProgress[modal.id] ? '0.5rem' : '0.75rem',
                          }}>
                            {photoUploading[modal.id] ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                              {photoUploading[modal.id]
                                ? `Завантаження ${photoUploadProgress[modal.id]?.current ?? 0} з ${photoUploadProgress[modal.id]?.total ?? 0}`
                                : 'Додати медіа'}
                            </span>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              multiple
                              style={{ display: 'none' }}
                              disabled={photoUploading[modal.id]}
                              onChange={(e) => {
                                handlePhotoUpload(modal.id, e.target.files);
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                        )}

                        {allLessonPhotos.length > 0 ? (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}>
                              {visibleLessonPhotos.map((photo) => (
                                <div key={photo.id} style={{ position: 'relative' }}>
                                  {isVideoLessonMedia(photo) ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => openLessonMediaGallery(allLessonPhotos, photo.id)}
                                        style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                      >
                                        <video
                                          src={photo.downloadUrl}
                                          preload="metadata"
                                          muted
                                          onLoadedData={() => {
                                            setReadyLessonVideos((prev) => prev[photo.id] ? prev : { ...prev, [photo.id]: true });
                                            setProcessingLessonVideos((prev) => {
                                              if (!prev[photo.id]) {
                                                return prev;
                                              }
                                              const next = { ...prev };
                                              delete next[photo.id];
                                              return next;
                                            });
                                          }}
                                          onCanPlay={() => {
                                            setReadyLessonVideos((prev) => prev[photo.id] ? prev : { ...prev, [photo.id]: true });
                                            setProcessingLessonVideos((prev) => {
                                              if (!prev[photo.id]) {
                                                return prev;
                                              }
                                              const next = { ...prev };
                                              delete next[photo.id];
                                              return next;
                                            });
                                          }}
                                          style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid #e5e7eb', display: 'block', background: '#000' }}
                                        />
                                      </button>
                                      {isDriveVideoProcessing(photo, Boolean(processingLessonVideos[photo.id]), Boolean(readyLessonVideos[photo.id])) && (
                                        <div style={{
                                          position: 'absolute',
                                          inset: '0',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '0.375rem',
                                          background: 'rgba(17, 24, 39, 0.68)',
                                          color: 'white',
                                          borderRadius: '0.5rem',
                                          textAlign: 'center',
                                          padding: '0.75rem',
                                          pointerEvents: 'none',
                                        }}>
                                          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                          {!compactDriveProcessingUi && (
                                            <>
                                              <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Google Drive обробляє відео</div>
                                              <div style={{ fontSize: '0.6875rem', opacity: 0.9 }}>Попередній перегляд може з’явитися не одразу</div>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openLessonMediaGallery(allLessonPhotos, photo.id)}
                                      style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                    >
                                      <img
                                        src={photo.thumbnailUrl}
                                        alt={photo.fileName}
                                        style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid #e5e7eb', display: 'block' }}
                                      />
                                    </button>
                                  )}
                                  {canManagePhotos[modal.id] && (
                                    <button
                                      onClick={() => handlePhotoDelete(modal.id, photo.id)}
                                      disabled={photoDeleting[modal.id] === photo.id}
                                      title="Видалити медіа"
                                      style={{
                                        position: 'absolute',
                                        top: '0.35rem',
                                        right: '0.35rem',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '999px',
                                        border: 'none',
                                        background: 'rgba(17, 24, 39, 0.8)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {photoDeleting[modal.id] === photo.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            {allLessonPhotos.length > 3 && (
                              <button
                                onClick={() => setShowAllPhotos((prev) => ({ ...prev, [modal.id]: !prev[modal.id] }))}
                                style={{
                                  marginTop: '0.75rem',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: '0.5rem',
                                  border: '1px solid #dbeafe',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  fontSize: '0.8125rem',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                }}
                              >
                                {isPhotosExpanded ? 'Сховати зайве медіа' : `Показати ще ${allLessonPhotos.length - 3} елементів`}
                              </button>
                            )}
                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                              Завантажено медіа: {allLessonPhotos.length}
                              {hiddenPhotosCount > 0 && !isPhotosExpanded ? `, у треї ще ${hiddenPhotosCount}` : ''}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '0.8125rem', color: '#9ca3af', fontStyle: 'italic' }}>
                            Медіа заняття ще не завантажені.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Submission info section */}
                <div style={{ 
                  marginTop: '1rem', 
                  paddingTop: '1rem', 
                  borderTop: '1px solid #e5e7eb',
                }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Інформація про передачу даних
                  </div>
                  
                  {/* Show change history if available, otherwise fall back to legacy fields */}
                  {changeHistory[modal.id] && changeHistory[modal.id].length > 0 ? (
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {changeHistory[modal.id].map((entry, idx) => (
                        <div 
                          key={entry.id || idx} 
                          style={{ 
                            fontSize: '0.8125rem', 
                            color: '#374151',
                            padding: '0.5rem',
                            marginBottom: '0.5rem',
                            backgroundColor: idx === 0 ? '#f0fdf4' : '#f9fafb',
                            borderRadius: '0.375rem',
                            border: '1px solid #e5e7eb'
                          }}
                        >
                          {entry.field_name === 'topic' && (
                            <div>
                              <span style={{ fontWeight: 500, color: '#059669' }}>Тема:</span> {entry.old_value || '(пусто)'} → {entry.new_value || '(пусто)'}
                            </div>
                          )}
                          {entry.field_name === 'notes' && (
                            <div>
                              <span style={{ fontWeight: 500, color: '#059669' }}>Нотатки:</span> {entry.old_value || '(пусто)'} → {entry.new_value || '(пусто)'}
                            </div>
                          )}
                          {entry.field_name === 'attendance' && (
                            <div>
                              <span style={{ fontWeight: 500, color: '#059669' }}>Відвідуваність:</span> {entry.new_value}
                            </div>
                          )}
                          {entry.field_name === 'photos' && (
                            <div>
                              <span style={{ fontWeight: 500, color: '#059669' }}>Фото:</span> {entry.new_value || entry.old_value}
                            </div>
                          )}
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            <span>{entry.changed_by_name || 'Невідомо'}</span>
                            {entry.changed_by_telegram_id && (
                              <span style={{ color: '#9ca3af' }}> (Telegram)</span>
                            )}
                            <span style={{ marginLeft: '0.5rem' }}>{entry.created_at}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Legacy display - single entry */
                    <div style={{ fontSize: '0.8125rem', color: '#374151' }}>
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
                          <div>
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
