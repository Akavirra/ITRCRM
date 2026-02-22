'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import DraggableModal from '@/components/DraggableModal';
import { useGroupModals } from '@/components/GroupModalsContext';
import { formatDateKyiv } from '@/lib/date-utils';
import { t } from '@/i18n/t';
import PageLoading from '@/components/PageLoading';
import { uk } from '@/i18n/uk';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface Teacher {
  id: number;
  public_id: string | null;
  name: string;
  email: string;
  phone?: string;
  telegram_id?: string;
  photo_url?: string;
  notes?: string;
  is_active: boolean;
  groups: Array<{
    id: number;
    public_id: string;
    title: string;
    course_title: string;
    weekly_day: number;
    start_time: string;
    duration_minutes: number;
  }>;
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

interface Course {
  id: number;
  title: string;
}

const DAYS = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'];

// Get first letter of name for avatar
function getFirstLetter(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

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

// Format time for display
function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes}`;
}

export default function TeacherProfilePage() {
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Group modals from context
  const { openGroupModal, closeGroupModal } = useGroupModals();

  // Quick create group modal state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupFormData, setGroupFormData] = useState({
    courseId: '',
    weeklyDay: '',
    startTime: '',
    status: 'active',
    note: '',
    startDate: new Date().toISOString().split('T')[0]
  });
  const [groupError, setGroupError] = useState<string | null>(null);
  const [titlePreview, setTitlePreview] = useState('');
  
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    telegram_id: string;
    notes: string;
    photo: string | null;
    photoFile: File | null;
  }>({
    name: '', email: '', phone: '', telegram_id: '', notes: '', photo: null, photoFile: null
  });

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

        const response = await fetch(`/api/teachers/${params.id}`);
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) {
          router.push('/teachers');
          return;
        }
        const data = await response.json();
        setTeacher(data);
        setFormData({
          name: data.name, 
          email: data.email,
          phone: data.phone || '', 
          telegram_id: data.telegram_id || '',
          notes: data.notes || '',
          photo: data.photo_url,
          photoFile: null
        });
      } catch (error) {
        console.error('Error:', error);
        router.push('/teachers');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id, router]);

  // Auto-hide toast after 2 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSave = async () => {
    if (!teacher) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/teachers/${teacher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          telegram_id: formData.telegram_id || null,
          notes: formData.notes || null,
          photo: formData.photo
        })
      });

      if (response.ok) {
        setToast({ message: 'Зміни збережено', type: 'success' });
        setEditing(false);
        
        // Refresh teacher data
        const res = await fetch(`/api/teachers/${params.id}`);
        const data = await res.json();
        setTeacher(data);
      }
    } catch (error) {
      setToast({ message: 'Помилка збереження', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ 
          ...formData, 
          photo: reader.result as string,
          photoFile: file 
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setFormData({ 
      ...formData, 
      photo: null, 
      photoFile: null 
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Open group modal - uses global context to prevent duplicates
  const handleOpenGroupModal = (group: { id: number; public_id: string; title: string }) => {
    openGroupModal(group.id, group.title);
  };

  // Close group modal - uses global context
  const handleCloseGroupModal = (groupId: number) => {
    closeGroupModal(groupId);
  };

  // Open quick create group modal
  const handleOpenCreateGroupModal = async () => {
    // Load courses if not loaded
    if (courses.length === 0) {
      try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        setCourses(data.courses || []);
      } catch (error) {
        console.error('Failed to load courses:', error);
      }
    }
    setShowCreateGroupModal(true);
    setGroupError(null);
    setGroupFormData({
      courseId: '',
      weeklyDay: '',
      startTime: '',
      status: 'active',
      note: '',
      startDate: new Date().toISOString().split('T')[0]
    });
    setTitlePreview('');
  };

  // Handle create group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupError(null);

    if (!teacher) return;

    // Validation
    if (!groupFormData.courseId) {
      setGroupError(uk.validation.selectCourse);
      return;
    }
    if (!groupFormData.weeklyDay) {
      setGroupError(uk.validation.selectDay);
      return;
    }
    if (!groupFormData.startTime) {
      setGroupError(uk.validation.selectTime);
      return;
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(groupFormData.startTime)) {
      setGroupError(uk.validation.invalidTime);
      return;
    }

    setSavingGroup(true);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: parseInt(groupFormData.courseId),
          teacher_id: teacher.id,
          weekly_day: parseInt(groupFormData.weeklyDay),
          start_time: groupFormData.startTime,
          status: groupFormData.status,
          note: groupFormData.note || null,
          start_date: groupFormData.startDate || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowCreateGroupModal(false);
        setToast({ message: 'Групу створено', type: 'success' });
        
        // Refresh teacher data to show new group
        const res = await fetch(`/api/teachers/${params.id}`);
        const data = await res.json();
        setTeacher(data);
      } else {
        setGroupError(data.error || uk.toasts.error);
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      setGroupError(uk.toasts.error);
    } finally {
      setSavingGroup(false);
    }
  };

  // Update title preview when form changes
  useEffect(() => {
    if (groupFormData.courseId && groupFormData.weeklyDay && groupFormData.startTime && courses.length > 0) {
      const course = courses.find(c => c.id === parseInt(groupFormData.courseId));
      const dayShort = uk.daysShort[parseInt(groupFormData.weeklyDay) as keyof typeof uk.daysShort];
      if (course && dayShort) {
        setTitlePreview(`${dayShort} ${groupFormData.startTime} ${course.title}`);
      }
    } else {
      setTitlePreview('');
    }
  }, [groupFormData.courseId, groupFormData.weeklyDay, groupFormData.startTime, courses]);

  const cancelEdit = () => {
    if (teacher) {
      setFormData({
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone || '',
        telegram_id: teacher.telegram_id || '',
        notes: teacher.notes || '',
        photo: teacher.photo_url || null,
        photoFile: null
      });
    }
    setEditing(false);
  };

  // Show loading state
  if (loading) {
    return <PageLoading />;
  }

  // Redirect if not authenticated
  if (!user) {
    return null;
  }

  const currentUser = user as User;
  const isAdmin = currentUser.role === 'admin';
  const firstLetter = teacher ? getFirstLetter(teacher.name) : '?';

  // Show 404 state
  if (notFound || !teacher) {
    return (
      <Layout user={currentUser}>
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Викладача не знайдено</h1>
          <a href="/teachers" className="btn btn-primary">Повернутися до списку</a>
        </div>
      </Layout>
    );
  }

  // Edit mode form
  if (editing) {
    return (
      <Layout user={currentUser}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => router.push('/teachers')}
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
            {t('nav.teachers')}
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
            Редагування викладача
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
                Фото викладача
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
                    alt="Teacher"
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
                    {formData.name ? getFirstLetter(formData.name) : '?'}
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
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* Contacts Card */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.25rem 0', color: 'var(--gray-700)' }}>
                Контакти
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="form-input"
                    style={{ width: '100%' }}
                    placeholder="+380..."
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Telegram ID
                  </label>
                  <input
                    type="text"
                    value={formData.telegram_id}
                    onChange={(e) => setFormData({...formData, telegram_id: e.target.value})}
                    className="form-input"
                    style={{ width: '100%' }}
                    placeholder="@username"
                  />
                </div>
              </div>
            </div>

            {/* Notes Card */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.25rem 0', color: 'var(--gray-700)' }}>
                Нотатки
              </h3>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={4}
                className="form-input"
                style={{ width: '100%', resize: 'vertical' }}
                placeholder="Додаткова інформація про викладача..."
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
      </Layout>
    );
  }

  // View mode - Profile display
  return (
    <Layout user={currentUser}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => router.push('/teachers')}
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
          {t('nav.teachers')}
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
            {teacher.public_id}
          </span>
          <span className={`badge ${teacher.is_active ? 'badge-success' : 'badge-gray'}`}>
            {teacher.is_active ? 'Активний' : 'Неактивний'}
          </span>
        </div>
        
        {isAdmin && (
          <button
            onClick={() => setEditing(true)}
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
              {/* Photo */}
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
                  {teacher.photo_url ? (
                    <img
                      src={teacher.photo_url}
                      alt={teacher.name}
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
                  {teacher.name}
                </h1>
                
                {/* Contacts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {/* Phone */}
                  {teacher.phone && (
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
                        backgroundColor: copiedField === 'phone' ? '#a7f3d0' : '#d1fae5', 
                        borderRadius: '0.375rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}>
                        {copiedField === 'phone' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: '600' }}>Телефон</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <a
                          href={`tel:${teacher.phone}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(teacher.phone || '');
                            setCopiedField('phone');
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          style={{
                            color: copiedField === 'phone' ? '#059669' : 'var(--gray-900)',
                            textDecoration: 'none',
                            fontSize: '0.9375rem',
                            fontWeight: '600',
                            transition: 'color 0.15s',
                          }}
                          title="Клікніть щоб скопіювати"
                        >
                          {formatPhone(teacher.phone)}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {/* Telegram */}
                  {teacher.telegram_id && (
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
                        backgroundColor: copiedField === 'telegram' ? '#bfdbfe' : '#dbeafe', 
                        borderRadius: '0.375rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}>
                        {copiedField === 'telegram' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.6875rem', color: '#2563eb', fontWeight: '600' }}>Telegram</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <a
                          href={`https://t.me/${teacher.telegram_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            navigator.clipboard.writeText(teacher.telegram_id || '');
                            setCopiedField('telegram');
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          style={{
                            color: copiedField === 'telegram' ? '#2563eb' : 'var(--gray-900)',
                            textDecoration: 'none',
                            fontSize: '0.9375rem',
                            fontWeight: '600',
                            transition: 'color 0.15s',
                          }}
                          title="Клікніть щоб скопіювати"
                        >
                          @{teacher.telegram_id}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {/* Email */}
                  {teacher.email && (
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
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.6875rem', color: '#db2777', fontWeight: '600' }}>Email</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <a
                          href={`mailto:${teacher.email}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(teacher.email || '');
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
                          {teacher.email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Content */}
          <div>
            {/* Notes Card */}
            {teacher.notes && (
              <div className="card" style={{ 
                marginBottom: '2rem', 
                padding: '2rem', 
                borderRadius: '1rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
              }}>
                <h3 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '600', 
                  margin: '0 0 1rem 0', 
                  color: 'var(--gray-700)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Нотатки
                </h3>
                <p style={{ 
                  margin: 0, 
                  color: 'var(--gray-600)', 
                  fontSize: '0.9375rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap'
                }}>
                  {teacher.notes}
                </p>
              </div>
            )}

            {/* Groups Card */}
            <div className="card" style={{ 
              marginBottom: '2rem', 
              padding: '2rem', 
              borderRadius: '1rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
            }}>
              <h3 style={{ 
                fontSize: '1.125rem', 
                fontWeight: '600', 
                margin: '0 0 1.5rem 0', 
                color: 'var(--gray-700)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Групи викладача ({teacher.groups.length})
              </h3>
              
              {teacher.groups.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '2.5rem', 
                  color: 'var(--gray-500)',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '0.75rem'
                }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', opacity: 0.5 }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <p style={{ margin: 0, fontSize: '0.9375rem' }}>У викладача ще немає груп</p>
                  <button
                    onClick={handleOpenCreateGroupModal}
                    className="btn btn-primary"
                    style={{ marginTop: '1rem' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Створити групу
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {teacher.groups.map(group => (
                    <div 
                      key={group.id} 
                      onClick={() => handleOpenGroupModal(group)}
                      style={{ 
                        padding: '1.25rem', 
                        border: '1px solid var(--gray-200)', 
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'white'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.1)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--gray-200)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--gray-900)' }}>
                          {group.title}
                        </div>
                        <span style={{ 
                          fontFamily: 'monospace',
                          fontSize: '0.75rem', 
                          color: 'var(--gray-500)', 
                          padding: '0.25rem 0.5rem', 
                          backgroundColor: 'var(--gray-100)', 
                          borderRadius: '0.375rem' 
                        }}>
                          {group.public_id}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.5rem' }}>
                        {group.course_title}
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        fontSize: '0.8125rem', 
                        color: 'var(--primary)',
                        fontWeight: '500'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        {DAYS[group.weekly_day]}, {group.start_time} ({group.duration_minutes} хв)
                      </div>
                    </div>
                  ))}
                </div>
              )}
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


      <DraggableModal
        id="create-group-modal"
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        title={uk.pages.newGroup}
        initialWidth={480}
        initialHeight={560}
      >
        <form onSubmit={handleCreateGroup}>
          {groupError && (
            <div style={{ 
              padding: '0.75rem 1rem', 
              marginBottom: '1rem', 
              backgroundColor: '#fef2f2', 
              color: '#dc2626', 
              borderRadius: '0.5rem',
              border: '1px solid #fecaca'
            }}>
              {groupError}
            </div>
          )}

          {/* Title Preview */}
          {titlePreview && (
            <div style={{ 
              padding: '1rem', 
              marginBottom: '1.5rem', 
              backgroundColor: '#f0f9ff', 
              borderRadius: '0.5rem',
              border: '1px solid #bae6fd'
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#0369a1', fontWeight: '500' }}>
                {uk.forms.groupTitle}:
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.125rem', fontWeight: '600' }}>
                {titlePreview}
              </p>
            </div>
          )}

          {/* Teacher info (read-only) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {uk.forms.teacher} *
            </label>
            <input
              type="text"
              className="form-input"
              value={teacher?.name || ''}
              disabled
              style={{ backgroundColor: 'var(--gray-100)' }}
            />
          </div>

          {/* Course */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {uk.forms.course} *
            </label>
            <select
              className="form-input"
              value={groupFormData.courseId}
              onChange={(e) => setGroupFormData({...groupFormData, courseId: e.target.value})}
              required
            >
              <option value="">{uk.forms.selectCourse}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          {/* Day and Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                {uk.forms.dayOfWeek} *
              </label>
              <select
                className="form-input"
                value={groupFormData.weeklyDay}
                onChange={(e) => setGroupFormData({...groupFormData, weeklyDay: e.target.value})}
                required
              >
                <option value="">{uk.forms.selectDay}</option>
                {Object.entries(uk.days).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                {uk.forms.startTime} *
              </label>
              <input
                type="time"
                className="form-input"
                value={groupFormData.startTime}
                onChange={(e) => setGroupFormData({...groupFormData, startTime: e.target.value})}
                required
              />
            </div>
          </div>

          {/* Status */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {uk.common.status} *
            </label>
            <select
              className="form-input"
              value={groupFormData.status}
              onChange={(e) => setGroupFormData({...groupFormData, status: e.target.value})}
              required
            >
              <option value="active">{uk.groupStatus.active}</option>
              <option value="graduate">{uk.groupStatus.graduate}</option>
              <option value="inactive">{uk.groupStatus.inactive}</option>
            </select>
          </div>

          {/* Start Date */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {uk.forms.startDate}
            </label>
            <input
              type="date"
              className="form-input"
              value={groupFormData.startDate}
              onChange={(e) => setGroupFormData({...groupFormData, startDate: e.target.value})}
            />
          </div>

          {/* Note */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {uk.common.note}
            </label>
            <textarea
              className="form-input"
              value={groupFormData.note}
              onChange={(e) => setGroupFormData({...groupFormData, note: e.target.value})}
              rows={2}
              placeholder={uk.common.note}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowCreateGroupModal(false)}
              disabled={savingGroup}
            >
              {uk.actions.cancel}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingGroup}
            >
              {savingGroup ? uk.common.saving : uk.actions.create}
            </button>
          </div>
        </form>
      </DraggableModal>
    </Layout>
  );
}
