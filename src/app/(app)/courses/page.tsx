'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Portal from '@/components/Portal';
import { t } from '@/i18n/t';
import { useCourseModals } from '@/components/CourseModalsContext';

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
  is_active: number;
  groups_count?: number;
  students_count?: number;
}

interface CourseGroup {
  id: number;
  public_id: string | null;
  title: string;
  status: string;
  teacher_name: string | null;
}

export default function CoursesPage() {
  const router = useRouter();
  const { openCourseModal } = useCourseModals();
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({ 
    title: '', 
    description: '', 
    age_min: 6, 
    duration_months: 1, 
    program: '' 
  });
  const [formErrors, setFormErrors] = useState<{ age_min?: string }>({});
  const [saving, setSaving] = useState(false);
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [uploadingFlyer, setUploadingFlyer] = useState(false);
  const [deletingFlyer, setDeletingFlyer] = useState(false);
  const [flyerError, setFlyerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [courseGroupsForDelete, setCourseGroupsForDelete] = useState<CourseGroup[]>([]);
  const [loadingGroupsForDelete, setLoadingGroupsForDelete] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const dropdownButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  

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

        const coursesRes = await fetch('/api/courses?withStats=true&includeInactive=true');
        const coursesData = await coursesRes.json();
        setCourses(coursesData.courses || []);
      } catch (error) {
        console.error('Failed to fetch courses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // Handle click outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !(dropdownButtonRef.current && dropdownButtonRef.current.contains(target)) &&
        !(dropdownMenuRef.current && dropdownMenuRef.current.contains(target))
      ) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.trim()) {
      const res = await fetch(`/api/courses?search=${encodeURIComponent(query)}&withStats=true&includeInactive=true`);
      const data = await res.json();
      setCourses(data.courses || []);
    } else {
      const res = await fetch('/api/courses?withStats=true&includeInactive=true');
      const data = await res.json();
      setCourses(data.courses || []);
    }
  };

  const handleCreate = () => {
    setEditingCourse(null);
    setFormData({ 
      title: '', 
      description: '', 
      age_min: 6, 
      duration_months: 1, 
      program: '' 
    });
    setFormErrors({});
    setFlyerFile(null);
    setFlyerError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowModal(true);
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({ 
      title: course.title, 
      description: course.description || '', 
      age_min: course.age_min || 6, 
      duration_months: course.duration_months || 1, 
      program: course.program || '' 
    });
    setFormErrors({});
    setFlyerFile(null);
    setFlyerError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowModal(true);
  };

  const validateAgeMin = (value: number): string | null => {
    if (!Number.isInteger(value) || value < 0 || value > 99) {
      return t('validation.invalidAgeFormat');
    }
    return null;
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return;
    
    // Validate age_min
    const ageError = validateAgeMin(formData.age_min);
    if (ageError) {
      setFormErrors({ age_min: ageError });
      return;
    }
    
    setFormErrors({});
    setSaving(true);
    try {
      if (editingCourse) {
        await fetch(`/api/courses/${editingCourse.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        
        // If flyer file was selected during edit, upload it now
        if (flyerFile) {
          const formDataToSend = new FormData();
          formDataToSend.append('flyer', flyerFile);
          
          const flyerResponse = await fetch(`/api/courses/${editingCourse.id}/flyer`, {
            method: 'POST',
            body: formDataToSend,
          });
          
          if (!flyerResponse.ok) {
            console.error('Failed to upload flyer');
          }
          // Clear flyer file after upload
          setFlyerFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      } else {
        // Create course first
        const createResponse = await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        
        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          console.error('Failed to create course:', errorData);
          setSaving(false);
          return;
        }
        
        const createdCourse = await createResponse.json();
        
        // If flyer file was selected, upload it now
        if (flyerFile) {
          const formDataToSend = new FormData();
          formDataToSend.append('flyer', flyerFile);
          
          const flyerResponse = await fetch(`/api/courses/${createdCourse.id}/flyer`, {
            method: 'POST',
            body: formDataToSend,
          });
          
          if (!flyerResponse.ok) {
            console.error('Failed to upload flyer');
          }
          // Clear flyer file after upload
          setFlyerFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      }
      
      setShowModal(false);
      // Refresh courses
      const res = await fetch('/api/courses?withStats=true&includeInactive=true');
      const data = await res.json();
      console.log('[CLIENT] Refreshed courses after save:', data.courses?.length, 'courses');
      if (data.courses) {
        console.log('[CLIENT] First course sample after save:', data.courses[0]);
      }
      setCourses(data.courses || []);
    } catch (error) {
      console.error('Failed to save course:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (course: Course) => {
    const action = course.is_active ? t('actions.archive') : t('actions.restore');
    const actionType = course.is_active ? 'archive' : 'restore';
    if (!confirm(`${action} ${t('nav.courses').toLowerCase()} "${course.title}"?`)) return;
    
    try {
      await fetch(`/api/courses/${course.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType }),
      });
      
      // Refresh courses based on current filter
      const includeInactive = showArchived;
      const res = await fetch(`/api/courses?withStats=true&includeInactive=true`);
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (error) {
      console.error('Failed to archive/restore course:', error);
    }
  };

  const handleDeleteClick = async (course: Course) => {
    setCourseToDelete(course);
    setDeletePassword('');
    setDeleteError('');
    setShowDeleteModal(true);
    
    // Fetch groups for this course to show in warning
    setLoadingGroupsForDelete(true);
    try {
      const groupsRes = await fetch(`/api/courses/${course.id}/groups`);
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        setCourseGroupsForDelete(groupsData.groups || []);
      } else {
        setCourseGroupsForDelete([]);
      }
    } catch (error) {
      console.error('Failed to fetch groups for delete warning:', error);
      setCourseGroupsForDelete([]);
    } finally {
      setLoadingGroupsForDelete(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!courseToDelete) return;
    
    setDeleting(true);
    setDeleteError('');
    
    try {
      const response = await fetch(`/api/courses/${courseToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword })
      });
      
      if (response.ok) {
        setShowDeleteModal(false);
        setCourseToDelete(null);
        setDeletePassword('');
        // Refresh courses list
        const res = await fetch('/api/courses?withStats=true&includeInactive=true');
        const data = await res.json();
        setCourses(data.courses || []);
      } else {
        const errorData = await response.json();
        // Handle specific error codes with UA messages
        if (response.status === 401) {
          setDeleteError('Невірний пароль');
        } else if (response.status === 403) {
          setDeleteError('Недостатньо прав');
        } else if (response.status === 409) {
          setDeleteError("Неможливо видалити курс: є пов'язані дані");
        } else {
          setDeleteError(errorData.error || 'Сталася помилка. Спробуйте ще раз.');
        }
      }
    } catch (error) {
      console.error('Failed to delete course:', error);
      setDeleteError('Сталася помилка. Спробуйте ще раз.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setCourseToDelete(null);
    setDeletePassword('');
    setDeleteError('');
    setCourseGroupsForDelete([]);
  };

  const handleFlyerUpload = async () => {
    if (!editingCourse || !flyerFile) return;
    
    setUploadingFlyer(true);
    setFlyerError(null);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('flyer', flyerFile);
      
      const response = await fetch(`/api/courses/${editingCourse.id}/flyer`, {
        method: 'POST',
        body: formDataToSend,
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update the course in the list
        setCourses(prev => prev.map(c => 
          c.id === editingCourse.id ? { ...c, flyer_path: data.flyer_path } : c
        ));
        // Update editingCourse to reflect new flyer
        setEditingCourse({ ...editingCourse, flyer_path: data.flyer_path });
        setFlyerFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const error = await response.json();
        setFlyerError(error.error || t('flyer.uploadFailed'));
      }
    } catch (error) {
      console.error('Failed to upload flyer:', error);
      setFlyerError(t('flyer.uploadFailed'));
    } finally {
      setUploadingFlyer(false);
    }
  };

  const handleFlyerDelete = async () => {
    if (!editingCourse || !editingCourse.flyer_path) return;
    
    if (!confirm(t('flyer.deleteConfirm'))) return;
    
    setDeletingFlyer(true);
    setFlyerError(null);
    try {
      const response = await fetch(`/api/courses/${editingCourse.id}/flyer`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Update the course in the list
        setCourses(prev => prev.map(c => 
          c.id === editingCourse.id ? { ...c, flyer_path: null } : c
        ));
        // Update editingCourse to reflect deleted flyer
        setEditingCourse({ ...editingCourse, flyer_path: null });
      } else {
        const error = await response.json();
        setFlyerError(error.error || t('flyer.deleteFailed'));
      }
    } catch (error) {
      console.error('Failed to delete flyer:', error);
      setFlyerError(t('flyer.deleteFailed'));
    } finally {
      setDeletingFlyer(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFlyerError(null);
    if (file) {
      // Validate file type
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setFlyerError(t('flyer.invalidType'));
        return;
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setFlyerError(t('flyer.tooLarge'));
        return;
      }
      setFlyerFile(file);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('common.loading')}</div>;
  }

  if (!user) return null;

  const filteredCourses = courses
    .filter(c => {
      // Filter by archived status
      if (showArchived) {
        return c.is_active === 0 && c.title.toLowerCase().includes(search.toLowerCase());
      }
      return c.is_active === 1 && c.title.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'uk'));

  // DEBUG: тимчасове логування
  console.log('[CLIENT] filteredCourses count:', filteredCourses.length, 'from total:', courses.length, 'showArchived:', showArchived);

  return (
    <Layout user={user}>
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder={`${t('actions.search')} ${t('nav.courses').toLowerCase()}...`}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Toggle switch for archived courses */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              <span 
                style={{ 
                  fontSize: '0.8125rem', 
                  fontWeight: !showArchived ? '600' : '400', 
                  color: !showArchived ? '#111827' : '#9ca3af',
                  transition: 'all 0.2s',
                }}
              >
                {t('status.active')}
              </span>
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                style={{
                  position: 'relative',
                  width: '36px',
                  height: '20px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  margin: '0 0.375rem',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    backgroundColor: showArchived ? '#6b7280' : '#374151',
                    borderRadius: '3px',
                    transition: 'all 0.2s',
                    transform: showArchived ? 'translateX(18px)' : 'translateX(0)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}
                />
              </button>
              <span 
                style={{ 
                  fontSize: '0.8125rem', 
                  fontWeight: showArchived ? '600' : '400', 
                  color: showArchived ? '#111827' : '#9ca3af',
                  transition: 'all 0.2s',
                }}
              >
                {t('status.archived')}
              </span>
            </div>
            {user.role === 'admin' && (
              <button className="btn btn-primary" onClick={handleCreate}>
                + {t('modals.newCourse')}
              </button>
            )}
          </div>
        </div>

        <div className="table-container">
          {filteredCourses.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('table.id')}</th>
                  <th>{t('table.title')}</th>
                  <th style={{ textAlign: 'center' }}>{t('table.age')}</th>
                  <th style={{ textAlign: 'center' }}>{t('table.duration')}</th>
                  <th>{t('table.description')}</th>
                  <th style={{ textAlign: 'center' }}>{t('table.groups')}</th>
                  <th style={{ textAlign: 'center' }}>{t('table.students')}</th>
                  <th>{t('common.status')}</th>
                  {user.role === 'admin' && <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((course) => (
                  <tr key={course.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280' }}>
                      {course.public_id}
                    </td>
                    <td>
                      <a href={`/courses/${course.id}`} style={{ fontWeight: '500' }}>
                        {course.title}
                      </a>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                       <span style={{ fontWeight: '500' }}>{course.age_min ? `${course.age_min}+` : '---'}</span>
                     </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {course.duration_months ? `${course.duration_months} міс.` : '---'}
                    </td>
                    <td style={{ color: '#6b7280', maxWidth: '300px' }}>
                      {course.description || '---'}
                    </td>
                    <td style={{ textAlign: 'center' }}>{course.groups_count || 0}</td>
                    <td style={{ textAlign: 'center' }}>{course.students_count || 0}</td>
                    <td>
                      <span className={`badge ${course.is_active ? 'badge-success' : 'badge-gray'}`}>
                        {course.is_active ? t('status.active') : t('status.archived')}
                      </span>
                    </td>
                    {user.role === 'admin' && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-block' }}>
                          <button
                            ref={openDropdownId === course.id ? dropdownButtonRef : undefined}
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === course.id ? null : course.id);
                            }}
                            style={{ 
                              padding: '0.5rem',
                              borderRadius: '0.5rem',
                              backgroundColor: openDropdownId === course.id ? '#f3f4f6' : 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="12" cy="19" r="2" />
                            </svg>
                          </button>
                          {openDropdownId === course.id && (
                            <Portal anchorRef={dropdownButtonRef} menuRef={dropdownMenuRef} offsetY={6}>
                              <div
                                style={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '0.75rem',
                                  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15), 0 0 2px rgba(0,0,0,0.1)',
                                  minWidth: '200px',
                                  padding: '0.5rem',
                                  zIndex: 50,
                                  overflow: 'hidden',
                                  animation: 'dropdownFadeIn 0.15s ease-out',
                                }}
                              >
                                <style>{`
                                  @keyframes dropdownFadeIn {
                                    from { opacity: 0; transform: translateY(-8px); }
                                    to { opacity: 1; transform: translateY(0); }
                                  }
                                `}</style>
                                <a
                                  href={`/courses/${course.id}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.625rem 0.75rem',
                                    color: '#374151',
                                    textDecoration: 'none',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    borderRadius: '0.5rem',
                                    transition: 'all 0.15s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#1f2937'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#374151'; }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280' }}>
                                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                  </svg>
                                  Переглянути курс
                                </a>
                                <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0' }} />
                                <button
                                  className="btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(course);
                                    setOpenDropdownId(null);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    width: '100%',
                                    padding: '0.625rem 0.75rem',
                                    color: '#374151',
                                    textAlign: 'left',
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#1f2937'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#374151'; }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280' }}>
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                  Редагувати курс
                                </button>
                                <button
                                  className="btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleArchive(course);
                                    setOpenDropdownId(null);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    width: '100%',
                                    padding: '0.625rem 0.75rem',
                                    color: course.is_active ? '#374151' : '#059669',
                                    textAlign: 'left',
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = course.is_active ? '#1f2937' : '#059669'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = course.is_active ? '#374151' : '#059669'; }}
                                >
                                  {course.is_active ? (
                                    <>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280' }}>
                                        <polyline points="21 8 21 21 3 21 3 8" />
                                        <rect x="1" y="3" width="22" height="5" />
                                        <line x1="10" y1="12" x2="14" y2="12" />
                                      </svg>
                                      Архівувати курс
                                    </>
                                  ) : (
                                    <>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#059669' }}>
                                        <polyline points="1 4 1 10 7 10" />
                                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                      </svg>
                                      Відновити курс
                                    </>
                                  )}
                                </button>
                                <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0' }} />
                                <button
                                  className="btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(course);
                                    setOpenDropdownId(null);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    width: '100%',
                                    padding: '0.625rem 0.75rem',
                                    color: '#dc2626',
                                    textAlign: 'left',
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.color = '#b91c1c'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#dc2626'; }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                  </svg>
                                  Видалити курс
                                </button>
                              </div>
                            </Portal>
                          )}
                        </div>
                      </td>
                    )}
                    <td style={{ textAlign: 'right', width: '40px' }}>
                      <button
                        onClick={() => {
                          openCourseModal(course.id, course.title);
                        }}
                        style={{
                          padding: '0.25rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#6b7280',
                        }}
                        title="Відкрити в модальному вікні"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <h3 className="empty-state-title">{t('emptyStates.noCourses')}</h3>
              <p className="empty-state-text">{t('emptyStates.noCoursesHint')}</p>
              {user.role === 'admin' && (
                <button className="btn btn-primary" onClick={handleCreate}>
                  {t('emptyStates.createCourse')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingCourse ? t('modals.editCourse') : t('modals.newCourse')}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('forms.courseTitle')} *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('forms.courseTitlePlaceholder')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('forms.courseDescription')}</label>
                <textarea
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('forms.courseDescriptionPlaceholder')}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('forms.courseAgeLabel')} *</label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  step="1"
                  className={`form-input ${formErrors.age_min ? 'form-input-error' : ''}`}
                  value={formData.age_min}
                  onChange={(e) => {
                    setFormData({ ...formData, age_min: parseInt(e.target.value, 10) || 0 });
                    if (formErrors.age_min) {
                      setFormErrors({ ...formErrors, age_min: undefined });
                    }
                  }}
                  placeholder={t('forms.courseAgeLabelPlaceholder')}
                />
                {formErrors.age_min && (
                  <span className="form-error">{formErrors.age_min}</span>
                )}
                <span className="form-hint">{t('forms.courseAgeLabelHint')}</span>
              </div>
              <div className="form-group">
                <label className="form-label">{t('forms.courseDurationMonths')} *</label>
                <select
                  className="form-input"
                  value={formData.duration_months}
                  onChange={(e) => setFormData({ ...formData, duration_months: parseInt(e.target.value) })}
                >
                  {Array.from({ length: 36 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {month} {month === 1 ? 'місяць' : month < 5 ? 'місяці' : 'місяців'}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Flyer upload section - available for both new and existing courses */}
              <div className="form-group">
                <label className="form-label">{t('flyer.title')} ({t('flyer.formats')})</label>
                
                {/* Error message */}
                {flyerError && (
                  <div style={{ 
                    color: '#dc2626', 
                    backgroundColor: '#fef2f2', 
                    padding: '0.75rem', 
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    marginBottom: '0.75rem'
                  }}>
                    {flyerError}
                  </div>
                )}
                
                {/* Show existing flyer preview only when editing and flyer exists */}
                {editingCourse && editingCourse.flyer_path ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ 
                      position: 'relative', 
                      display: 'inline-block',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      overflow: 'hidden'
                    }}>
                      <img 
                        src={editingCourse.flyer_path} 
                        alt="Course flyer" 
                        style={{ 
                          maxWidth: '200px', 
                          maxHeight: '200px', 
                          display: 'block' 
                        }} 
                      />
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <a 
                        href={editingCourse.flyer_path} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        {t('flyer.openFlyer')}
                      </a>
                      <a 
                        href={editingCourse.flyer_path} 
                        download
                        className="btn btn-secondary btn-sm"
                      >
                        {t('flyer.downloadFlyer')}
                      </a>
                      <button 
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={handleFlyerDelete}
                        disabled={deletingFlyer}
                      >
                        {deletingFlyer ? t('flyer.deleting') : t('flyer.deleteFlyer')}
                      </button>
                    </div>
                    {/* Change flyer option */}
                    <div style={{ marginTop: '1rem' }}>
                      <label className="form-label" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                        {t('flyer.changeFlyer')}:
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={handleFileChange}
                        style={{ marginTop: '0.25rem' }}
                      />
                      {flyerFile && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem' }}>
                            {flyerFile.name} ({(flyerFile.size / 1024).toFixed(1)} KB)
                          </span>
                          <button 
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleFlyerUpload}
                            disabled={uploadingFlyer}
                          >
                            {uploadingFlyer ? t('flyer.uploading') : t('flyer.uploadFlyer')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* File input for new flyer */
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleFileChange}
                      style={{ marginBottom: '0.5rem' }}
                    />
                    {flyerFile && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem' }}>
                          {flyerFile.name} ({(flyerFile.size / 1024).toFixed(1)} KB)
                        </span>
                        <button 
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleFlyerUpload}
                          disabled={uploadingFlyer}
                        >
                          {uploadingFlyer ? t('flyer.uploading') : t('flyer.uploadFlyer')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                {t('actions.cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !formData.title.trim()}
              >
                {saving ? t('common.saving') : t('actions.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && courseToDelete && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Підтвердження видалення</h3>
              <button className="modal-close" onClick={handleDeleteCancel} disabled={deleting}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 1rem 0' }}>
                Ви збираєтеся остаточно видалити курс <strong>{courseToDelete.title}</strong>.
              </p>
              
              {/* Warning about groups */}
              {loadingGroupsForDelete ? (
                <div style={{ 
                  backgroundColor: '#f3f4f6', 
                  borderRadius: '0.5rem', 
                  padding: '1rem', 
                  marginBottom: '1rem',
                  textAlign: 'center',
                  color: '#6b7280'
                }}>
                  Завантаження інформації про групи...
                </div>
              ) : courseGroupsForDelete.length > 0 ? (
                <div style={{
                  backgroundColor: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#92400e', fontWeight: 600 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Курс має навчальні групи
                  </div>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#92400e' }}>
                    При видаленні курсу будуть також видалені наступні групи ({courseGroupsForDelete.length}):
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#92400e' }}>
                    {courseGroupsForDelete.slice(0, 5).map(group => (
                      <li key={group.id}>
                        <strong>{group.title}</strong>
                        {group.teacher_name && <span> - {group.teacher_name}</span>}
                        <span className={`badge badge-${group.status === 'active' ? 'success' : group.status === 'graduate' ? 'info' : 'gray'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                          {group.status === 'active' ? 'Активна' : group.status === 'graduate' ? 'Випущена' : 'Неактивна'}
                        </span>
                      </li>
                    ))}
                    {courseGroupsForDelete.length > 5 && (
                      <li style={{ fontStyle: 'italic' }}>... та ще {courseGroupsForDelete.length - 5} група(и)</li>
                    )}
                  </ul>
                </div>
              ) : (
                <div style={{
                  backgroundColor: '#d1fae5',
                  border: '1px solid #10b981',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', fontWeight: 600 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Курс не має груп
                  </div>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#065f46' }}>
                    Курс можна безпечно видалити.
                  </p>
                </div>
              )}
              
              <p style={{ margin: '0 0 1rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                Ця дія незворотня. Всі дані про курс, включаючи групи та зв'язки з учнями, будуть видалені.
              </p>
              
              <p style={{ margin: '0 0 1rem 0' }}>
                Щоб підтвердити видалення, введіть пароль адміністратора.
              </p>
              
              <div className="form-group">
                <label className="form-label">Пароль</label>
                <input
                  type="password"
                  className="form-input"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Введіть пароль"
                  disabled={deleting}
                  autoFocus
                />
              </div>
              
              {deleteError && (
                <div style={{ 
                  color: '#dc2626', 
                  backgroundColor: '#fef2f2', 
                  padding: '0.75rem', 
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}>
                  {deleteError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleDeleteCancel} disabled={deleting}>
                Скасувати
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleDeleteConfirm} 
                disabled={deleting || !deletePassword.trim()}
              >
                {deleting ? 'Видалення...' : 'Видалити остаточно'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
