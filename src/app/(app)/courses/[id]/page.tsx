'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { t } from '@/i18n/t';
import PageLoading from '@/components/PageLoading';
import { uk } from '@/i18n/uk';

type CategoryType = 'active' | 'graduate' | 'inactive';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface Course {
  id: number;
  public_id: string;
  title: string;
  description: string | null;
  age_min: number;
  duration_months: number;
  program: string | null;
  flyer_path: string | null;
  is_active: boolean;
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
  created_at: string;
}

interface CourseStudent {
  id: number;
  public_id: string | null;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  groups: Array<{
    id: number;
    public_id: string | null;
    title: string;
    status: string;
    join_date: string;
  }>;
}

// Hardcoded status labels (do NOT edit i18n)
const STATUS_LABELS: Record<string, string> = {
  active: 'Активна',
  inactive: 'Неактивна',
  graduate: 'Випущена',
  archived: 'Архів',
};

export default function CourseDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  // Flyer upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Category filter state - default to active
  const [activeCategory, setActiveCategory] = useState<CategoryType>('active');
  
  // Program modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [programValue, setProgramValue] = useState('');
  const [savingProgram, setSavingProgram] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const MAX_PROGRAM_LENGTH = 10000;
  
  // Edit course modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    age_min: 6,
    duration_months: 1,
    program: ''
  });
  const [editFormErrors, setEditFormErrors] = useState<{ age_min?: string }>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFlyerFile, setEditFlyerFile] = useState<File | null>(null);
  const [editFlyerUploading, setEditFlyerUploading] = useState(false);
  const [editFlyerError, setEditFlyerError] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) {
          router.push('/login');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);

        const courseRes = await fetch(`/api/courses/${courseId}`);
        if (courseRes.status === 404) {
          setNotFound(true);
          return;
        }
        if (!courseRes.ok) {
          router.push('/courses');
          return;
        }
        const courseData = await courseRes.json();
        setCourse(courseData.course);

        // Fetch groups for this course
        const groupsRes = await fetch(`/api/courses/${courseId}/groups`);
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json();
          setGroups(groupsData.groups || []);
        }

        // Fetch students for this course
        const studentsRes = await fetch(`/api/courses/${courseId}/students`);
        if (studentsRes.ok) {
          const studentsData = await studentsRes.json();
          setStudents(studentsData.students || []);
        }
      } catch (error) {
        console.error('Failed to fetch course:', error);
        router.push('/courses');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, courseId]);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleOpenModal = () => {
    setProgramValue(course?.program || '');
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setProgramValue('');
    setIsEditMode(false);
  };

  const handleDownloadPdf = () => {
    if (!course) return;
    // Use window.open with '_blank' so browser sends cookies automatically
    window.open(`/api/courses/${course.id}/program-pdf`, '_blank');
  };
  
  // Edit course handlers
  const handleOpenEditModal = () => {
    if (!course) return;
    setEditFormData({
      title: course.title,
      description: course.description || '',
      age_min: course.age_min || 6,
      duration_months: course.duration_months || 1,
      program: course.program || ''
    });
    setEditFormErrors({});
    setEditFlyerFile(null);
    setEditFlyerError(null);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
    setShowEditModal(true);
  };
  
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditFormData({
      title: '',
      description: '',
      age_min: 6,
      duration_months: 1,
      program: ''
    });
    setEditFlyerFile(null);
    setEditFlyerError(null);
  };
  
  const handleEditFlyerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setEditFlyerError('Непідтримуваний тип файлу. Дозволяються лише JPEG та PNG');
      return;
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setEditFlyerError('Файл занадто великий. Максимальний розмір: 5MB');
      return;
    }
    
    setEditFlyerError(null);
    setEditFlyerFile(file);
  };
  
  const handleUploadEditFlyer = async () => {
    if (!course || !editFlyerFile) return;
    
    setEditFlyerUploading(true);
    setEditFlyerError(null);
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('flyer', editFlyerFile);
      
      const response = await fetch(`/api/courses/${course.id}/flyer`, {
        method: 'POST',
        body: formDataToSend,
      });
      
      if (response.ok) {
        const data = await response.json();
        setCourse({ ...course, flyer_path: data.flyer_path });
        setEditFlyerFile(null);
        if (editFileInputRef.current) {
          editFileInputRef.current.value = '';
        }
        setToast({ message: 'Флаєр успішно оновлено', type: 'success' });
      } else {
        const errorData = await response.json();
        setEditFlyerError(errorData.error || 'Не вдалося завантажити флаєр');
      }
    } catch (error) {
      console.error('Failed to upload flyer:', error);
      setEditFlyerError('Не вдалося завантажити флаєр');
    } finally {
      setEditFlyerUploading(false);
    }
  };
  
  const handleSaveEditCourse = async () => {
    if (!course) return;
    
    // Validate age_min
    const ageMinValue = Number(editFormData.age_min);
    if (!Number.isInteger(ageMinValue) || ageMinValue < 0 || ageMinValue > 99) {
      setEditFormErrors({ age_min: 'Вік повинен бути цілим числом від 0 до 99' });
      return;
    }
    
    setEditFormErrors({});
    setSavingEdit(true);
    
    try {
      // Save course data
      const response = await fetch(`/api/courses/${course.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setToast({ message: errorData.error || 'Не вдалося зберегти курс', type: 'error' });
        setSavingEdit(false);
        return;
      }
      
      // If flyer file was selected, upload it
      if (editFlyerFile) {
        const formDataToSend = new FormData();
        formDataToSend.append('flyer', editFlyerFile);
        
        const flyerResponse = await fetch(`/api/courses/${course.id}/flyer`, {
          method: 'POST',
          body: formDataToSend,
        });
        
        if (flyerResponse.ok) {
          const flyerData = await flyerResponse.json();
          setCourse({ ...course, ...editFormData, flyer_path: flyerData.flyer_path });
        } else {
          console.error('Failed to upload flyer');
        }
        
        setEditFlyerFile(null);
        if (editFileInputRef.current) {
          editFileInputRef.current.value = '';
        }
      } else {
        setCourse({ ...course, ...editFormData });
      }
      
      setShowEditModal(false);
      setToast({ message: 'Курс успішно оновлено', type: 'success' });
    } catch (error) {
      console.error('Failed to save course:', error);
      setToast({ message: 'Не вдалося зберегти курс', type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };
  
  const handleDownloadFlyer = async () => {
    if (!course) return;
    
    try {
      // Fetch flyer path from API to get the original image
      const response = await fetch(`/api/courses/${course.id}/flyer`);
      if (!response.ok) {
        setToast({ message: 'Не вдалося отримати флаєр', type: 'error' });
        return;
      }
      
      const data = await response.json();
      if (!data.flyer_path) {
        setToast({ message: 'Флаєр не знайдено', type: 'error' });
        return;
      }
      
      // Trigger download by creating a temporary anchor
      const link = document.createElement('a');
      link.href = data.flyer_path;
      link.download = data.flyer_path.split('/').pop() || 'flyer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download flyer:', error);
      setToast({ message: 'Не вдалося завантажити флаєр', type: 'error' });
    }
  };

  const handleSaveProgram = async () => {
    if (!course) return;
    
    // Validate length
    if (programValue.length > MAX_PROGRAM_LENGTH) {
      setToast({
        message: `Програма не може перевищувати ${MAX_PROGRAM_LENGTH.toLocaleString('uk-UA')} символів`,
        type: 'error',
      });
      return;
    }

    setSavingProgram(true);
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: course.title,
          description: course.description,
          age_min: course.age_min,
          duration_months: course.duration_months,
          program: programValue,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setToast({
          message: data.error || 'Не вдалося зберегти програму',
          type: 'error',
        });
        return;
      }

      // Update local state
      setCourse({ ...course, program: programValue || null });
      setIsEditMode(false);
      setToast({
        message: 'Програму успішно збережено',
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to save program:', error);
      setToast({
        message: 'Помилка мережі. Спробуйте ще раз.',
        type: 'error',
      });
    } finally {
      setSavingProgram(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  // Helper functions for groups
  const getDayName = (dayIndex: number) => {
    return uk.days[dayIndex as keyof typeof uk.days] || '';
  };

  // Calculate months since group was created
  const getMonthsSinceCreated = (createdAt: string) => {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    const now = new Date();
    const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
    return months > 0 ? months : 0;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'graduate':
        return 'badge-info';
      case 'inactive':
        return 'badge-gray';
      default:
        return 'badge-gray';
    }
  };

  // Filter groups by status
  const activeGroups = groups.filter(g => g.status === 'active');
  const graduateGroups = groups.filter(g => g.status === 'graduate');
  const inactiveGroups = groups.filter(g => g.status === 'inactive');
  
  // Get filtered groups based on active category
  const getFilteredGroups = () => {
    switch (activeCategory) {
      case 'active':
        return activeGroups;
      case 'graduate':
        return graduateGroups;
      case 'inactive':
        return inactiveGroups;
      default:
        return activeGroups;
    }
  };
  
  // Get counts for tabs
  const getCategoryCount = (category: CategoryType) => {
    switch (category) {
      case 'active':
        return activeGroups.length;
      case 'graduate':
        return graduateGroups.length;
      case 'inactive':
        return inactiveGroups.length;
      default:
        return 0;
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  if (notFound) {
    return (
      <Layout user={user!}>
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h3 className="empty-state-title">{t('errors.notFound')}</h3>
          <button className="btn btn-primary" onClick={() => router.push('/courses')}>
            {t('nav.courses')}
          </button>
        </div>
      </Layout>
    );
  }

  if (!user || !course) return null;

  return (
    <Layout user={user}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => router.push('/courses')}
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
          {t('nav.courses')}
        </button>
      </div>

      {/* Course Header with Program Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--gray-500)', padding: '0.25rem 0.5rem', backgroundColor: 'var(--gray-100)', borderRadius: '0.25rem' }}>
            {course.public_id}
          </span>
          <span className={`badge ${course.is_active ? 'badge-success' : 'badge-gray'}`}>
            {course.is_active ? t('status.active') : t('status.archived')}
          </span>
        </div>
        
        {/* Program Button in Header - Opens Modal */}
        {(course.program || isAdmin) && (
          <button
            onClick={handleOpenModal}
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Програма курсу
          </button>
        )}
        
        {/* Edit Course Button - Opens Edit Modal */}
        {isAdmin && (
          <button
            onClick={handleOpenEditModal}
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Редагувати курс
          </button>
        )}
      </div>

      {/* Main Layout: Flyer Left, Content Right */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Mobile: Stack vertically, Desktop: Side by side */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '320px 1fr', 
          gap: '1.5rem',
          alignItems: 'start'
        }}>
          {/* Left Column: Flyer */}
          <div style={{ position: 'sticky', top: '1rem' }}>
            <div className="card" style={{ padding: '0', overflow: 'hidden', borderRadius: '0.75rem' }}>
              {course.flyer_path ? (
                <img
                  src={course.flyer_path}
                  alt={course.title}
                  style={{
                    width: '100%',
                    height: 'auto',
                    aspectRatio: '9/16',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  aspectRatio: '9/16',
                  backgroundColor: 'var(--gray-100)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gray-400)',
                  padding: '2rem',
                }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '1rem' }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span style={{ fontSize: '0.875rem', textAlign: 'center' }}>
                    Немає флаєра
                  </span>
                </div>
              )}
            </div>
            
            {/* Download Flyer Button */}
            {course.flyer_path && (
              <button
                onClick={handleDownloadFlyer}
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: '0.75rem' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Завантажити флаєр
              </button>
            )}
          </div>

          {/* Right Column: Content */}
          <div>
            {/* Course Title */}
            <h1 style={{ fontSize: '2rem', fontWeight: '700', margin: '0 0 1.5rem 0', letterSpacing: '-0.025em', color: 'var(--gray-900)' }}>
              {course.title}
            </h1>

            {/* Опис програми */}
            {course.description && (
              <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 0.75rem 0', color: 'var(--gray-700)' }}>
                  Опис програми
                </h2>
                <p style={{ color: 'var(--gray-600)', margin: 0, fontSize: '0.9375rem', lineHeight: '1.7' }}>
                  {course.description}
                </p>
              </div>
            )}

            {/* Характеристики */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0', color: 'var(--gray-700)' }}>
                Характеристики
              </h2>
              <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: 'var(--gray-500)', fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: '500' }}>
                    Вік
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-900)' }}>
                    {course.age_min ? `${course.age_min}+` : '---'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--gray-500)', fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: '500' }}>
                    Тривалість
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-900)' }}>
                    {course.duration_months ? `${course.duration_months} міс.` : '---'}
                  </div>
                </div>
              </div>
            </div>

            {/* Групи курсу - Tab-based filtering */}
            <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--gray-200)'
              }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
                  Групи курсу
                </h2>
                {/* Small add button - always visible for admins */}
                {isAdmin && (
                  <a
                    href={`/groups/new?course_id=${course.id}`}
                    className="btn btn-secondary"
                    style={{ 
                      padding: '0.375rem 0.75rem', 
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Додати
                  </a>
                )}
              </div>
              
              {/* Category Tabs */}
              <div style={{ 
                display: 'flex', 
                gap: '0.25rem',
                padding: '0 1.5rem',
                backgroundColor: 'var(--gray-50)',
                borderBottom: '1px solid var(--gray-200)'
              }}>
                <button
                  onClick={() => setActiveCategory('active')}
                  style={{
                    padding: '0.875rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: activeCategory === 'active' ? 'var(--primary)' : 'var(--gray-500)',
                    backgroundColor: activeCategory === 'active' ? 'white' : 'transparent',
                    border: 'none',
                    borderBottom: activeCategory === 'active' ? '2px solid var(--primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '-1px',
                  }}
                >
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: activeCategory === 'active' ? 'var(--primary)' : 'var(--gray-300)',
                    color: activeCategory === 'active' ? 'white' : 'var(--gray-600)',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {getCategoryCount('active')}
                  </span>
                  Активні
                </button>
                
                <button
                  onClick={() => setActiveCategory('graduate')}
                  style={{
                    padding: '0.875rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: activeCategory === 'graduate' ? '#6366f1' : 'var(--gray-500)',
                    backgroundColor: activeCategory === 'graduate' ? 'white' : 'transparent',
                    border: 'none',
                    borderBottom: activeCategory === 'graduate' ? '2px solid #6366f1' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '-1px',
                  }}
                >
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: activeCategory === 'graduate' ? '#6366f1' : 'var(--gray-300)',
                    color: activeCategory === 'graduate' ? 'white' : 'var(--gray-600)',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {getCategoryCount('graduate')}
                  </span>
                  Випущені
                </button>
                
                <button
                  onClick={() => setActiveCategory('inactive')}
                  style={{
                    padding: '0.875rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: activeCategory === 'inactive' ? 'var(--gray-600)' : 'var(--gray-500)',
                    backgroundColor: activeCategory === 'inactive' ? 'white' : 'transparent',
                    border: 'none',
                    borderBottom: activeCategory === 'inactive' ? '2px solid var(--gray-500)' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '-1px',
                  }}
                >
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: activeCategory === 'inactive' ? 'var(--gray-500)' : 'var(--gray-300)',
                    color: activeCategory === 'inactive' ? 'white' : 'var(--gray-600)',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {getCategoryCount('inactive')}
                  </span>
                  Неактивні
                </button>
              </div>
              
              {/* Groups List */}
              <div style={{ padding: '1.5rem' }}>
                {getFilteredGroups().length > 0 ? (
                  <div style={{ 
                    display: 'grid', 
                    gap: '0.75rem'
                  }}>
                    {getFilteredGroups().map((group) => (
                      <a 
                        key={group.id} 
                        href={`/groups/${group.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '1rem 1.25rem',
                          backgroundColor: 'var(--gray-50)',
                          borderRadius: '0.5rem',
                          textDecoration: 'none',
                          color: 'inherit',
                          transition: 'all 0.2s ease',
                          border: '1px solid transparent',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.borderColor = 'var(--gray-300)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--gray-50)';
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '0.5rem',
                            backgroundColor: activeCategory === 'active' ? 'var(--success)' : activeCategory === 'graduate' ? '#6366f1' : 'var(--gray-400)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '0.875rem'
                          }}>
                            {group.title.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '0.9375rem', marginBottom: '0.125rem' }}>
                              {group.title}
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {group.weekly_day && group.start_time && (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  {getDayName(group.weekly_day)} {group.start_time}
                                </>
                              )}
                              {group.teacher_name && (
                                <>
                                  <span style={{ color: 'var(--gray-300)' }}>•</span>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                  </svg>
                                  {group.teacher_name}
                                </>
                              )}
                              <span style={{ color: 'var(--gray-300)' }}>•</span>
                              <span style={{ color: 'var(--gray-500)', fontWeight: 500 }}>
                                {getMonthsSinceCreated(group.created_at)} {uk.plural.month.many}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={`badge ${getStatusBadgeClass(group.status)}`}>
                            {STATUS_LABELS[group.status] || group.status}
                          </span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div style={{ 
                    padding: '3rem 2rem', 
                    textAlign: 'center', 
                    color: 'var(--gray-400)',
                    backgroundColor: 'var(--gray-50)',
                    borderRadius: '0.5rem',
                    border: '2px dashed var(--gray-200)'
                  }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.5 }}>
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9375rem', fontWeight: '500', color: 'var(--gray-600)' }}>
                      Немає {activeCategory === 'active' ? 'активних' : activeCategory === 'graduate' ? 'випущених' : 'неактивних'} груп
                    </p>
                    {isAdmin && activeCategory === 'active' && (
                      <a
                        href={`/groups/new?course_id=${course.id}`}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Створити групу
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Учні на цьому курсі */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.25rem 0', color: 'var(--gray-800)' }}>
                Учні на цьому курсі
              </h2>
              {students.length > 0 ? (
                <div className="table-container" style={{ padding: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>ПІБ</th>
                        <th>Група(и)</th>
                        <th>Статус групи</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <span style={{ 
                              fontFamily: 'monospace', 
                              fontSize: '0.875rem',
                              color: '#6b7280' 
                            }}>
                              {student.public_id || '—'}
                            </span>
                          </td>
                          <td>
                            <a href={`/students/${student.id}`} style={{ fontWeight: '500' }}>
                              {student.full_name}
                            </a>
                          </td>
                          <td>
                            {student.groups.map((g, idx) => (
                              <span key={g.id}>
                                <a href={`/groups/${g.id}`}>{g.title}</a>
                                {idx < student.groups.length - 1 && ', '}
                              </span>
                            ))}
                          </td>
                          <td>
                            {student.groups.map((g, idx) => (
                              <span key={g.id}>
                                <span className={`badge ${getStatusBadgeClass(g.status)}`}>
                                  {STATUS_LABELS[g.status] || g.status}
                                </span>
                                {idx < student.groups.length - 1 && ' '}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ 
                  padding: '2.5rem', 
                  textAlign: 'center', 
                  color: 'var(--gray-400)',
                  fontSize: '0.9375rem',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '0.5rem'
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.5 }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Немає учнів
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 320px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
            color: 'white',
            fontSize: '0.9375rem',
            fontWeight: '500',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            zIndex: 50,
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Program Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                Програма курсу: {course?.title}
              </h2>
              <button
                onClick={handleCloseModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem', flex: 1, overflow: 'auto' }}>
              {isEditMode ? (
                <textarea
                  value={programValue}
                  onChange={(e) => setProgramValue(e.target.value)}
                  placeholder="Введіть програму курсу..."
                  style={{
                    width: '100%',
                    minHeight: '400px',
                    padding: '1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.9375rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    lineHeight: '1.6',
                  }}
                />
              ) : (
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: '1.7',
                    fontSize: '0.9375rem',
                    color: programValue ? '#374151' : '#9ca3af',
                    minHeight: '200px',
                    padding: programValue ? '0.5rem' : '2rem',
                    textAlign: programValue ? 'left' : 'center',
                  }}
                >
                  {programValue || 'Програма курсу відсутня'}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                borderBottomLeftRadius: '0.75rem',
                borderBottomRightRadius: '0.75rem',
              }}
            >
              {/* Left side - Download PDF */}
              <button
                onClick={handleDownloadPdf}
                className="btn btn-secondary"
                disabled={!programValue}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Завантажити PDF
              </button>

              {/* Right side - Edit/Save/Cancel buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {isEditMode ? (
                  <>
                    <button
                      onClick={handleSaveProgram}
                      disabled={savingProgram}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {savingProgram ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
                            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" />
                          </svg>
                          Збереження...
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Зберегти
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setProgramValue(course?.program || '');
                        setIsEditMode(false);
                      }}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Скасувати
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Редагувати
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
      
      {/* Edit Course Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Редагування курсу</h3>
              <button className="modal-close" onClick={handleCloseEditModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Назва курсу *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  placeholder="Введіть назву курсу"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Опис</label>
                <textarea
                  className="form-input"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Введіть опис курсу"
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Вік дітей (від) *</label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  step="1"
                  className={`form-input ${editFormErrors.age_min ? 'form-input-error' : ''}`}
                  value={editFormData.age_min}
                  onChange={(e) => setEditFormData({ ...editFormData, age_min: parseInt(e.target.value) || 0 })}
                />
                {editFormErrors.age_min && (
                  <span className="form-error">{editFormErrors.age_min}</span>
                )}
              </div>
              
              <div className="form-group">
                <label className="form-label">Тривалість (місяців) *</label>
                <select
                  className="form-input"
                  value={editFormData.duration_months}
                  onChange={(e) => setEditFormData({ ...editFormData, duration_months: parseInt(e.target.value) })}
                >
                  {Array.from({ length: 36 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {month} {month === 1 ? 'місяць' : month < 5 ? 'місяці' : 'місяців'}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Flyer upload section */}
              <div className="form-group">
                <label className="form-label">Флаєр курсу (JPEG, PNG)</label>
                
                {editFlyerError && (
                  <div style={{ 
                    color: '#dc2626', 
                    backgroundColor: '#fef2f2', 
                    padding: '0.75rem', 
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    marginBottom: '0.75rem'
                  }}>
                    {editFlyerError}
                  </div>
                )}
                
                {course?.flyer_path ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ 
                      position: 'relative', 
                      display: 'inline-block',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      overflow: 'hidden'
                    }}>
                      <img 
                        src={course.flyer_path} 
                        alt="Course flyer" 
                        style={{ 
                          maxWidth: '200px', 
                          maxHeight: '200px', 
                          display: 'block' 
                        }} 
                      />
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <label className="form-label" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                        Змінити флаєр:
                      </label>
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={handleEditFlyerChange}
                        style={{ marginTop: '0.25rem' }}
                      />
                      {editFlyerFile && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem' }}>
                            {editFlyerFile.name} ({(editFlyerFile.size / 1024).toFixed(1)} KB)
                          </span>
                          <button 
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleUploadEditFlyer}
                            disabled={editFlyerUploading}
                          >
                            {editFlyerUploading ? 'Завантаження...' : 'Завантажити флаєр'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleEditFlyerChange}
                      style={{ marginBottom: '0.5rem' }}
                    />
                    {editFlyerFile && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem' }}>
                          {editFlyerFile.name} ({(editFlyerFile.size / 1024).toFixed(1)} KB)
                        </span>
                        <button 
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleUploadEditFlyer}
                          disabled={editFlyerUploading}
                        >
                          {editFlyerUploading ? 'Завантаження...' : 'Завантажити флаєр'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseEditModal}>
                Скасувати
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveEditCourse}
                disabled={savingEdit || !editFormData.title.trim()}
              >
                {savingEdit ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
