'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { User, useUser } from '@/components/UserContext';
import { t } from '@/i18n/t';
import { uk } from '@/i18n/uk';
import { formatDateTimeKyiv, formatDateKyiv } from '@/lib/date-utils';
import DraggableModal from '@/components/DraggableModal';
import { useStudentModals } from '@/components/StudentModalsContext';
import { useLessonModals } from '@/components/LessonModalsContext';
import StudentAttendancePanel from '@/components/StudentAttendancePanel';
import StudentHistoryPanel from '@/components/StudentHistoryPanel';
import StudentPaymentsPanel from '@/components/StudentPaymentsPanel';


interface Student {
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
  parent2_phone: string | null;
  parent2_relation: string | null;
  interested_courses: string | null;
  source: string | null;
  is_active: boolean;
  study_status: 'studying' | 'not_studying';
  created_at: string;
  updated_at: string;
}

interface StudentGroup {
  id: number;
  public_id: string | null;
  title: string;
  course_title: string;
  status: string;
  join_date: string;
  teacher_name: string | null;
}

interface StudentFormData {
  first_name: string;
  last_name: string;
  birth_date: string;
  email: string;
  school: string;
  discount: string;
  photo: string | null;
  photoFile: File | null;
  phone: string;
  parent_name: string;
  parent_relation: string;
  parent_relation_other: string;
  parent_phone: string;
  parent2_name: string;
  parent2_phone: string;
  parent2_relation: string;
  parent2_relation_other: string;
  notes: string;
  interested_courses: string[];
  source: string;
  source_other: string;
}

interface Course {
  id: number;
  title: string;
  public_id: string;
}

interface GroupDetails {
  group?: {
    id: number;
    public_id: string | null;
    title: string;
    status: string;
    is_active: boolean;
    weekly_day: number;
    start_time: string;
    end_time: string | null;
    course_title?: string;
    course_id?: number;
    room?: string;
    notes?: string;
    students_count?: number;
  };
  students?: Array<{
    id: number;
    public_id: string;
    full_name: string;
    phone: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    join_date: string;
    student_group_id: number;
    photo: string | null;
  }>;
}

interface CropOffset {
  x: number;
  y: number;
}

interface StudentAvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  fileName: string;
  onCancel: () => void;
  onApply: (croppedDataUrl: string, croppedFile: File | null) => void;
}

const AVATAR_CROP_VIEW_SIZE = 320;
const AVATAR_OUTPUT_SIZE = 512;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getAvatarCropMetrics(
  naturalWidth: number,
  naturalHeight: number,
  zoom: number
) {
  const baseScale = Math.max(
    AVATAR_CROP_VIEW_SIZE / naturalWidth,
    AVATAR_CROP_VIEW_SIZE / naturalHeight
  );
  const scale = baseScale * zoom;
  const displayWidth = naturalWidth * scale;
  const displayHeight = naturalHeight * scale;
  const maxOffsetX = Math.max(0, (displayWidth - AVATAR_CROP_VIEW_SIZE) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - AVATAR_CROP_VIEW_SIZE) / 2);

  return {
    displayWidth,
    displayHeight,
    maxOffsetX,
    maxOffsetY,
  };
}

function StudentAvatarCropModal({
  isOpen,
  imageSrc,
  fileName,
  onCancel,
  onApply,
}: StudentAvatarCropModalProps) {
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!isOpen || !imageSrc) {
      return;
    }

    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);

    const img = new window.Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) {
    return null;
  }

  const metrics = naturalSize.width > 0 && naturalSize.height > 0
    ? getAvatarCropMetrics(naturalSize.width, naturalSize.height, zoom)
    : null;

  const clampOffset = (next: CropOffset): CropOffset => {
    if (!metrics) {
      return next;
    }

    return {
      x: clamp(next.x, -metrics.maxOffsetX, metrics.maxOffsetX),
      y: clamp(next.y, -metrics.maxOffsetY, metrics.maxOffsetY),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!metrics) {
      return;
    }

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) {
      return;
    }

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setOffset(
      clampOffset({
        x: dragStartRef.current.offsetX + deltaX,
        y: dragStartRef.current.offsetY + deltaY,
      })
    );
  };

  const stopDragging = () => {
    dragStartRef.current = null;
    setIsDragging(false);
  };

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom);
    if (naturalSize.width > 0 && naturalSize.height > 0) {
      const nextMetrics = getAvatarCropMetrics(naturalSize.width, naturalSize.height, nextZoom);
      setOffset((current) => ({
        x: clamp(current.x, -nextMetrics.maxOffsetX, nextMetrics.maxOffsetX),
        y: clamp(current.y, -nextMetrics.maxOffsetY, nextMetrics.maxOffsetY),
      }));
    }
  };

  const handleApply = async () => {
    if (!metrics || naturalSize.width <= 0 || naturalSize.height <= 0) {
      return;
    }

    setIsApplying(true);
    try {
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Не вдалося завантажити фото для обрізки'));
        img.src = imageSrc;
      });

      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_OUTPUT_SIZE;
      canvas.height = AVATAR_OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Не вдалося підготувати обрізане фото');
      }

      const left = AVATAR_CROP_VIEW_SIZE / 2 - metrics.displayWidth / 2 + offset.x;
      const top = AVATAR_CROP_VIEW_SIZE / 2 - metrics.displayHeight / 2 + offset.y;
      const sx = ((0 - left) / metrics.displayWidth) * naturalSize.width;
      const sy = ((0 - top) / metrics.displayHeight) * naturalSize.height;
      const sw = (AVATAR_CROP_VIEW_SIZE / metrics.displayWidth) * naturalSize.width;
      const sh = (AVATAR_CROP_VIEW_SIZE / metrics.displayHeight) * naturalSize.height;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const croppedBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92)
      );
      const safeBaseName = (fileName || 'student-avatar').replace(/\.[^.]+$/, '');
      const croppedFile = croppedBlob
        ? new File([croppedBlob], `${safeBaseName}-avatar.jpg`, { type: 'image/jpeg' })
        : null;

      onApply(croppedDataUrl, croppedFile);
    } catch (error) {
      console.error('Failed to crop student avatar:', error);
      alert('Не вдалося обрізати фото. Спробуйте ще раз.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.68)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10050,
        padding: '1.5rem',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92vw, 540px)',
          backgroundColor: '#fff',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1.25rem 1.5rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
            Обрізати фото учня
          </div>
          <div style={{ marginTop: '0.375rem', fontSize: '0.925rem', color: '#6b7280' }}>
            Перетягніть фото та налаштуйте масштаб, щоб обрати потрібну область.
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            style={{
              width: `${AVATAR_CROP_VIEW_SIZE}px`,
              height: `${AVATAR_CROP_VIEW_SIZE}px`,
              maxWidth: '100%',
              margin: '0 auto',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '24px',
              background:
                'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(14,165,233,0.08) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.16)',
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            {metrics && (
              <img
                src={imageSrc}
                alt="Обрізка фото"
                draggable={false}
                style={{
                  position: 'absolute',
                  width: `${metrics.displayWidth}px`,
                  height: `${metrics.displayHeight}px`,
                  left: `calc(50% - ${metrics.displayWidth / 2}px + ${offset.x}px)`,
                  top: `calc(50% - ${metrics.displayHeight / 2}px + ${offset.y}px)`,
                  pointerEvents: 'none',
                }}
              />
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                border: '2px solid rgba(255, 255, 255, 0.92)',
                borderRadius: '24px',
                boxShadow: 'inset 0 0 0 9999px rgba(15, 23, 42, 0.24)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: '72%',
                height: '72%',
                transform: 'translate(-50%, -50%)',
                border: '1px dashed rgba(255, 255, 255, 0.92)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }}
            />
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#6b7280', minWidth: '56px' }}>Масштаб</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '0.9rem', color: '#111827', width: '48px', textAlign: 'right' }}>
              {zoom.toFixed(1)}x
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '0 1.5rem 1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isApplying}>
            Скасувати
          </button>
          <button type="button" className="btn btn-primary" onClick={handleApply} disabled={isApplying}>
            {isApplying ? 'Застосування...' : 'Застосувати'}
          </button>
        </div>
      </div>
    </div>
  );
}

const RELATION_OPTIONS = [
  { value: 'mother', label: t('forms.relationMother') },
  { value: 'father', label: t('forms.relationFather') },
  { value: 'grandmother', label: t('forms.relationGrandmother') },
  { value: 'grandfather', label: t('forms.relationGrandfather') },
  { value: 'other', label: t('forms.relationOther') },
];

const SOURCE_OPTIONS = [
  { value: 'social', label: t('forms.sourceSocial') },
  { value: 'friends', label: t('forms.sourceFriends') },
  { value: 'search', label: t('forms.sourceSearch') },
  { value: 'other', label: t('forms.sourceOther') },
];

// Hardcoded status labels
const STATUS_LABELS: Record<string, string> = {
  active: 'Активна',
  inactive: 'Неактивна',
  graduate: 'Випущена',
  archived: 'Архів',
};

// Format phone number for display
function formatPhone(phone: string | null): string {
  if (!phone) return '';
  // Remove +380 and format
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12) {
    return `+${digits.slice(0, 3)} (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
  }
  return phone;
}

// Calculate age from birth date
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

// Get first letter of name for avatar
function getFirstLetter(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function formatPhoneNumber(value: string): string {
  if (value === '') {
    return '';
  }
  
  let digits = value.replace(/\D/g, '');
  if (digits.length === 0) {
    return '';
  }
  
  const phoneDigits = digits.slice(-9);
  return phoneDigits;
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

export default function StudentProfilePage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useUser();
  const [student, setStudent] = useState<Student | null>(null);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropImageName, setCropImageName] = useState('');
  const [formData, setFormData] = useState<StudentFormData>({
    first_name: '',
    last_name: '',
    birth_date: '',
    email: '',
    school: '',
    discount: '',
    photo: null,
    photoFile: null,
    phone: '',
    parent_name: '',
    parent_relation: '',
    parent_relation_other: '',
    parent_phone: '',
    parent2_name: '',
    parent2_phone: '',
    parent2_relation: '',
    parent2_relation_other: '',
    notes: '',
    interested_courses: [],
    source: '',
    source_other: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Group modal state - support multiple open windows
  const [openGroupModals, setOpenGroupModals] = useState<Record<number, boolean>>({});
  const [groupModalData, setGroupModalData] = useState<Record<number, GroupDetails>>({});
  const [loadingGroupData, setLoadingGroupData] = useState<Record<number, boolean>>({});
  
  // Courses for autocomplete
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);
  
  // Quick notes editing
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  
  // Student modals - close modal when navigating to this student profile
  const { closeStudentModal } = useStudentModals();
  const { openLessonModal } = useLessonModals();
  
  // Close modal when this page mounts
  useEffect(() => {
    const numericStudentId = parseInt(studentId);
    if (!isNaN(numericStudentId) && closeStudentModal) {
      // Small delay to ensure the modal manager is ready
      const timer = setTimeout(() => {
        closeStudentModal(numericStudentId);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [studentId, closeStudentModal]);
 
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch student with groups
        const studentRes = await fetch(`/api/students/${studentId}?withGroups=true`);
        if (studentRes.status === 404) {
          setNotFound(true);
          return;
        }
        if (!studentRes.ok) {
          router.push('/students');
          return;
        }
        const studentData = await studentRes.json();
        setStudent(studentData.student);
        setGroups(studentData.student.groups || []);
        
        // Fetch courses for autocomplete
        const coursesRes = await fetch('/api/courses');
        if (coursesRes.ok) {
          const coursesData = await coursesRes.json();
          setCourses(coursesData.courses || []);
        }
      } catch (error) {
        console.error('Failed to fetch student:', error);
        router.push('/students');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, router]);

  // Auto-hide toast after 2 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const getRelationLabel = (relation: string | null): string => {
    if (!relation) return '';
    const option = RELATION_OPTIONS.find(opt => opt.value === relation);
    return option ? option.label : relation;
  };

  const getSourceLabel = (source: string | null): string => {
    if (!source) return '';
    const option = SOURCE_OPTIONS.find(opt => opt.value === source);
    return option ? option.label : source;
  };

  const startEdit = () => {
    if (!student) return;
    
    const nameParts = student.full_name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    let phoneDigits = '';
    if (student.phone) {
      const digits = student.phone.replace(/\D/g, '');
      phoneDigits = digits.slice(-9);
    }
    
    let parentPhoneDigits = '';
    if (student.parent_phone) {
      const digits = student.parent_phone.replace(/\D/g, '');
      parentPhoneDigits = digits.slice(-9);
    }
    
    setFormData({
      first_name: firstName,
      last_name: lastName,
      birth_date: student.birth_date ? student.birth_date.slice(0, 10) : '',
      email: student.email || '',
      school: student.school || '',
      discount: student.discount != null ? String(student.discount) : '',
      photo: student.photo,
      photoFile: null,
      phone: phoneDigits,
      parent_name: student.parent_name || '',
      parent_relation: student.parent_relation || '',
      parent_relation_other: '',
      parent_phone: parentPhoneDigits,
      parent2_name: student.parent2_name || '',
      parent2_phone: student.parent2_phone || '',
      parent2_relation: student.parent2_relation || '',
      parent2_relation_other: '',
      notes: student.notes || '',
      interested_courses: student.interested_courses ? student.interested_courses.split(',').map(s => s.trim()).filter(Boolean) : [],
      source: student.source || '',
      source_other: '',
    });
    setIsEditMode(true);
    setErrors({});
  };

  const cancelEdit = () => {
    setIsEditMode(false);
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.first_name.trim()) {
      newErrors.first_name = t('validation.required');
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = t('validation.required');
    }
    if (!formData.phone || formData.phone.length !== 9) {
      newErrors.phone = t('validation.required');
    }
    if (!formData.parent_name.trim()) {
      newErrors.parent_name = t('validation.required');
    }
    if (!formData.parent_relation) {
      newErrors.parent_relation = t('validation.required');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !student) return;
    
    setSaving(true);
    try {
      const fullName = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();

      // If a new photo file was selected, upload to Cloudinary first
      let photoUrl: string | null = formData.photo;
      if (formData.photoFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.photoFile);
        uploadFormData.append('folder', 'students');
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadFormData });
        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json();
          setToast({ message: uploadData.error || 'Не вдалося завантажити фото', type: 'error' });
          return;
        }
        const uploadData = await uploadRes.json();
        photoUrl = uploadData.url;
      }

      const apiData = {
        full_name: fullName,
        phone: formData.phone ? `+380${formData.phone}` : null,
        email: formData.email || null,
        parent_name: formData.parent_name,
        parent_phone: formData.parent_phone ? `+380${formData.parent_phone}` : null,
        notes: formData.notes,
        birth_date: formData.birth_date,
        school: formData.school,
        discount: formData.discount,
        parent_relation: formData.parent_relation === 'other' ? formData.parent_relation_other : formData.parent_relation,
        parent2_name: formData.parent2_name,
        parent2_phone: formData.parent2_phone || null,
        parent2_relation: formData.parent2_relation === 'other' ? formData.parent2_relation_other : formData.parent2_relation,
        interested_courses: formData.interested_courses.join(', '),
        source: formData.source === 'other' ? formData.source_other : formData.source,
        photo: photoUrl,
      };
      
      const response = await fetch(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });
      
      if (!response.ok) {
        const data = await response.json();
        setToast({ message: data.error || 'Не вдалося зберегти', type: 'error' });
        return;
      }
      
      // Refresh student data
      const studentRes = await fetch(`/api/students/${studentId}?withGroups=true`);
      const studentData = await studentRes.json();
      setStudent(studentData.student);
      setGroups(studentData.student.groups || []);
      
      setIsEditMode(false);
      setToast({ message: 'Дані успішно збережено', type: 'success' });
    } catch (error) {
      console.error('Failed to save student:', error);
      setToast({ message: 'Не вдалося зберегти', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImageSrc(reader.result as string);
        setCropImageName(file.name);
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetPhotoPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropCancel = () => {
    setCropModalOpen(false);
    setCropImageSrc(null);
    setCropImageName('');
    resetPhotoPicker();
  };

  const handleCropApply = (croppedDataUrl: string, croppedFile: File | null) => {
    setFormData({
      ...formData,
      photo: croppedDataUrl,
      photoFile: croppedFile,
    });
    setCropModalOpen(false);
    setCropImageSrc(null);
    setCropImageName('');
    resetPhotoPicker();
  };

  const removePhoto = () => {
    setFormData({ 
      ...formData, 
      photo: null, 
      photoFile: null 
    });
    resetPhotoPicker();
  };

  const toggleCourse = (courseId: string) => {
    setFormData(prev => ({
      ...prev,
      interested_courses: prev.interested_courses.includes(courseId)
        ? prev.interested_courses.filter(id => id !== courseId)
        : [...prev.interested_courses, courseId]
    }));
  };

  const handlePhoneChange = (field: 'phone' | 'parent_phone', value: string) => {
    const formatted = formatPhoneNumber(value);
    setFormData({ ...formData, [field]: formatted });
  };

  // Quick notes editing functions
  const startEditNotes = () => {
    if (!student) return;
    setEditedNotes(student.notes || '');
    setIsEditingNotes(true);
  };

  const cancelEditNotes = () => {
    setIsEditingNotes(false);
    setEditedNotes('');
  };

  const saveNotes = async () => {
    if (!student) return;
    
    setSavingNotes(true);
    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editedNotes }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        setToast({ message: data.error || 'Не вдалося зберегти нотатки', type: 'error' });
        return;
      }
      
      // Update local state
      setStudent({ ...student, notes: editedNotes || null });
      setIsEditingNotes(false);
      setToast({ message: 'Нотатки збережено', type: 'success' });
    } catch (error) {
      console.error('Failed to save notes:', error);
      setToast({ message: 'Не вдалося зберегти нотатки', type: 'error' });
    } finally {
      setSavingNotes(false);
    }
  };

  const clearNotes = async () => {
    if (!student) return;
    
    setSavingNotes(true);
    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '' }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        setToast({ message: data.error || 'Не вдалося очистити нотатки', type: 'error' });
        return;
      }
      
      // Update local state
      setStudent({ ...student, notes: null });
      setIsEditingNotes(false);
      setToast({ message: 'Нотатки очищено', type: 'success' });
    } catch (error) {
      console.error('Failed to clear notes:', error);
      setToast({ message: 'Не вдалося очистити нотатки', type: 'error' });
    } finally {
      setSavingNotes(false);
    }
  };

  // Open group modal and load data
  const handleOpenGroupModal = async (group: StudentGroup) => {
    // Add to localStorage for global manager
    try {
      const stored = localStorage.getItem('itrobot-group-modals');
      const modals = stored ? JSON.parse(stored) : [];
      
      // Check if already open
      if (!modals.find((m: any) => m.id === group.id)) {
        modals.push({
          id: group.id,
          title: group.title,
          position: { x: 100 + Math.random() * 100, y: 100 + Math.random() * 100 },
          size: { width: 520, height: 480 },
        });
        localStorage.setItem('itrobot-group-modals', JSON.stringify(modals));
      }
    } catch (e) {
      console.error('Error saving modal state:', e);
    }
    
    // Also open locally for current page
    setOpenGroupModals(prev => ({ ...prev, [group.id]: true }));
    
    // Load group details if not already loaded
    if (!groupModalData[group.id]) {
      setLoadingGroupData(prev => ({ ...prev, [group.id]: true }));
      try {
        const response = await fetch(`/api/groups/${group.id}?withStudents=true`);
        if (response.ok) {
          const data = await response.json();
          setGroupModalData(prev => ({ ...prev, [group.id]: data }));
        }
      } catch (error) {
        console.error('Error loading group:', error);
      } finally {
        setLoadingGroupData(prev => ({ ...prev, [group.id]: false }));
      }
    }
  };

  // Close group modal
  const handleCloseGroupModal = (groupId: number) => {
    setOpenGroupModals(prev => {
      const newState = { ...prev };
      delete newState[groupId];
      return newState;
    });
    
    // Remove from localStorage
    try {
      const stored = localStorage.getItem('itrobot-group-modals');
      if (stored) {
        const modals = JSON.parse(stored);
        const newModals = modals.filter((m: any) => m.id !== groupId);
        localStorage.setItem('itrobot-group-modals', JSON.stringify(newModals));
      }
    } catch (e) {
      console.error('Error removing modal state:', e);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <>
        <div style={{ maxWidth: '100%' }}>

          {/* Animated student icon */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', paddingTop: '0.25rem' }}>
            {/* Orbiting icons + central avatar */}
            <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.875rem' }}>
              {/* Outer dashed ring */}
              <div className="student-loader-ring-outer" style={{ position: 'absolute', width: 110, height: 110, borderRadius: '50%', border: '1.5px dashed #93c5fd', opacity: 0.6 }} />
              {/* Inner dashed ring */}
              <div className="student-loader-ring-inner" style={{ position: 'absolute', width: 84, height: 84, borderRadius: '50%', border: '1.5px dashed #bfdbfe', opacity: 0.5 }} />

              {/* Orbiting icon 1 — book */}
              <div className="student-loader-orbit-1" style={{ position: 'absolute', width: 24, height: 24, borderRadius: '50%', backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', boxShadow: '0 2px 6px rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>

              {/* Orbiting icon 2 — star */}
              <div className="student-loader-orbit-2" style={{ position: 'absolute', width: 22, height: 22, borderRadius: '50%', backgroundColor: '#fefce8', border: '1.5px solid #fde68a', boxShadow: '0 2px 6px rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>

              {/* Orbiting icon 3 — pencil */}
              <div className="student-loader-orbit-3" style={{ position: 'absolute', width: 22, height: 22, borderRadius: '50%', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', boxShadow: '0 2px 6px rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                  <path d="M17 3L21 7L11 17H7V13L17 3Z" strokeLinejoin="round"/>
                </svg>
              </div>

              {/* Central avatar */}
              <div className="student-loader-avatar" style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#3b82f6', border: '3px solid white', boxShadow: '0 4px 16px rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            </div>
            {/* Name skeleton */}
            <div className="skeleton" style={{ height: 13, width: 96, borderRadius: 6 }} />
          </div>

          {/* Header skeleton */}
          <div className="skeleton-card-enter" style={{ animationDelay: '0.28s', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div className="skeleton" style={{ height: 26, width: 88, borderRadius: 6 }} />
              <div className="skeleton" style={{ height: 22, width: 110, borderRadius: 999 }} />
            </div>
            <div className="skeleton" style={{ height: 40, width: 130, borderRadius: 8 }} />
          </div>

          {/* Two-column layout skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2.5rem', alignItems: 'start' }}>

            {/* Left: profile card */}
            <div className="card skeleton-card-enter" style={{ animationDelay: '0.38s', padding: '2rem', overflow: 'hidden', borderRadius: '1.25rem' }}>
              {/* Big avatar circle */}
              <div className="skeleton" style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', marginBottom: '1.5rem' }} />
              {/* Name */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem', marginBottom: '1.5rem' }}>
                <div className="skeleton" style={{ height: 28, width: '70%', borderRadius: 7 }} />
                <div className="skeleton" style={{ height: 20, width: '45%', borderRadius: 999 }} />
              </div>
              {/* Info lines */}
              {[90, 75, 80].map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem' }}>
                  <div className="skeleton" style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0 }} />
                  <div className="skeleton" style={{ height: 13, width: `${w}%`, borderRadius: 4 }} />
                </div>
              ))}
            </div>

            {/* Right: detail cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Groups card */}
              <div className="card skeleton-card-enter" style={{ animationDelay: '0.48s', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4 }} />
                  <div className="skeleton" style={{ height: 18, width: 100, borderRadius: 5 }} />
                </div>
                {[1, 2].map(i => (
                  <div key={i} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="skeleton" style={{ height: 15, width: 160, borderRadius: 4, marginBottom: 6 }} />
                      <div className="skeleton" style={{ height: 12, width: 110, borderRadius: 4 }} />
                    </div>
                    <div className="skeleton" style={{ height: 22, width: 70, borderRadius: 999 }} />
                  </div>
                ))}
              </div>

              {/* Attendance card */}
              <div className="card skeleton-card-enter" style={{ animationDelay: '0.54s', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                  <div className="skeleton" style={{ height: 18, width: 130, borderRadius: 5 }} />
                </div>
                <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ flex: 1, padding: '0.875rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', textAlign: 'center' }}>
                      <div className="skeleton" style={{ height: 24, width: '60%', borderRadius: 5, margin: '0 auto 6px' }} />
                      <div className="skeleton" style={{ height: 11, width: '80%', borderRadius: 3, margin: '0 auto' }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Payments card */}
              <div className="card skeleton-card-enter" style={{ animationDelay: '0.60s', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4 }} />
                  <div className="skeleton" style={{ height: 18, width: 90, borderRadius: 5 }} />
                </div>
                {[1, 2].map(i => (
                  <div key={i} style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                      <div>
                        <div className="skeleton" style={{ height: 14, width: 90, borderRadius: 4, marginBottom: 5 }} />
                        <div className="skeleton" style={{ height: 11, width: 70, borderRadius: 4 }} />
                      </div>
                    </div>
                    <div className="skeleton" style={{ height: 18, width: 60, borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return null;
  }

  // At this point, user is guaranteed to be defined
  const currentUser = user as User;

  // Show 404 state
  if (notFound || !student) {
    return (
      <>
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Учня не знайдено</h1>
          <a href="/students" className="btn btn-primary">Повернутися до списку</a>
        </div>
      </>
    );
  }

  const isAdmin = currentUser.role === 'admin';
  const age = calculateAge(student.birth_date);
  const firstLetter = getFirstLetter(student.full_name);

  // Edit mode form
  if (isEditMode) {
    return (
      <>
        <StudentAvatarCropModal
          isOpen={cropModalOpen}
          imageSrc={cropImageSrc}
          fileName={cropImageName}
          onCancel={handleCropCancel}
          onApply={handleCropApply}
        />

        {/* Breadcrumb */}
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => router.push('/students')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--gray-500)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.5rem',
              marginLeft: '-0.5rem',
              marginBottom: '0.5rem',
              borderRadius: '0.375rem',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--primary)';
              e.currentTarget.style.backgroundColor = 'var(--gray-100)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--gray-500)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {t('nav.students')}
          </button>
        </div>

        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>
            Редагування учня
          </h1>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={cancelEdit}
              className="btn btn-secondary"
              disabled={saving}
            >
              Скасувати
            </button>
            <button
              onClick={handleSave}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Збереження...' : 'Зберегти'}
            </button>
          </div>
        </div>

        {/* Edit Form */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '320px 1fr', 
          gap: '1.5rem',
          alignItems: 'start'
        }}>
          {/* Left Column: Photo */}
          <div style={{ position: 'sticky', top: '1rem' }}>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 1rem 0', color: 'var(--gray-700)', textAlign: 'left' }}>
                Фото учня
              </h3>
              
              <div style={{
                width: '160px',
                height: '160px',
                borderRadius: '50%',
                margin: '0 auto 1rem',
                overflow: 'hidden',
                backgroundColor: '#e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid #e0e7ff',
              }}>
                {formData.photo ? (
                  <img
                    src={formData.photo}
                    alt="Student"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <span style={{
                    fontSize: '3rem',
                    fontWeight: 600,
                    color: '#4f46e5',
                  }}>
                    {formData.first_name ? getFirstLetter(formData.first_name) : '?'}
                  </span>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                >
                  Завантажити
                </button>
                {formData.photo && (
                  <button
                    onClick={removePhoto}
                    className="btn"
                    style={{ 
                      fontSize: '0.8125rem', 
                      padding: '0.375rem 0.75rem',
                      backgroundColor: 'var(--gray-100)',
                      color: 'var(--gray-600)',
                    }}
                  >
                    Видалити
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Form Fields */}
          <div>
            {/* Basic Info Card */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.25rem 0', color: 'var(--gray-700)' }}>
                Основна інформація
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Ім'я *
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  {errors.first_name && (
                    <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.first_name}</div>
                  )}
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Прізвище *
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  {errors.last_name && (
                    <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.last_name}</div>
                  )}
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Дата народження
                  </label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                    placeholder="student@example.com"
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Школа
                  </label>
                  <input
                    type="text"
                    value={formData.school}
                    onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                    placeholder="Назва школи"
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Знижка
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={formData.discount.replace(/[^0-9]/g, '')}
                      onChange={(e) => setFormData({ ...formData, discount: e.target.value.replace(/[^0-9]/g, '') })}
                      className="form-input"
                      style={{ 
                        width: '100%',
                        borderRadius: '0.375rem 0 0 0.375rem',
                        borderRight: 'none'
                      }}
                      placeholder="10"
                      min="0"
                      max="100"
                    />
                    <span style={{ 
                      padding: '0.5rem 0.75rem', 
                      backgroundColor: 'var(--gray-100)', 
                      border: '1px solid var(--gray-300)',
                      borderLeft: 'none',
                      borderRadius: '0 0.375rem 0.375rem 0',
                      color: 'var(--gray-700)',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}>
                      %
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Основний контакт */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.25rem 0', color: 'var(--gray-700)' }}>
                Основний контакт
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Телефон *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ 
                      padding: '0.625rem 0.75rem', 
                      backgroundColor: 'var(--gray-100)', 
                      border: '1px solid var(--gray-300)',
                      borderRight: 'none',
                      borderRadius: '0.375rem 0 0 0.375rem',
                      color: 'var(--gray-500)',
                      fontSize: '0.875rem'
                    }}>
                      +380
                    </span>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handlePhoneChange('phone', e.target.value)}
                      className="form-input"
                      style={{ 
                        width: '100%',
                        borderRadius: '0 0.375rem 0.375rem 0',
                        marginLeft: '-1px'
                      }}
                      placeholder="XX XXX XX XX"
                      maxLength={9}
                    />
                  </div>
                  {errors.phone && (
                    <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.phone}</div>
                  )}
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Ім'я контактної особи *
                  </label>
                  <input
                    type="text"
                    value={formData.parent_name}
                    onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  {errors.parent_name && (
                    <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.parent_name}</div>
                  )}
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Стосунок *
                  </label>
                  <select
                    value={formData.parent_relation}
                    onChange={(e) => setFormData({ ...formData, parent_relation: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">Оберіть...</option>
                    {RELATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {errors.parent_relation && (
                    <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.parent_relation}</div>
                  )}
                </div>
                
                {formData.parent_relation === 'other' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                      Вкажіть стосунок
                    </label>
                    <input
                      type="text"
                      value={formData.parent_relation_other}
                      onChange={(e) => setFormData({ ...formData, parent_relation_other: e.target.value })}
                      className="form-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Додатковий контакт */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.25rem 0', color: 'var(--gray-700)' }}>
                Додатковий контакт
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Телефон
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ 
                      padding: '0.625rem 0.75rem', 
                      backgroundColor: 'var(--gray-100)', 
                      border: '1px solid var(--gray-300)',
                      borderRight: 'none',
                      borderRadius: '0.375rem 0 0 0.375rem',
                      color: 'var(--gray-500)',
                      fontSize: '0.875rem'
                    }}>
                      +380
                    </span>
                    <input
                      type="tel"
                      value={formData.parent_phone}
                      onChange={(e) => handlePhoneChange('parent_phone', e.target.value)}
                      className="form-input"
                      style={{ 
                        width: '100%',
                        borderRadius: '0 0.375rem 0.375rem 0',
                        marginLeft: '-1px'
                      }}
                      placeholder="XX XXX XX XX"
                      maxLength={9}
                    />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Ім'я контактної особи
                  </label>
                  <input
                    type="text"
                    value={formData.parent2_name}
                    onChange={(e) => setFormData({ ...formData, parent2_name: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Стосунок
                  </label>
                  <select
                    value={formData.parent2_relation}
                    onChange={(e) => setFormData({ ...formData, parent2_relation: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">Оберіть...</option>
                    {RELATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                {formData.parent2_relation === 'other' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                      Вкажіть стосунок
                    </label>
                    <input
                      type="text"
                      value={formData.parent2_relation_other}
                      onChange={(e) => setFormData({ ...formData, parent2_relation_other: e.target.value })}
                      className="form-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Additional Info Card */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.25rem 0', color: 'var(--gray-700)' }}>
                Додаткова інформація
              </h3>
              
              {/* Interested Courses */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.5rem' }}>
                  Цікаві курси
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setCoursesDropdownOpen(!coursesDropdownOpen)}
                    className="btn"
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      backgroundColor: 'white',
                      border: '1px solid var(--gray-300)',
                      padding: '0.625rem 0.75rem',
                    }}
                  >
                    <span style={{ color: formData.interested_courses.length > 0 ? 'var(--gray-900)' : 'var(--gray-500)' }}>
                      {formData.interested_courses.length > 0 
                        ? `${formData.interested_courses.length} обрано`
                        : 'Оберіть курси'}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  
                  {coursesDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '0.25rem',
                      backgroundColor: 'white',
                      border: '1px solid var(--gray-200)',
                      borderRadius: '0.375rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 20,
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}>
                      {courses.map(course => (
                        <label
                          key={course.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <input
                            type="checkbox"
                            checked={formData.interested_courses.includes(course.title)}
                            onChange={() => toggleCourse(course.title)}
                            style={{ width: '16px', height: '16px' }}
                          />
                          <span style={{ fontSize: '0.875rem' }}>{course.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                
                {formData.interested_courses.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
                    {formData.interested_courses.map(courseName => (
                      <span
                        key={courseName}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: 'var(--primary-light)',
                          color: 'var(--primary)',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                        }}
                      >
                        {courseName}
                        <button
                          onClick={() => toggleCourse(courseName)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: 'var(--primary)',
                            display: 'flex',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Source */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                  Джерело
                </label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="form-input"
                  style={{ width: '100%' }}
                >
                  <option value="">Оберіть...</option>
                  {SOURCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {formData.source === 'other' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Вкажіть джерело
                  </label>
                  <input
                    type="text"
                    value={formData.source_other}
                    onChange={(e) => setFormData({ ...formData, source_other: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                  Нотатки
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
                  placeholder="Додаткова інформація про учня..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Toast notification */}
        {toast && (
          <div
            className={`toast toast-${toast.type}`}
            style={{
              position: 'fixed',
              bottom: '1.5rem',
              right: '1.5rem',
              zIndex: 1000,
            }}
          >
            {toast.message}
          </div>
        )}
      </>
    );
  }

  // View mode - Profile display
  return (
    <>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => router.push('/students')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--gray-500)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.5rem',
            marginLeft: '-0.5rem',
            marginBottom: '0.5rem',
            borderRadius: '0.375rem',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--primary)';
            e.currentTarget.style.backgroundColor = 'var(--gray-100)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--gray-500)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {t('nav.students')}
        </button>
      </div>

      {/* Header with Edit Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ 
            fontFamily: 'monospace', 
            fontSize: '0.875rem', 
            color: 'var(--gray-500)', 
            padding: '0.375rem 0.75rem', 
            backgroundColor: 'var(--gray-100)', 
            borderRadius: '0.5rem' 
          }}>
            {student.public_id}
          </span>
          <span className={`badge ${student.study_status === 'studying' ? 'badge-success' : 'badge-gray'}`}>
            {student.study_status === 'studying' ? 'Навчається' : 'Не навчається'}
          </span>
        </div>
        
        {isAdmin && (
          <button
            onClick={startEdit}
            className="btn btn-primary"
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              borderRadius: '0.5rem',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Редагувати
          </button>
        )}
      </div>

      {/* Main Layout: Photo Left, Content Right */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr',
        gap: '3rem',
        marginBottom: '3rem'
      }}>
        {/* Desktop: Side by side */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '350px 1fr', 
          gap: '2.5rem',
          alignItems: 'start'
        }}>
          {/* Left Column: Photo and Quick Info */}
          <div style={{ position: 'sticky', top: '1rem' }}>
            <div className="card" style={{ 
              padding: '2rem', 
              overflow: 'hidden', 
              borderRadius: '1.25rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}>
              {/* Photo with Discount Badge */}
              <div style={{ position: 'relative', marginBottom: '2rem' }}>
                <div style={{
                  aspectRatio: '1',
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  width: '100%',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  border: '3px solid white',
                }}>
                  {student.photo ? (
                    <img
                      src={student.photo}
                      alt={student.full_name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <span style={{
                      fontSize: '5rem',
                      fontWeight: 700,
                      color: '#6b7280',
                    }}>
                      {firstLetter}
                    </span>
                  )}
                </div>
                
                {/* Discount Badge on Avatar Corner */}
                {student.discount != null && student.discount > 0 && (
                  <div
                    title={`Знижка на навчання: ${student.discount}%`}
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      right: '-12px',
                      backgroundColor: 'var(--warning)',
                      color: 'white',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '9999px',
                      fontSize: '0.875rem',
                      fontWeight: '700',
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      zIndex: 1,
                      border: '3px solid white',
                      transform: 'scale(1)',
                      transition: 'transform 0.2s ease',
                      cursor: 'pointer',
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                      <line x1="7" y1="7" x2="7.01" y2="7"></line>
                    </svg>
                    {student.discount}%
                  </div>
                )}
              </div>
              
              {/* Quick Info */}
              <div style={{ textAlign: 'center' }}>
                <h1 style={{ 
                  fontSize: '2.25rem', 
                  fontWeight: '700', 
                  margin: '0 0 0.75rem 0', 
                  letterSpacing: '-0.025em', 
                  color: 'var(--gray-900)' 
                }}>
                  {student.full_name}
                </h1>
                
                {age !== null && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: '0.75rem',
                    color: 'var(--primary)', 
                    fontSize: '2rem', 
                    fontWeight: '700',
                    marginBottom: '2rem',
                    letterSpacing: '-0.025em',
                  }}>
                    <div style={{ 
                      padding: '0.5rem', 
                      backgroundColor: 'var(--primary-light)', 
                      borderRadius: '0.5rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                        <circle cx="12" cy="15" r="2"></circle>
                      </svg>
                    </div>
                    {age} {age === 1 ? 'рік' : age >= 2 && age <= 4 ? 'роки' : 'років'}
                  </div>
                )}

                {/* Contacts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {/* Основний контакт */}
                  {student.phone && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#ecfdf5',
                        borderRadius: '0.625rem',
                        border: '1px solid #a7f3d0',
                        transition: 'background-color 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ecfdf5'}
                    >
                      <div style={{ 
                        padding: '0.375rem', 
                        backgroundColor: copiedField === 'phone-main' ? '#a7f3d0' : '#d1fae5', 
                        borderRadius: '0.375rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}>
                        {copiedField === 'phone-main' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: '600', marginBottom: '0.125rem' }}>Основний контакт</div>
                        {student.parent_name && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--gray-700)', marginBottom: '0.25rem' }}>
                            {student.parent_name} {student.parent_relation && <span style={{ color: 'var(--gray-500)' }}>({getRelationLabel(student.parent_relation)})</span>}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <a
                          href={`tel:${student.phone}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(student.phone || '');
                            setCopiedField('phone-main');
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          style={{
                            color: copiedField === 'phone-main' ? '#059669' : 'var(--gray-900)',
                            textDecoration: 'none',
                            fontSize: '0.9375rem',
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
                  
                  {/* Додатковий контакт */}
                  {student.parent_phone && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#eff6ff',
                        borderRadius: '0.625rem',
                        border: '1px solid #bfdbfe',
                        transition: 'background-color 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                    >
                      <div style={{ 
                        padding: '0.375rem', 
                        backgroundColor: copiedField === 'phone-parent' ? '#bfdbfe' : '#dbeafe', 
                        borderRadius: '0.375rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}>
                        {copiedField === 'phone-parent' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.6875rem', color: '#2563eb', fontWeight: '600', marginBottom: '0.125rem' }}>Додатковий контакт</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-700)', marginBottom: '0.25rem' }}>
                          {student.parent2_name || 'Батьки'} {student.parent2_relation && <span style={{ color: 'var(--gray-500)' }}>({getRelationLabel(student.parent2_relation)})</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <a
                          href={`tel:${student.parent_phone}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(student.parent_phone || '');
                            setCopiedField('phone-parent');
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          style={{
                            color: copiedField === 'phone-parent' ? '#2563eb' : 'var(--gray-900)',
                            textDecoration: 'none',
                            fontSize: '0.9375rem',
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
                  
                  {/* Email */}
                  {student.email && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#fdf2f8',
                      borderRadius: '0.625rem',
                      border: '1px solid #fbcfe8',
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fce7f3'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fdf2f8'}
                    >
                      <div style={{ 
                        padding: '0.375rem', 
                        backgroundColor: copiedField === 'email' ? '#fbcfe8' : '#fce7f3', 
                        borderRadius: '0.375rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}>
                        {copiedField === 'email' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.6875rem', color: '#db2777', fontWeight: '600', marginBottom: '0.125rem' }}>Email</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <a
                          href={`mailto:${student.email}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(student.email || '');
                            setCopiedField('email');
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          style={{
                            color: copiedField === 'email' ? '#db2777' : 'var(--gray-900)',
                            textDecoration: 'none',
                            fontSize: '0.9375rem',
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
                </div>
              </div>
            </div>
            <StudentHistoryPanel studentId={String(student.id)} />
          </div>

          {/* Right Column: Content */}
          <div>
            {/* Basic Info Card */}
            <div className="card" style={{ 
              marginBottom: '2rem', 
              padding: '2rem', 
              borderRadius: '1rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
            }}>
              <h2 style={{ 
                fontSize: '1.125rem', 
                fontWeight: '600', 
                margin: '0 0 1.5rem 0', 
                color: 'var(--gray-800)',
                letterSpacing: '-0.025em'
              }}>
                Основна інформація
              </h2>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                gap: '1.5rem' 
              }}>
                {student.birth_date && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '1rem',
                    padding: '1rem',
                    backgroundColor: '#fafafa',
                    borderRadius: '0.75rem',
                    transition: 'background-color 0.2s ease',
                  }}>
                    <div style={{ 
                      padding: '0.75rem', 
                      backgroundColor: '#fef3c7', 
                      borderRadius: '0.5rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        color: 'var(--gray-500)', 
                        fontSize: '0.875rem', 
                        marginBottom: '0.375rem', 
                        fontWeight: '500' 
                      }}>
                        Дата народження
                      </div>
                      <div style={{ fontSize: '1rem', color: 'var(--gray-900)' }}>
                        {formatDateKyiv(student.birth_date)}
                      </div>
                    </div>
                  </div>
                )}
                
                {student.school && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '1rem',
                    padding: '1rem',
                    backgroundColor: '#fafafa',
                    borderRadius: '0.75rem',
                    transition: 'background-color 0.2s ease',
                  }}>
                    <div style={{ 
                      padding: '0.75rem', 
                      backgroundColor: '#dbeafe', 
                      borderRadius: '0.5rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        color: 'var(--gray-500)', 
                        fontSize: '0.875rem', 
                        marginBottom: '0.375rem', 
                        fontWeight: '500' 
                      }}>
                        Школа
                      </div>
                      <div style={{ fontSize: '1rem', color: 'var(--gray-900)' }}>
                        {student.school}
                      </div>
                    </div>
                  </div>
                )}
                
                {student.interested_courses && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '1rem',
                    padding: '1rem',
                    backgroundColor: '#fafafa',
                    borderRadius: '0.75rem',
                    transition: 'background-color 0.2s ease',
                  }}>
                    <div style={{ 
                      padding: '0.75rem', 
                      backgroundColor: '#fce7f3', 
                      borderRadius: '0.5rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        color: 'var(--gray-500)', 
                        fontSize: '0.875rem', 
                        marginBottom: '0.375rem', 
                        fontWeight: '500' 
                      }}>
                        Цікаві курси
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {student.interested_courses.split(',').map((course, idx) => (
                          <span
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.375rem 0.75rem',
                              backgroundColor: 'var(--primary-light)',
                              color: 'var(--primary)',
                              borderRadius: '0.5rem',
                              fontSize: '0.8125rem',
                              fontWeight: '500',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--primary)';
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                              e.currentTarget.style.color = 'var(--primary)';
                            }}
                          >
                            {course.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {student.source && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '1rem',
                    padding: '1rem',
                    backgroundColor: '#fafafa',
                    borderRadius: '0.75rem',
                    transition: 'background-color 0.2s ease',
                  }}>
                    <div style={{ 
                      padding: '0.75rem', 
                      backgroundColor: '#e0e7ff', 
                      borderRadius: '0.5rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        color: 'var(--gray-500)', 
                        fontSize: '0.875rem', 
                        marginBottom: '0.375rem', 
                        fontWeight: '500' 
                      }}>
                        Джерело
                      </div>
                      <div style={{ fontSize: '1rem', color: 'var(--gray-900)' }}>
                        {getSourceLabel(student.source)}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Created Date */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '1rem',
                  padding: '1rem',
                  backgroundColor: '#fafafa',
                  borderRadius: '0.75rem',
                  transition: 'background-color 0.2s ease',
                }}>
                  <div style={{ 
                    padding: '0.75rem', 
                    backgroundColor: '#d1fae5', 
                    borderRadius: '0.5rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      color: 'var(--gray-500)', 
                      fontSize: '0.875rem', 
                      marginBottom: '0.375rem', 
                      fontWeight: '500' 
                    }}>
                      Створено
                    </div>
                    <div style={{ fontSize: '1rem', color: 'var(--gray-900)' }}>
                      {formatDateTimeKyiv(student.created_at)}
                    </div>
                  </div>
                </div>
                
                {/* Updated Date (if different from created) */}
                {student.updated_at && student.updated_at !== student.created_at && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '1rem',
                    padding: '1rem',
                    backgroundColor: '#fafafa',
                    borderRadius: '0.75rem',
                    transition: 'background-color 0.2s ease',
                  }}>
                    <div style={{ 
                      padding: '0.75rem', 
                      backgroundColor: '#fef3c7', 
                      borderRadius: '0.5rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        color: 'var(--gray-500)', 
                        fontSize: '0.875rem', 
                        marginBottom: '0.375rem', 
                        fontWeight: '500' 
                      }}>
                        Оновлено
                      </div>
                      <div style={{ fontSize: '1rem', color: 'var(--gray-900)' }}>
                        {formatDateTimeKyiv(student.updated_at)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Groups Card */}
            {groups.length > 0 && (
              <div className="card" style={{ 
                marginBottom: '2rem', 
                overflow: 'hidden',
                borderRadius: '1rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '1.5rem 2rem',
                  borderBottom: '1px solid var(--gray-200)'
                }}>
                  <h2 style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: '600', 
                    margin: 0,
                    color: 'var(--gray-800)',
                    letterSpacing: '-0.025em'
                  }}>
                    Групи учня
                  </h2>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '28px',
                    height: '28px',
                    padding: '0 0.625rem',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    borderRadius: '14px',
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                  }}>
                    {groups.length}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => handleOpenGroupModal(group)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1.25rem 2rem',
                        borderBottom: '1px solid var(--gray-100)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div>
                        <div style={{ 
                          fontSize: '1rem', 
                          fontWeight: '600', 
                          color: 'var(--gray-900)', 
                          marginBottom: '0.375rem' 
                        }}>
                          {group.title}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                          {group.course_title}
                          {group.teacher_name && ` • ${group.teacher_name}`}
                          {group.join_date && ` • Доданий: ${formatDateKyiv(group.join_date)}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span className={`badge ${group.status === 'active' ? 'badge-success' : group.status === 'graduate' ? 'badge-info' : 'badge-gray'}`}>
                          {STATUS_LABELS[group.status] || group.status}
                        </span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes Card */}
            <div className="card" style={{ 
              marginBottom: '2rem', 
              padding: '2rem',
              borderRadius: '1rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}>
                <h2 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '600', 
                  margin: 0, 
                  color: 'var(--gray-800)',
                  letterSpacing: '-0.025em'
                }}>
                  Нотатки
                </h2>
                {!isEditingNotes && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={startEditNotes}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        border: 'none',
                        borderRadius: '0.5rem',
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    {student.notes && (
                      <button
                        onClick={clearNotes}
                        disabled={savingNotes}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '36px',
                          height: '36px',
                          border: 'none',
                          borderRadius: '0.5rem',
                          backgroundColor: '#fef2f2',
                          color: '#ef4444',
                          cursor: savingNotes ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          opacity: savingNotes ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!savingNotes) {
                            e.currentTarget.style.backgroundColor = '#fee2e2';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#fef2f2';
                        }}
                        title="Очистити нотатки"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {isEditingNotes ? (
                <div>
                  <textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    placeholder="Додайте нотатки про учня..."
                    style={{
                      width: '100%',
                      minHeight: '150px',
                      padding: '1rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.75rem',
                      fontSize: '1rem',
                      lineHeight: '1.7',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      onClick={saveNotes}
                      disabled={savingNotes}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.625rem 1.25rem',
                        border: 'none',
                        borderRadius: '0.5rem',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: savingNotes ? 'not-allowed' : 'pointer',
                        opacity: savingNotes ? 0.7 : 1
                      }}
                    >
                      {savingNotes ? 'Збереження...' : 'Зберегти'}
                    </button>
                    <button
                      onClick={cancelEditNotes}
                      disabled={savingNotes}
                      style={{
                        padding: '0.625rem 1.25rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        backgroundColor: 'white',
                        color: '#6b7280',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: savingNotes ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Скасувати
                    </button>
                  </div>
                </div>
              ) : student.notes ? (
                <div style={{ 
                  padding: '1.5rem', 
                  backgroundColor: '#fefce8', 
                  borderRadius: '0.75rem',
                  border: '1px solid #fef08a',
                  color: 'var(--gray-700)',
                  fontSize: '1rem',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-wrap',
                }}>
                  {student.notes}
                </div>
              ) : (
                <div style={{ 
                  padding: '1.5rem', 
                  backgroundColor: '#f9fafb', 
                  borderRadius: '0.75rem',
                  border: '1px dashed #e5e7eb',
                  color: '#9ca3af',
                  fontSize: '1rem',
                  textAlign: 'center'
                }}>
                  Нотаток немає. Натисніть кнопку редагування, щоб додати.
                </div>
              )}
            </div>

            {/* Payments Panel */}
            <StudentPaymentsPanel studentId={student.id} />

            {/* Attendance Panel */}
            <StudentAttendancePanel
              studentId={student.id}
              onOpenLesson={(lessonId) => openLessonModal(lessonId, `Заняття #${lessonId}`, undefined)}
            />

          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 1000,
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Group Modals - Render all open modals */}
      {Object.entries(openGroupModals).map(([groupId, isOpen]) => {
        const id = parseInt(groupId);
        if (!isOpen) return null;
        const groupResponse = groupModalData[id];
        const groupData = groupResponse?.group;
        const studentsData = groupResponse?.students;
        const groupInfo = groups.find(g => g.id === id);
        const isLoading = loadingGroupData[id];

        return (
          <DraggableModal
            key={id}
            id={`group-modal-${id}`}
            isOpen={isOpen}
            onClose={() => handleCloseGroupModal(id)}
            title={groupInfo?.title || groupData?.title || 'Група'}
            groupUrl={`/groups/${id}`}
            initialWidth={520}
            initialHeight={480}
          >
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ color: '#6b7280' }}>Завантаження...</div>
              </div>
            ) : groupData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${groupData.is_active ? 'badge-success' : 'badge-gray'}`}>
                    {groupData.is_active ? 'Активна' : 'Неактивна'}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                    {groupData.status === 'active' ? 'Активна' : groupData.status === 'completed' ? 'Завершена' : 'Архівна'}
                  </span>
                </div>

                {/* Course */}
                {groupData.course_title && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Курс</span>
                    <span style={{ fontSize: '0.9375rem', color: '#1f2937' }}>{groupData.course_title}</span>
                  </div>
                )}

                {/* Schedule */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Розклад</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '0.5rem',
                      border: '1px solid #bae6fd',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#0369a1' }}>
                        {getDayName(groupData.weekly_day)}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#fef3c7',
                      borderRadius: '0.5rem',
                      border: '1px solid #fde68a',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#b45309' }}>
                        {formatTime(groupData.start_time)}
                        {groupData.end_time && ` - ${formatTime(groupData.end_time)}`}
                      </span>
                    </div>
                    {groupData.room && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#f3e8ff',
                        borderRadius: '0.5rem',
                        border: '1px solid #d8b4fe',
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#7e22ce' }}>
                          {groupData.room}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Students Count */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Студенти</span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: '#ecfdf5',
                    borderRadius: '0.5rem',
                    border: '1px solid #a7f3d0',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#047857' }}>
                      {studentsData?.length || 0} студентів
                    </span>
                  </div>
                </div>

                {/* Students List */}
                {studentsData && studentsData.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {studentsData.map((student) => (
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
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            backgroundColor: '#dbeafe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            border: '2px solid #bfdbfe',
                          }}>
                            {student.photo ? (
                              <img 
                                src={student.photo} 
                                alt={student.full_name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                color: '#2563eb',
                              }}>
                                {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '500', color: '#111827' }}>{student.full_name}</p>
                            <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>{student.phone || 'Телефон не вказано'}</p>
                            {student.join_date && (
                              <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Доданий: {formatDateKyiv(student.join_date)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {groupData.notes && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Нотатки</span>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.5 }}>
                      {groupData.notes}
                    </p>
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
