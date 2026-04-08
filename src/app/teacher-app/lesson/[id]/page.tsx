'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTelegramInitData, useTelegramWebApp } from '@/components/TelegramWebAppProvider';
import { formatTimeKyiv, formatDateKyiv, formatDateTimeKyiv, getTodayKyivDateString, normalizeDateOnly } from '@/lib/date-utils';
import { getUploadErrorMessage, prepareImageFilesForUpload, uploadFileToMediaService } from '@/lib/client-photo-upload';
import { isVideoMimeType } from '@/lib/lesson-media';
import {
  CheckCircleIcon, ClipboardIcon, ClockIcon, RefreshIcon, UsersIcon,
  BookOpenIcon, AlertTriangleIcon, FileTextIcon, EditIcon, SaveIcon,
  ArrowLeftIcon, UploadIcon, CameraIcon, ChevronLeftIcon, ChevronRightIcon, XIcon, TrashIcon
} from '@/components/Icons';

interface Lesson {
  id: number;
  public_id: string;
  group_id: number | null;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  status: 'scheduled' | 'done' | 'canceled';
  topic: string | null;
  notes: string | null;
  reported_by: number | null;
  reported_by_name: string | null;
  reported_at: string | null;
  reported_via: string | null;
  is_makeup: boolean;
  group_title: string;
  course_title: string;
}

interface Student {
  id: number;
  full_name: string;
  student_public_id: string;
  attendance_status: 'present' | 'absent' | null;
  attendance_updated: string | null;
  original_lesson_id?: number | null;
  original_lesson_date?: string | null;
  original_lesson_topic?: string | null;
  original_group_title?: string | null;
  original_course_title?: string | null;
}

interface LessonData {
  lesson: Lesson;
  students: Student[];
  photoFolder?: {
    id: string;
    name: string;
    url: string;
    exists: boolean;
  } | null;
  photos?: LessonPhoto[];
  canManagePhotos?: boolean;
}

interface LessonPhoto {
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

interface PendingPhotoPreview {
  id: string;
  file: File;
  previewUrl: string;
}

function isVideoFile(file: File | LessonPhoto): boolean {
  const mimeType = 'mimeType' in file ? file.mimeType : file.type;
  return isVideoMimeType(mimeType);
}

function parseUploadedAt(value: string): Date | null {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, dd, mm, yyyy, hh, min] = match;
  const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isDriveVideoProcessing(photo: LessonPhoto, isPending: boolean = false, isReady: boolean = false): boolean {
  return isVideoFile(photo) && isPending && !isReady;
}

function getDrivePreviewEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

function getDriveLargeThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
}

function getLessonMediaStreamUrl(fileId: string): string {
  return `/api/lesson-media/${encodeURIComponent(fileId)}`;
}

export default function LessonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonId = params.id as string;
  const versionSuffix = searchParams.get('v') ? `?v=${encodeURIComponent(searchParams.get('v')!)}` : '';
  
  const { initData, isLoading: initLoading, error: initError } = useTelegramInitData();
  const { webApp, isInWebView } = useTelegramWebApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [editingTopic, setEditingTopic] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditableToday, setIsEditableToday] = useState(false);
  const [photoFolder, setPhotoFolder] = useState<LessonData['photoFolder']>(null);
  const [photos, setPhotos] = useState<LessonPhoto[]>([]);
  const [showAllUploadedPhotos, setShowAllUploadedPhotos] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhotoPreview[]>([]);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [readyVideoIds, setReadyVideoIds] = useState<Record<number, boolean>>({});
  const [processingVideoIds, setProcessingVideoIds] = useState<Record<number, boolean>>({});
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const pendingPhotosRef = useRef<PendingPhotoPreview[]>([]);
  const viewerTouchStartXRef = useRef<number | null>(null);
  const viewerTouchStartYRef = useRef<number | null>(null);
  const viewerVideoRef = useRef<HTMLVideoElement | null>(null);

  // Teachers can edit only today's lessons.
  useEffect(() => {
    if (lesson?.lesson_date) {
      setIsEditableToday(normalizeDateOnly(lesson.lesson_date) === getTodayKyivDateString());
    } else {
      setIsEditableToday(false);
    }
  }, [lesson?.lesson_date]);

  // Fetch lesson data
  useEffect(() => {
    const fetchLesson = async () => {
      // Wait for init data
      if (initLoading) {
        return;
      }

      if (!initData) {
        setError(!isInWebView 
          ? 'Р¦СЏ СЃС‚РѕСЂС–РЅРєР° РїСЂР°С†СЋС” С‚С–Р»СЊРєРё РІ Telegram Mini App' 
          : 'Telegram WebApp РЅРµ С–РЅС–С†С–Р°Р»С–Р·РѕРІР°РЅРѕ');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/teacher-app/lessons/${lessonId}`, {
          headers: { 'X-Telegram-Init-Data': initData }
        });

        if (!response.ok) {
          throw new Error('РќРµ РІРґР°Р»РѕСЃСЏ Р·Р°РІР°РЅС‚Р°Р¶РёС‚Рё РґР°РЅС– Р·Р°РЅСЏС‚С‚СЏ');
        }

        const data: LessonData = await response.json();
        setLesson(data.lesson);
        setStudents(data.students);
        setTopic(data.lesson.topic || '');
        setNotes(data.lesson.notes || '');
        setPhotoFolder(data.photoFolder || null);
        setPhotos(data.photos || []);
        setLoading(false);

        // Setup back button if available
        if (webApp?.BackButton) {
          webApp.BackButton.show();
          webApp.BackButton.onClick(() => {
            router.push(`/teacher-app${versionSuffix}`);
          });
        }

        return () => {
          if (webApp?.BackButton) {
            webApp.BackButton.hide();
          }
        };
      } catch (err) {
        console.error('Fetch error:', err);
        setError('РџРѕРјРёР»РєР° Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ РґР°РЅРёС…');
        setLoading(false);
      }
    };

    fetchLesson();
  }, [lessonId, router, initData, initLoading, initError, isInWebView, webApp]);

  useEffect(() => {
    pendingPhotosRef.current = pendingPhotos;
  }, [pendingPhotos]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateViewportState = () => {
      setIsCompactViewport(window.innerWidth < 420);
    };

    updateViewportState();
    window.addEventListener('resize', updateViewportState);

    return () => {
      window.removeEventListener('resize', updateViewportState);
    };
  }, []);

  useEffect(() => {
    return () => {
      pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  useEffect(() => {
    if (viewerIndex === null) {
      return;
    }

    const currentPhoto = photos[viewerIndex];
    if (!currentPhoto || !isVideoFile(currentPhoto) || !viewerVideoRef.current) {
      return;
    }

    const video = viewerVideoRef.current;
    const attemptPlay = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Ignore autoplay rejection inside WebView; manual controls remain available.
        });
      }
    };

    attemptPlay();
    video.addEventListener('loadeddata', attemptPlay);

    return () => {
      video.removeEventListener('loadeddata', attemptPlay);
    };
  }, [viewerIndex, photos]);

  // Format time - use proper timezone handling
  const formatTime = (datetime: string): string => {
    return formatTimeKyiv(datetime);
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    return formatDateKyiv(dateStr);
  };

  // Update attendance
  const updateAttendance = async (studentId: number, status: 'present' | 'absent' | 'sick') => {
    if (!initData) return;

    if (!isEditableToday) return;

    // Optimistic update
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, attendance_status: status === 'sick' ? 'absent' : status } : s
    ));

    try {
      const response = await fetch(`/api/teacher-app/lessons/${lessonId}/attendance`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData 
        },
        body: JSON.stringify({ studentId, status })
      });

      if (!response.ok) {
        throw new Error('РџРѕРјРёР»РєР° Р·Р±РµСЂРµР¶РµРЅРЅСЏ');
      }

      // Update lesson status if needed
      if (lesson && lesson.status === 'scheduled') {
        setLesson({ ...lesson, status: 'done', reported_at: new Date().toISOString() });
      }
    } catch (err) {
      console.error('Attendance error:', err);
      // Revert on error
      const response = await fetch(`/api/teacher-app/lessons/${lessonId}`, {
        headers: { 'X-Telegram-Init-Data': initData }
      });
      const data: LessonData = await response.json();
      setStudents(data.students);
    }
  };

  // Save topic/notes
  const saveLessonDetails = async () => {
    if (!initData) return;

    // Prevent saving for past lessons
    if (!isEditableToday) {
      alert('Викладач може редагувати лише сьогоднішні заняття.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/teacher-app/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData 
        },
        body: JSON.stringify({ topic, notes })
      });

      if (!response.ok) {
        throw new Error('РџРѕРјРёР»РєР° Р·Р±РµСЂРµР¶РµРЅРЅСЏ');
      }

      const result = await response.json();
      
      if (lesson) {
        setLesson({ 
          ...lesson, 
          topic,
          notes,
          status: 'done',
          reported_at: result.lesson.reported_at,
          reported_via: 'telegram'
        });
      }
      setPhotoFolder(result.photoFolder || null);
      setPhotos(result.photos || []);

      setEditingTopic(false);
      setEditingNotes(false);
    } catch (err) {
      console.error('Save error:', err);
      alert('РџРѕРјРёР»РєР° Р·Р±РµСЂРµР¶РµРЅРЅСЏ РґР°РЅРёС…');
    } finally {
      setSaving(false);
    }
  };

  // Finish lesson
  const finishLesson = async () => {
    if (!initData || !webApp) return;

    // Prevent finishing past lessons
    if (!isEditableToday) {
      alert('Викладач може редагувати лише сьогоднішні заняття.');
      return;
    }

    // Check if all students have attendance marked
    const unmarkedStudents = students.filter(s => !s.attendance_status);
    if (unmarkedStudents.length > 0) {
      await webApp.showPopup({
        title: 'РЈРІР°РіР°',
        message: `${unmarkedStudents.length} СЃС‚СѓРґРµРЅС‚С–РІ Р±РµР· РІС–РґР¶РєРё. РџСЂРѕРґРѕРІР¶РёС‚Рё?`,
        buttons: [
          { id: 'cancel', type: 'default', text: 'РџРѕРІРµСЂРЅСѓС‚РёСЃСЏ' },
          { id: 'continue', type: 'ok', text: 'РџСЂРѕРґРѕРІР¶РёС‚Рё' }
        ]
      });
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/teacher-app/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData 
        },
        body: JSON.stringify({ topic, notes, status: 'done' })
      });

      if (!response.ok) {
        throw new Error('РџРѕРјРёР»РєР° Р·Р±РµСЂРµР¶РµРЅРЅСЏ');
      }

      const result = await response.json();
      
      if (lesson) {
        setLesson({ 
          ...lesson, 
          topic,
          notes,
          status: 'done',
          reported_at: result.lesson.reported_at,
          reported_via: 'telegram'
        });
      }
      setPhotoFolder(result.photoFolder || null);
      setPhotos(result.photos || []);

      await webApp.showPopup({
        title: 'Р“РѕС‚РѕРІРѕ!',
        message: 'Р—Р°РЅСЏС‚С‚СЏ СѓСЃРїС–С€РЅРѕ Р·Р°РІРµСЂС€РµРЅРѕ С‚Р° Р·Р±РµСЂРµР¶РµРЅРѕ.',
        buttons: [{ type: 'ok', text: 'OK' }]
      });

      router.push(`/teacher-app${versionSuffix}`);
    } catch (err) {
      console.error('Finish error:', err);
      alert('РџРѕРјРёР»РєР° Р·Р°РІРµСЂС€РµРЅРЅСЏ Р·Р°РЅСЏС‚С‚СЏ');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const nextItems = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingPhotos((prev) => [...prev, ...nextItems]);
    event.target.value = '';
  };

  const removePendingPhoto = (previewId: string) => {
    setPendingPhotos((prev) => {
      const item = prev.find((photo) => photo.id === previewId);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((photo) => photo.id !== previewId);
    });
  };

  const uploadSelectedPhotos = async () => {
    if (!initData || pendingPhotos.length === 0) return;

    if (!isEditableToday) {
      alert('Р’РёРєР»Р°РґР°С‡ РјРѕР¶Рµ Р·РјС–РЅСЋРІР°С‚Рё РјРµРґС–Р° Р»РёС€Рµ РґР»СЏ СЃСЊРѕРіРѕРґРЅС–С€РЅС–С… Р·Р°РЅСЏС‚СЊ.');
      return;
    }

    setUploadingPhotos(true);
    setUploadProgress({ current: 0, total: pendingPhotos.length });

    try {
      const preparedPhotos = await prepareImageFilesForUpload(pendingPhotos.map((photo) => photo.file));
      const videoFiles = preparedPhotos.filter((file) => isVideoMimeType(file.type));
      const imageFiles = preparedPhotos.filter((file) => !isVideoMimeType(file.type));
      const batches = imageFiles.map((file) => [file]);
      let latestResult: { photoFolder?: LessonData['photoFolder']; photos?: LessonPhoto[] } | null = null;
      let uploadedCount = 0;
      let knownPhotoIds = new Set(photos.map((photo) => photo.id));

      for (const file of videoFiles) {
        const startResponse = await fetch(`/api/teacher-app/lessons/${lessonId}/photos/direct`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': initData,
          },
          body: JSON.stringify({
            action: 'start',
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
          }),
        });

        const startData = await startResponse.json().catch(() => ({}));
        if (!startResponse.ok) {
          throw new Error(getUploadErrorMessage(startData, 'РќРµ РІРґР°Р»РѕСЃСЏ РїС–РґРіРѕС‚СѓРІР°С‚Рё Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ РІС–РґРµРѕ'));
        }

        latestResult = await uploadFileToMediaService(startData.uploadUrl, startData.uploadToken, Number(lessonId), file);
        const newVideoIds = (latestResult.photos || [])
          .filter((photo) => isVideoFile(photo) && !knownPhotoIds.has(photo.id))
          .map((photo) => photo.id);

        if (newVideoIds.length > 0) {
          setProcessingVideoIds((prev) => {
            const next = { ...prev };
            newVideoIds.forEach((photoId) => {
              next[photoId] = true;
            });
            return next;
          });
        }

        knownPhotoIds = new Set((latestResult.photos || []).map((photo) => photo.id));
        uploadedCount += 1;
        setUploadProgress({ current: uploadedCount, total: preparedPhotos.length });
      }

      for (const batch of batches) {
        const formData = new FormData();
        batch.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetch(`/api/teacher-app/lessons/${lessonId}/photos`, {
          method: 'POST',
          headers: {
            'X-Telegram-Init-Data': initData,
          },
          body: formData,
        });

        const errorData = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status === 413) {
            throw new Error('Р—Р°Р±Р°РіР°С‚Рѕ С„РѕС‚Рѕ Р·Р° РѕРґРёРЅ РїР°РєРµС‚. РЎРїСЂРѕР±СѓР№С‚Рµ С‰Рµ СЂР°Р·: СЃРёСЃС‚РµРјР° РІС–РґРїСЂР°РІРёС‚СЊ С—С… РјРµРЅС€РёРјРё С‡Р°СЃС‚РёРЅР°РјРё.');
          }
          throw new Error(getUploadErrorMessage(errorData, 'РџРѕРјРёР»РєР° Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ С„РѕС‚Рѕ'));
        }

        latestResult = errorData;
        const nextPhotos = latestResult?.photos || [];
        const newVideoIds = nextPhotos
          .filter((photo) => isVideoFile(photo) && !knownPhotoIds.has(photo.id))
          .map((photo) => photo.id);

        if (newVideoIds.length > 0) {
          setProcessingVideoIds((prev) => {
            const next = { ...prev };
            newVideoIds.forEach((photoId) => {
              if (!readyVideoIds[photoId]) {
                next[photoId] = true;
              }
            });
            return next;
          });
        }

        knownPhotoIds = new Set(nextPhotos.map((photo) => photo.id));
        uploadedCount += batch.length;
        setUploadProgress({ current: uploadedCount, total: preparedPhotos.length });
      }

      setPhotoFolder(latestResult?.photoFolder || null);
      setPhotos(latestResult?.photos || []);
      pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setPendingPhotos([]);
    } catch (uploadError) {
      console.error('Photo upload error:', uploadError);
      alert(uploadError instanceof Error ? uploadError.message : 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р°РІР°РЅС‚Р°Р¶РёС‚Рё РјРµРґС–Р° Р·Р°РЅСЏС‚С‚СЏ');
    } finally {
      setUploadingPhotos(false);
      setUploadProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="tg-loading">
        <div className="tg-spinner"></div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
        <p style={{ color: 'var(--tg-text-color)', marginBottom: 'var(--space-md)', fontSize: '15px' }}>
          {error || 'Р—Р°РЅСЏС‚С‚СЏ РЅРµ Р·РЅР°Р№РґРµРЅРѕ'}
        </p>
        <button onClick={() => router.push(`/teacher-app${versionSuffix}`)} className="tg-button" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}>
          <ArrowLeftIcon size={16} /> РќР°Р·Р°Рґ
        </button>
      </div>
    );
  }

  const visibleUploadedPhotos = showAllUploadedPhotos ? photos : photos.slice(0, 3);

  const closeMediaViewer = () => {
    setViewerIndex(null);
  };

  const navigateMediaViewer = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= photos.length) {
      return;
    }

    setViewerIndex(nextIndex);
  };

  const handleViewerTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    viewerTouchStartXRef.current = touch.clientX;
    viewerTouchStartYRef.current = touch.clientY;
  };

  const handleViewerTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    const startX = viewerTouchStartXRef.current;
    const startY = viewerTouchStartYRef.current;
    const touch = event.changedTouches[0];

    viewerTouchStartXRef.current = null;
    viewerTouchStartYRef.current = null;

    if (!touch || startX === null || startY === null || viewerIndex === null) {
      return;
    }

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0) {
      navigateMediaViewer(viewerIndex + 1);
      return;
    }

    navigateMediaViewer(viewerIndex - 1);
  };

  const handleMediaPreviewActivate = (
    event:
      | ReactMouseEvent<HTMLElement>
      | ReactPointerEvent<HTMLElement>
      | ReactTouchEvent<HTMLElement>
      | ReactKeyboardEvent<HTMLElement>,
    photoId: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const nextIndex = photos.findIndex((photo) => photo.id === photoId);
    if (nextIndex !== -1) {
      setViewerIndex(nextIndex);
    }
  };

  const handlePhotoDelete = async (
    event:
      | ReactMouseEvent<HTMLElement>
      | ReactPointerEvent<HTMLElement>
      | ReactTouchEvent<HTMLElement>,
    photoId: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isEditableToday) {
      alert('Р’РёРєР»Р°РґР°С‡ РјРѕР¶Рµ Р·РјС–РЅСЋРІР°С‚Рё РјРµРґС–Р° Р»РёС€Рµ РґР»СЏ СЃСЊРѕРіРѕРґРЅС–С€РЅС–С… Р·Р°РЅСЏС‚СЊ.');
      return;
    }

    if (!initData || deletingPhotoId === photoId) {
      return;
    }

    let confirmed = false;

    if (webApp?.showPopup) {
      const result = await webApp.showPopup({
        title: 'Р’РёРґР°Р»РёС‚Рё РјРµРґС–Р°?',
        message: 'Р¤Р°Р№Р» Р±СѓРґРµ РІРёРґР°Р»РµРЅРѕ С–Р· Р·Р°РЅСЏС‚С‚СЏ С‚Р° Р· Google Drive.',
        buttons: [
          { id: 'cancel', type: 'cancel', text: 'РЎРєР°СЃСѓРІР°С‚Рё' },
          { id: 'delete', type: 'default', text: 'Р’РёРґР°Р»РёС‚Рё' },
        ],
      });
      confirmed = result === 'delete';
    } else {
      confirmed = window.confirm('Р’РёРґР°Р»РёС‚Рё С„Р°Р№Р» С–Р· Р·Р°РЅСЏС‚С‚СЏ С‚Р° Р· Google Drive?');
    }

    if (!confirmed) {
      return;
    }

    setDeletingPhotoId(photoId);

    try {
      const response = await fetch(`/api/teacher-app/lessons/${lessonId}/photos/${photoId}`, {
        method: 'DELETE',
        headers: {
          'X-Telegram-Init-Data': initData,
        },
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'РќРµ РІРґР°Р»РѕСЃСЏ РІРёРґР°Р»РёС‚Рё РјРµРґС–Р°');
      }

      setPhotoFolder(result.photoFolder || null);
      setPhotos(result.photos || []);
      setViewerIndex((currentIndex) => {
        if (currentIndex === null) {
          return null;
        }

        const nextPhotos = result.photos || [];
        if (nextPhotos.length === 0) {
          return null;
        }

        return Math.min(currentIndex, nextPhotos.length - 1);
      });
    } catch (deleteError) {
      console.error('Teacher lesson media delete error:', deleteError);
      alert(deleteError instanceof Error ? deleteError.message : 'РќРµ РІРґР°Р»РѕСЃСЏ РІРёРґР°Р»РёС‚Рё РјРµРґС–Р° Р·Р°РЅСЏС‚С‚СЏ');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const mediaSection = lesson && lesson.group_id !== null && (
    <div style={{ marginBottom: 'var(--space-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', gap: 'var(--space-sm)' }}>
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tg-text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CameraIcon size={16} /> РњРµРґС–Р° Р·Р°РЅСЏС‚С‚СЏ
        </span>
        {photoFolder?.url ? (
          <a
            href={photoFolder.url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '13px', color: 'var(--tg-link-color)', textDecoration: 'none', fontWeight: 500 }}
          >
            Р’С–РґРєСЂРёС‚Рё РїР°РїРєСѓ
          </a>
        ) : null}
      </div>

      {!topic.trim() && (
        <div style={{
          marginBottom: 'var(--space-md)',
          padding: 'var(--space-md)',
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: 'var(--radius-md)',
          color: '#9a3412',
          fontSize: '13px',
        }}>
          РџР°РїРєР° Р·Р°РЅСЏС‚С‚СЏ Р±СѓРґРµ СЃС‚РІРѕСЂРµРЅР° Р· С‚РёРјС‡Р°СЃРѕРІРѕСЋ РЅР°Р·РІРѕСЋ <strong>Р‘РµР· С‚РµРјРё</strong>, Р° РїС–СЃР»СЏ Р·Р±РµСЂРµР¶РµРЅРЅСЏ С‚РµРјРё Р°РІС‚РѕРјР°С‚РёС‡РЅРѕ РїРµСЂРµР№РјРµРЅСѓС”С‚СЊСЃСЏ.
        </div>
      )}

      <div style={{
        background: 'var(--tg-primary-bg)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--tg-border)',
        padding: 'var(--space-md)',
        marginBottom: 'var(--space-md)',
      }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--tg-link-color)',
            color: 'var(--tg-link-color)',
            cursor: uploadingPhotos ? 'not-allowed' : 'pointer',
            opacity: uploadingPhotos ? 0.6 : 1,
            marginBottom: pendingPhotos.length > 0 || photos.length > 0 ? '16px' : 0,
          }}
        >
          <UploadIcon size={16} />
          <span>{pendingPhotos.length > 0 ? 'Р”РѕРґР°С‚Рё С‰Рµ РјРµРґС–Р°' : 'Р’РёР±СЂР°С‚Рё РјРµРґС–Р°'}</span>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handlePhotoSelection}
            disabled={uploadingPhotos || !isEditableToday}
            style={{ display: 'none' }}
          />
        </label>

        {uploadProgress && (
          <div style={{
            marginTop: '10px',
            marginBottom: pendingPhotos.length > 0 ? '12px' : 0,
            fontSize: '13px',
            color: 'var(--tg-text-secondary)',
            textAlign: 'center',
          }}>
            {`Р—Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ РјРµРґС–Р°: ${uploadProgress?.current ?? 0} Р· ${uploadProgress?.total ?? 0}`}
          </div>
        )}

        {pendingPhotos.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
              {pendingPhotos.map((photo) => (
                <div key={photo.id} style={{ position: 'relative' }}>
                  {isVideoFile(photo.file) ? (
                    <video
                      src={photo.previewUrl}
                      controls
                      preload="metadata"
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--tg-border)', background: '#000' }}
                    />
                  ) : (
                    <img
                      src={photo.previewUrl}
                      alt={photo.file.name}
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--tg-border)' }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removePendingPhoto(photo.id)}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      border: 'none',
                      borderRadius: '999px',
                      width: '22px',
                      height: '22px',
                      background: 'rgba(0,0,0,0.65)',
                      color: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Р“вЂ”
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={uploadSelectedPhotos}
              disabled={uploadingPhotos || !isEditableToday}
              className="tg-button"
              style={{ width: '100%', marginTop: '12px' }}
            >
              {uploadingPhotos ? 'Р—Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ РјРµРґС–Р°...' : `Р—Р°РІР°РЅС‚Р°Р¶РёС‚Рё РјРµРґС–Р° (${pendingPhotos.length})`}
            </button>
          </div>
        )}

        {photos.length > 0 ? (
          <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                {visibleUploadedPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    style={{ position: 'relative', cursor: 'pointer' }}
                  >
                    {isVideoFile(photo) ? (
                      <>
                        <video
                          src={getLessonMediaStreamUrl(photo.driveFileId)}
                          preload="metadata"
                          muted
                          poster={photo.thumbnailUrl}
                          onLoadedData={() => {
                            setReadyVideoIds((prev) => prev[photo.id] ? prev : { ...prev, [photo.id]: true });
                            setProcessingVideoIds((prev) => {
                            if (!prev[photo.id]) return prev;
                            const next = { ...prev };
                            delete next[photo.id];
                            return next;
                          });
                        }}
                        onCanPlay={() => {
                          setReadyVideoIds((prev) => prev[photo.id] ? prev : { ...prev, [photo.id]: true });
                          setProcessingVideoIds((prev) => {
                            if (!prev[photo.id]) return prev;
                            const next = { ...prev };
                            delete next[photo.id];
                            return next;
                          });
                        }}
                        style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--tg-border)', background: '#000', pointerEvents: 'none' }}
                      />
                      {isDriveVideoProcessing(photo, Boolean(processingVideoIds[photo.id]), Boolean(readyVideoIds[photo.id])) && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '12px',
                          borderRadius: '10px',
                          background: 'rgba(15, 23, 42, 0.68)',
                          color: 'white',
                          textAlign: 'center',
                          pointerEvents: 'none',
                        }}>
                          <RefreshIcon size={18} style={{ animation: 'spin 1s linear infinite' }} />
                          {!isCompactViewport && (
                            <>
                              <div style={{ fontSize: '12px', fontWeight: 600 }}>Google Drive РѕР±СЂРѕР±Р»СЏС” РІС–РґРµРѕ</div>
                              <div style={{ fontSize: '11px', opacity: 0.9 }}>РџРѕРїРµСЂРµРґРЅС–Р№ РїРµСЂРµРіР»СЏРґ РјРѕР¶Рµ Р·'СЏРІРёС‚РёСЃСЏ РЅРµ РѕРґСЂР°Р·Сѓ</div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.fileName}
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--tg-border)', pointerEvents: 'none' }}
                    />
                  )}
                    <button
                      type="button"
                      aria-label={`Р’С–РґРєСЂРёС‚Рё ${photo.fileName}`}
                      onClick={(event) => handleMediaPreviewActivate(event, photo.id)}
                      onPointerUp={(event) => handleMediaPreviewActivate(event, photo.id)}
                    onTouchEnd={(event) => handleMediaPreviewActivate(event, photo.id)}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 6,
                      padding: 0,
                      border: 'none',
                      borderRadius: '10px',
                      background: 'transparent',
                      color: 'transparent',
                      fontSize: 0,
                      fontWeight: 400,
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                    >
                      {isVideoFile(photo) ? 'Р’С–РґРєСЂРёС‚Рё РІС–РґРµРѕ' : 'Р’С–РґРєСЂРёС‚Рё С„РѕС‚Рѕ'}
                    </button>
                  <button
                    type="button"
                    aria-label={`Р’РёРґР°Р»РёС‚Рё ${photo.fileName}`}
                    onClick={(event) => handlePhotoDelete(event, photo.id)}
                    disabled={deletingPhotoId === photo.id || !isEditableToday}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      zIndex: 7,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      border: 'none',
                      borderRadius: '999px',
                      background: 'rgba(15, 23, 42, 0.78)',
                      color: 'white',
                      cursor: deletingPhotoId === photo.id ? 'wait' : !isEditableToday ? 'not-allowed' : 'pointer',
                      opacity: deletingPhotoId === photo.id ? 0.7 : !isEditableToday ? 0.6 : 1,
                    }}
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
            {photos.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllUploadedPhotos((prev) => !prev)}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '1px solid var(--tg-border)',
                  background: 'var(--tg-primary-bg)',
                  color: 'var(--tg-link-color)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {showAllUploadedPhotos ? 'РЎС…РѕРІР°С‚Рё Р·Р°Р№РІРµ РјРµРґС–Р°' : `РџРѕРєР°Р·Р°С‚Рё С‰Рµ ${photos.length - 3} РµР»РµРјРµРЅС‚С–РІ`}
              </button>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--tg-hint-color)', fontStyle: 'italic' }}>
            РњРµРґС–Р° Р·Р°РЅСЏС‚С‚СЏ С‰Рµ РЅРµ Р·Р°РІР°РЅС‚Р°Р¶РµРЅС–.
          </p>
        )}

        {photos.length > 0 && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--tg-text-secondary)' }}>
            Р—Р°РІР°РЅС‚Р°Р¶РµРЅРѕ РјРµРґС–Р°: {photos.length}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
        <div>
          <button 
            onClick={() => router.push(`/teacher-app${versionSuffix}`)}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              color: 'var(--tg-link-color)',
              fontSize: '14px',
              marginBottom: 'var(--space-sm)'
            }}
          >
            <ArrowLeftIcon size={14} /> Р”Рѕ СЂРѕР·РєР»Р°РґСѓ
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: '14px', color: 'var(--tg-text-secondary)' }}>
              {formatDate(lesson.lesson_date)}
            </span>
            <span className={`tg-badge ${lesson.status === 'done' ? 'tg-badge-done' : 'tg-badge-scheduled'}`}>
              {lesson.status === 'done' ? 'РџСЂРѕРІРµРґРµРЅРѕ' : 'Р—Р°РїР»Р°РЅРѕРІР°РЅРѕ'}
            </span>
          </div>
        </div>
      </div>

      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: 'var(--space-md)', color: 'var(--tg-text-color)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ClockIcon size={22} /> {formatTime(lesson.start_datetime)} - {formatTime(lesson.end_datetime)}
      </h1>
      {lesson.is_makeup ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
          <span style={{ fontSize: '15px', color: 'var(--tg-text-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshIcon size={16} /> Р’С–РґРїСЂР°С†СЋРІР°РЅРЅСЏ
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: '15px', color: 'var(--tg-text-color)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UsersIcon size={16} /> {lesson.group_title}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: '13px', color: 'var(--tg-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <BookOpenIcon size={14} /> {lesson.course_title}
            </span>
          </div>
        </div>
      )}

      {/* Past lesson warning */}
      {!isEditableToday && (
        <div style={{ 
          background: '#fff3cd', 
          color: '#856404',
          padding: 'var(--space-md)', 
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-xl)',
          fontSize: '14px',
          border: '1px solid #ffeeba'
        }}>
          Р¦Рµ Р·Р°РЅСЏС‚С‚СЏ Р· РјРёРЅСѓР»РѕРіРѕ РґРЅСЏ. Р РµРґР°РіСѓРІР°РЅРЅСЏ С‚РµРјРё, РїСЂРёРјС–С‚РѕРє С‚Р° РІС–РґРІС–РґСѓРІР°РЅРѕСЃС‚С– РЅРµРґРѕСЃС‚СѓРїРЅРµ.
        </div>
      )}

      {/* Topic - hidden for makeup lessons */}
      {!lesson.is_makeup && (<div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tg-text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}><FileTextIcon size={16} /> РўРµРјР° Р·Р°РЅСЏС‚С‚СЏ</span>
          {!editingTopic && isEditableToday && (
            <button 
              onClick={() => setEditingTopic(true)}
              style={{ fontSize: '13px', color: 'var(--tg-link-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              Р РµРґР°РіСѓРІР°С‚Рё
            </button>
          )}
        </div>
        {editingTopic ? (
          <div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Р’РІРµРґС–С‚СЊ С‚РµРјСѓ Р·Р°РЅСЏС‚С‚СЏ..."
              className="tg-input"
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
              <button onClick={saveLessonDetails} disabled={saving} className="tg-button" style={{ flex: 1 }}>
                {saving ? 'Р—Р±РµСЂРµР¶РµРЅРЅСЏ...' : 'Р—Р±РµСЂРµРіС‚Рё'}
              </button>
              <button 
                onClick={() => {
                  setTopic(lesson.topic || '');
                  setEditingTopic(false);
                }}
                className="tg-button tg-button-secondary"
              >
                РЎРєР°СЃСѓРІР°С‚Рё
              </button>
            </div>
          </div>
        ) : (
          <div style={{ 
            background: 'var(--tg-primary-bg)', 
            padding: 'var(--space-md)', 
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid var(--tg-link-color)'
          }}>
            <p style={{ fontSize: '14px', color: topic ? 'var(--tg-text-color)' : 'var(--tg-hint-color)', fontStyle: topic ? 'normal' : 'italic' }}>
              {topic || 'РўРµРјР° РЅРµ РІРєР°Р·Р°РЅР°'}
            </p>
          </div>
        )}
      </div>)}

      {/* Notes */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tg-text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}><ClipboardIcon size={16} /> РќРѕС‚Р°С‚РєР°</span>
          {!editingNotes && isEditableToday && (
            <button 
              onClick={() => setEditingNotes(true)}
              style={{ fontSize: '13px', color: 'var(--tg-link-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              Р РµРґР°РіСѓРІР°С‚Рё
            </button>
          )}
        </div>
        {editingNotes ? (
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Р’РІРµРґС–С‚СЊ РЅРѕС‚Р°С‚РєСѓ..."
              rows={3}
              className="tg-input"
              style={{ resize: 'vertical', minHeight: '100px' }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
              <button onClick={saveLessonDetails} disabled={saving} className="tg-button" style={{ flex: 1 }}>
                {saving ? 'Р—Р±РµСЂРµР¶РµРЅРЅСЏ...' : 'Р—Р±РµСЂРµРіС‚Рё'}
              </button>
              <button 
                onClick={() => {
                  setNotes(lesson.notes || '');
                  setEditingNotes(false);
                }}
                className="tg-button tg-button-secondary"
              >
                РЎРєР°СЃСѓРІР°С‚Рё
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '14px', color: notes ? 'var(--tg-text-color)' : 'var(--tg-hint-color)', fontStyle: notes ? 'normal' : 'italic' }}>
            {notes || 'РќРѕС‚Р°С‚РєР° РІС–РґСЃСѓС‚РЅСЏ'}
          </p>
        )}
      </div>

      {false && lesson?.group_id !== null && (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tg-text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CameraIcon size={16} /> Р¤РѕС‚Рѕ Р·Р°РЅСЏС‚С‚СЏ
            </span>
            {photoFolder?.url ? (
              <a
                href={photoFolder?.url ?? '#'}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '13px', color: 'var(--tg-link-color)', textDecoration: 'none', fontWeight: 500 }}
              >
                Р’С–РґРєСЂРёС‚Рё РїР°РїРєСѓ
              </a>
            ) : null}
          </div>

          {!topic.trim() && (
            <div style={{
              marginBottom: 'var(--space-md)',
              padding: 'var(--space-md)',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: 'var(--radius-md)',
              color: '#9a3412',
              fontSize: '13px',
            }}>
              РџР°РїРєР° Р·Р°РЅСЏС‚С‚СЏ Р±СѓРґРµ СЃС‚РІРѕСЂРµРЅР° Р· С‚РёРјС‡Р°СЃРѕРІРѕСЋ РЅР°Р·РІРѕСЋ <strong>{lesson?.lesson_date ? 'Р‘РµР· С‚РµРјРё' : 'Р‘РµР· С‚РµРјРё'}</strong>, Р° РїС–СЃР»СЏ Р·Р±РµСЂРµР¶РµРЅРЅСЏ С‚РµРјРё Р°РІС‚РѕРјР°С‚РёС‡РЅРѕ РїРµСЂРµР№РјРµРЅСѓС”С‚СЊСЃСЏ.
            </div>
          )}

          <div style={{
            background: 'var(--tg-primary-bg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--tg-border)',
            padding: 'var(--space-md)',
            marginBottom: 'var(--space-md)',
          }}>
              <label
                style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--tg-link-color)',
                color: 'var(--tg-link-color)',
                cursor: uploadingPhotos ? 'not-allowed' : 'pointer',
                opacity: uploadingPhotos ? 0.6 : 1,
                marginBottom: pendingPhotos.length > 0 ? '12px' : 0,
              }}
            >
              <UploadIcon size={16} />
              <span>{pendingPhotos.length > 0 ? 'Р”РѕРґР°С‚Рё С‰Рµ С„РѕС‚Рѕ' : 'Р’РёР±СЂР°С‚Рё С„РѕС‚Рѕ'}</span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handlePhotoSelection}
                disabled={uploadingPhotos || !isEditableToday}
                style={{ display: 'none' }}
                />
              </label>

              {uploadProgress && (
                <div style={{
                  marginTop: '10px',
                  marginBottom: pendingPhotos.length > 0 ? '12px' : 0,
                  fontSize: '13px',
                  color: 'var(--tg-text-secondary)',
                  textAlign: 'center',
                }}>
                  {`Р—Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ С„РѕС‚Рѕ: ${uploadProgress?.current ?? 0} Р· ${uploadProgress?.total ?? 0}`}
                </div>
              )}

              {pendingPhotos.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  {pendingPhotos.map((photo) => (
                    <div key={photo.id} style={{ position: 'relative' }}>
                      {isVideoFile(photo.file) ? (
                        <video
                          src={photo.previewUrl}
                          controls
                          preload="metadata"
                          style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--tg-border)', background: '#000' }}
                        />
                      ) : (
                        <img
                          src={photo.previewUrl}
                          alt={photo.file.name}
                          style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--tg-border)' }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removePendingPhoto(photo.id)}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          border: 'none',
                          borderRadius: '999px',
                          width: '22px',
                          height: '22px',
                          background: 'rgba(0,0,0,0.65)',
                          color: 'white',
                          cursor: 'pointer',
                        }}
                      >
                        Г—
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={uploadSelectedPhotos}
                  disabled={uploadingPhotos || !isEditableToday}
                  className="tg-button"
                  style={{ width: '100%', marginTop: '12px' }}
                >
                  {uploadingPhotos ? 'Р—Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ С„РѕС‚Рѕ...' : `Р—Р°РІР°РЅС‚Р°Р¶РёС‚Рё С„РѕС‚Рѕ (${pendingPhotos.length})`}
                </button>
              </div>
            )}

            {photos.length > 0 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  {visibleUploadedPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      style={{ position: 'relative', cursor: 'pointer' }}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => handleMediaPreviewActivate(event, photo.id)}
                      onPointerUp={(event) => handleMediaPreviewActivate(event, photo.id)}
                      onTouchEnd={(event) => handleMediaPreviewActivate(event, photo.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          handleMediaPreviewActivate(event, photo.id);
                        }
                      }}
                    >
                      {isVideoFile(photo) ? (
                        <>
                          <video
                            src={getLessonMediaStreamUrl(photo.driveFileId)}
                            preload="metadata"
                            muted
                            poster={photo.thumbnailUrl}
                            onLoadedData={() => {
                              setReadyVideoIds((prev) => prev[photo.id] ? prev : { ...prev, [photo.id]: true });
                              setProcessingVideoIds((prev) => {
                                if (!prev[photo.id]) {
                                  return prev;
                                }

                                const next = { ...prev };
                                delete next[photo.id];
                                return next;
                              });
                            }}
                            onCanPlay={() => {
                              setReadyVideoIds((prev) => prev[photo.id] ? prev : { ...prev, [photo.id]: true });
                              setProcessingVideoIds((prev) => {
                                if (!prev[photo.id]) {
                                  return prev;
                                }

                                const next = { ...prev };
                                delete next[photo.id];
                                return next;
                              });
                            }}
                            style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--tg-border)', background: '#000', pointerEvents: 'none' }}
                          />
                          {isDriveVideoProcessing(photo, Boolean(processingVideoIds[photo.id]), Boolean(readyVideoIds[photo.id])) && (
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              padding: '12px',
                              borderRadius: '10px',
                              background: 'rgba(15, 23, 42, 0.68)',
                              color: 'white',
                              textAlign: 'center',
                              pointerEvents: 'none',
                            }}>
                              <RefreshIcon size={18} style={{ animation: 'spin 1s linear infinite' }} />
                              {!isCompactViewport && (
                                <>
                                  <div style={{ fontSize: '12px', fontWeight: 600 }}>Google Drive РѕР±СЂРѕР±Р»СЏС” РІС–РґРµРѕ</div>
                                  <div style={{ fontSize: '11px', opacity: 0.9 }}>РџРѕРїРµСЂРµРґРЅС–Р№ РїРµСЂРµРіР»СЏРґ РјРѕР¶Рµ Р·КјСЏРІРёС‚РёСЃСЏ РЅРµ РѕРґСЂР°Р·Сѓ</div>
                                </>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <img
                          src={photo.thumbnailUrl}
                          alt={photo.fileName}
                          style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--tg-border)', pointerEvents: 'none' }}
                        />
                      )}
                      <button
                        type="button"
                        aria-label={`Р’С–РґРєСЂРёС‚Рё ${photo.fileName}`}
                        onClick={(event) => handleMediaPreviewActivate(event, photo.id)}
                        onPointerUp={(event) => handleMediaPreviewActivate(event, photo.id)}
                        onTouchEnd={(event) => handleMediaPreviewActivate(event, photo.id)}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          zIndex: 6,
                          padding: 0,
                          border: 'none',
                          borderRadius: '10px',
                          background: 'transparent',
                          color: 'transparent',
                          fontSize: 0,
                          fontWeight: 400,
                          cursor: 'pointer',
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        {isVideoFile(photo) ? 'РџРµСЂРµРіР»СЏРЅСѓС‚Рё РІС–РґРµРѕ' : 'РџРµСЂРµРіР»СЏРЅСѓС‚Рё С„РѕС‚Рѕ'}
                      </button>
                    </div>
                  ))}
                </div>
              {photos.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllUploadedPhotos((prev) => !prev)}
                  style={{
                    width: '100%',
                    marginTop: '10px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: '1px solid var(--tg-border)',
                    background: 'var(--tg-primary-bg)',
                    color: 'var(--tg-link-color)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {showAllUploadedPhotos ? 'РЎС…РѕРІР°С‚Рё Р·Р°Р№РІС– С„РѕС‚Рѕ' : `РџРѕРєР°Р·Р°С‚Рё С‰Рµ ${photos.length - 3} С„РѕС‚Рѕ`}
                </button>
              )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--tg-hint-color)', fontStyle: 'italic' }}>
                Р¤РѕС‚Рѕ С‰Рµ РЅРµ Р·Р°РІР°РЅС‚Р°Р¶РµРЅС–.
              </p>
            )}

            {photos.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--tg-text-secondary)' }}>
                Р—Р°РІР°РЅС‚Р°Р¶РµРЅРѕ: {photos.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Students attendance */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--tg-text-color)' }}>
          Р’С–РґРІС–РґСѓРІР°РЅС–СЃС‚СЊ ({students.length})
        </h2>
        
        {students.length === 0 ? (
          <p style={{ color: 'var(--tg-hint-color)', fontStyle: 'italic', fontSize: '14px' }}>
            РќРµРјР°С” СЃС‚СѓРґРµРЅС‚С–РІ Сѓ РіСЂСѓРїС–
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {students.map(student => (
              <div
                key={student.id}
                style={{
                  background: 'var(--tg-surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  border: '1px solid var(--tg-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--tg-text-color)' }}>{student.full_name}</span>
                  <div className="tg-actions">
                    <button
                      onClick={() => updateAttendance(student.id, 'present')}
                      className={`tg-action-btn tg-action-btn-success ${student.attendance_status === 'present' ? 'active' : ''}`}
                      title="РџСЂРёСЃСѓС‚РЅС–Р№"
                      disabled={!isEditableToday}
                    >
                      вњ“
                    </button>
                    <button
                      onClick={() => updateAttendance(student.id, 'absent')}
                      className={`tg-action-btn tg-action-btn-danger ${student.attendance_status === 'absent' ? 'active' : ''}`}
                      title="Р’С–РґСЃСѓС‚РЅС–Р№"
                      disabled={!isEditableToday}
                    >
                      вњ—
                    </button>
                  </div>
                </div>
                {lesson.is_makeup && student.original_lesson_date && (
                  <div style={{
                    marginTop: 'var(--space-sm)',
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'var(--tg-primary-bg)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--tg-link-color)',
                    fontSize: '12px',
                    color: 'var(--tg-text-secondary)',
                  }}>
                    <div style={{ marginBottom: '2px' }}>
                      <strong>Р’С–РґРїСЂР°С†СЊРѕРІСѓС”:</strong> {formatDate(student.original_lesson_date)}
                    </div>
                    {student.original_course_title && (
                      <div style={{ marginBottom: '2px' }}>{student.original_course_title}</div>
                    )}
                    {student.original_lesson_topic ? (
                      <div>{student.original_lesson_topic}</div>
                    ) : (
                      <div style={{ fontStyle: 'italic' }}>РўРµРјР° РЅРµ РІРєР°Р·Р°РЅР°</div>
                    )}
                  </div>
                )}
                {lesson.is_makeup && !student.original_lesson_date && (
                  <div style={{ marginTop: 'var(--space-sm)', fontSize: '12px', color: 'var(--tg-hint-color)', fontStyle: 'italic' }}>
                    РћСЂРёРіС–РЅР°Р»СЊРЅРµ Р·Р°РЅСЏС‚С‚СЏ РЅРµ РІРєР°Р·Р°РЅРѕ
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {mediaSection}

      {/* Report info - shown only after lesson is completed */}
      {lesson.reported_at && (
        <div className="tg-success-message" style={{ marginBottom: 'var(--space-lg)' }}>
          <CheckCircleIcon size={16} /> <strong>Р”Р°РЅС– Р·Р±РµСЂРµР¶РµРЅРѕ:</strong><br/>
          {formatDateTimeKyiv(lesson.reported_at)}
          {lesson.reported_via === 'telegram' && ' С‡РµСЂРµР· Telegram'}
          {lesson.reported_by_name && <><br/>Р’РёРєР»Р°РґР°С‡: {lesson.reported_by_name}</>}
        </div>
      )}

      {viewerIndex !== null && photos[viewerIndex] && (
        <div
          onClick={closeMediaViewer}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(2, 6, 23, 0.96)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 14px',
              color: 'white',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {photos[viewerIndex].fileName}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.75 }}>
                {viewerIndex + 1} Р· {photos.length}
              </div>
            </div>
            <button
              type="button"
              onClick={closeMediaViewer}
              style={{ border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', width: '36px', height: '36px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <XIcon size={18} />
            </button>
          </div>

          <div
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleViewerTouchStart}
            onTouchEnd={handleViewerTouchEnd}
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px 14px 28px',
            }}
          >
            {photos.length > 1 && viewerIndex > 0 && (
              <button
                type="button"
                onClick={() => navigateMediaViewer(viewerIndex - 1)}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'white', width: '40px', height: '40px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeftIcon size={18} />
              </button>
            )}

            {isVideoFile(photos[viewerIndex]) ? (
              <video
                ref={viewerVideoRef}
                key={photos[viewerIndex].id}
                src={getLessonMediaStreamUrl(photos[viewerIndex].driveFileId)}
                controls
                autoPlay
                playsInline
                preload="metadata"
                poster={photos[viewerIndex].thumbnailUrl}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: '16px', background: '#000' }}
              />
            ) : (
              <img
                key={photos[viewerIndex].id}
                src={getDriveLargeThumbnailUrl(photos[viewerIndex].driveFileId)}
                alt={photos[viewerIndex].fileName}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '16px' }}
              />
            )}

            {photos.length > 1 && viewerIndex < photos.length - 1 && (
              <button
                type="button"
                onClick={() => navigateMediaViewer(viewerIndex + 1)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'white', width: '40px', height: '40px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronRightIcon size={18} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

