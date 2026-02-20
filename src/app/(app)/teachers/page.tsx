'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Portal from '@/components/Portal';
import { useGroupModals } from '@/components/GroupModalsContext';
import { useTeacherModals } from '@/components/TeacherModalsContext';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface TeacherGroup {
  id: number;
  public_id: string | null;
  title: string;
  status: string;
  is_active: number;
  weekly_day: number;
  start_time: string;
  course_title?: string;
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
  active_groups_count: number;
  is_active?: number;
  groups?: TeacherGroup[];
}

interface GroupDetails {
  group?: {
    id: number;
    public_id: string | null;
    title: string;
    status: string;
    is_active: number;
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

export default function TeachersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    patronymic: '',
    email: '',
    phone: '',
    telegram_id: '',
    notes: '',
    photo: null as string | null,
    photoFile: null as File | null,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [teacherGroupsWarning, setTeacherGroupsWarning] = useState<{id: number; title: string; course_title: string}[]>([]);
  const [deleteMode, setDeleteMode] = useState<'deactivate' | 'permanent'>('deactivate');

  // Group modals from context
  const { openGroupModal, closeGroupModal } = useGroupModals();
  // Teacher modals from context
  const { openTeacherModal } = useTeacherModals();

  // Copy to clipboard state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    // Check auth
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      const response = await fetch('/api/teachers');
      if (response.ok) {
        const data = await response.json();
        setTeachers(data);
      }
    } catch (error) {
      console.error('Error loading teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  const handleCreate = () => {
    setEditingTeacher(null);
    setFormData({
      first_name: '',
      last_name: '',
      patronymic: '',
      email: '',
      phone: '',
      telegram_id: '',
      notes: '',
      photo: null,
      photoFile: null,
    });
    setShowModal(true);
  };

  const handleEdit = (teacher: Teacher) => {
    // Parse full name into parts
    const nameParts = teacher.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    setEditingTeacher(teacher);
    setFormData({
      first_name: firstName,
      last_name: lastName,
      patronymic: '',
      email: teacher.email,
      phone: teacher.phone?.replace('+380', '') || '',
      telegram_id: teacher.telegram_id || '',
      notes: teacher.notes || '',
      photo: teacher.photo_url || null,
      photoFile: null,
    });
    setShowModal(true);
  };

  const handleDeleteClick = async (teacher: Teacher, mode: 'deactivate' | 'permanent' = 'deactivate') => {
    setTeacherToDelete(teacher);
    setDeletePassword('');
    setDeleteError('');
    setTeacherGroupsWarning([]);
    setOpenDropdownId(null);
    setDeleteMode(mode);
    
    // First, check if teacher has active groups
    try {
      const res = await fetch(`/api/teachers/${teacher.id}?check=true`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      
      if (res.status === 409 && data.warning) {
        // Teacher has groups - show warning
        setTeacherGroupsWarning(data.groups || []);
      } else if (data.canDelete) {
        // Teacher has no groups - clear warning
        setTeacherGroupsWarning([]);
      }
      
      setShowDeleteModal(true);
    } catch (error) {
      console.error('Failed to check teacher groups:', error);
      setShowDeleteModal(true);
    }
  };

  const confirmDelete = async () => {
    if (!deletePassword) {
      setDeleteError('Введіть пароль для підтвердження');
      return;
    }

    setDeleting(true);
    setDeleteError('');

    try {
      // Verify admin password
      const authRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, password: deletePassword })
      });

      if (!authRes.ok) {
        setDeleteError('Невірний пароль');
        setDeleting(false);
        return;
      }

      // Build URL based on delete mode
      const url = deleteMode === 'permanent' 
        ? `/api/teachers/${teacherToDelete?.id}?permanent=true&force=true`
        : `/api/teachers/${teacherToDelete?.id}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: deleteMode === 'permanent' ? JSON.stringify({ password: deletePassword }) : undefined
      });

      if (response.ok) {
        const data = await response.json();
        if (deleteMode === 'permanent') {
          setToast({ message: 'Викладача остаточно видалено', type: 'success' });
        } else if (data.deactivated) {
          setToast({ message: 'Викладача деактивовано. Тепер можна видалити остаточно.', type: 'success' });
        } else {
          setToast({ message: 'Викладача деактивовано', type: 'success' });
        }
        setTimeout(() => setToast(null), 3000);
        setShowDeleteModal(false);
        loadTeachers();
      } else {
        const error = await response.json();
        // If still has groups error, update the warning
        if (error.warning) {
          setTeacherGroupsWarning(error.groups || []);
        }
        setDeleteError(error.error || 'Помилка видалення');
      }
    } catch (error) {
      setDeleteError('Помилка мережі');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setTeacherToDelete(null);
    setTeacherGroupsWarning([]);
    setDeletePassword('');
    setDeleteError('');
    setDeleteMode('deactivate');
  };

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Open group modal - uses global context to prevent duplicates
  const handleOpenGroupModal = (group: TeacherGroup) => {
    openGroupModal(group.id, group.title);
  };

  // Close group modal - uses global context
  const handleCloseGroupModal = (groupId: number) => {
    closeGroupModal(groupId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Combine name from first_name, last_name and patronymic
    const fullName = [formData.first_name, formData.last_name, formData.patronymic].filter(Boolean).join(' ');
    
    if (!fullName || !formData.email) {
      setToast({ message: 'Заповніть обов\'язкові поля', type: 'error' });
      return;
    }

    try {
      const url = editingTeacher ? `/api/teachers/${editingTeacher.id}` : '/api/teachers';
      const method = editingTeacher ? 'PUT' : 'POST';

      // Prepare form data for API
      const body: Record<string, string | null> = {
        name: fullName,
        email: formData.email,
        phone: formData.phone ? `+380${formData.phone}` : null,
        telegram_id: formData.telegram_id || null,
        notes: formData.notes || null,
      };

      // Add photo if present (as base64)
      if (formData.photo && formData.photo.startsWith('data:')) {
        body.photo = formData.photo;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setToast({ message: editingTeacher ? 'Викладача оновлено' : 'Викладача створено', type: 'success' });
        setShowModal(false);
        setFormData({
          first_name: '',
          last_name: '',
          patronymic: '',
          email: '',
          phone: '',
          telegram_id: '',
          notes: '',
          photo: null,
          photoFile: null,
        });
        loadTeachers();
      } else {
        const error = await response.json();
        setToast({ message: error.error || 'Помилка', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Помилка збереження', type: 'error' });
    }
  };

  // Photo upload handlers
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

  const filteredTeachers = teachers.filter(t => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(searchLower) ||
      t.email.toLowerCase().includes(searchLower) ||
      (t.phone && t.phone.includes(search))
    );
  });

  // Get first letter of name for avatar
  function getFirstLetter(name: string): string {
    return name.trim().charAt(0).toUpperCase();
  }

  // Get day name from weekly_day number
  function getDayName(day: number): string {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    return days[day - 1] || '';
  }

  // Format time
  function formatTime(time: string): string {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  }

  // Close dropdowns when clicking outside
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

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('common.loading')}</div>;
  }

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder={`${t('actions.search')} ${t('nav.teachers').toLowerCase()}...`}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
          </div>
          {user.role === 'admin' && (
            <button className="btn btn-primary" onClick={handleCreate}>
              + {t('modals.newTeacher') || 'Новий викладач'}
            </button>
          )}
        </div>

        <div style={{ padding: '0.5rem' }}>
          {teachers.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '16px',
              alignItems: 'start',
            }}>
              {filteredTeachers.map((teacher) => {
                const firstLetter = getFirstLetter(teacher.name);
                
                return (
                  <div
                    key={teacher.id}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '0.75rem',
                      border: '1px solid #e5e7eb',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      width: '360px',
                      minWidth: '360px',
                      minHeight: '280px',
                      height: 'auto',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {/* ID Badge - fixed top left */}
                    <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', zIndex: 1 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>
                        {teacher.public_id || `ID: ${teacher.id}`}
                      </span>
                    </div>
                    
                    {/* Status Badge - fixed top right */}
                    <div style={{ position: 'absolute', top: '0.75rem', right: user.role === 'admin' ? '5.5rem' : '2.5rem', zIndex: 1 }}>
                      <span className={`badge ${teacher.is_active === 1 ? 'badge-success' : 'badge-gray'}`}>
                        {teacher.is_active === 1 ? (t('status.active') || 'Активний') : (t('status.inactive') || 'Неактивний')}
                      </span>
                    </div>
                    
                    {/* Open in modal button - for all users - now rightmost */}
                    <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 1 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openTeacherModal(teacher.id, teacher.name);
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
                    </div>
                    
                    {/* Menu - Three dots button - to the left of modal button */}
                    {user.role === 'admin' && (
                      <div style={{ position: 'absolute', top: '0.5rem', right: '2.5rem', zIndex: 1 }}>
                        <button
                          ref={openDropdownId === teacher.id ? dropdownButtonRef : undefined}
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(openDropdownId === teacher.id ? null : teacher.id);
                          }}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '0.5rem',
                            backgroundColor: openDropdownId === teacher.id ? '#f3f4f6' : 'transparent',
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
                        {openDropdownId === teacher.id && (
                          <Portal anchorRef={dropdownButtonRef} menuRef={dropdownMenuRef} offsetY={6}>
                            <div
                              style={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '0.75rem',
                                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15), 0 0 2px rgba(0,0,0,0.1)',
                                minWidth: '180px',
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
                                href={`/teachers/${teacher.id}`}
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
                                Переглянути
                              </a>
                              <button
                                className="btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(null);
                                  handleEdit(teacher);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.75rem',
                                  width: '100%',
                                  padding: '0.625rem 0.75rem',
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  borderRadius: '0.5rem',
                                  color: '#374151',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  textAlign: 'left',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#1f2937'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#374151'; }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280' }}>
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Редагувати
                              </button>
                              <button
                                className="btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(null);
                                  handleDeleteClick(teacher);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.75rem',
                                  width: '100%',
                                  padding: '0.625rem 0.75rem',
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  borderRadius: '0.5rem',
                                  color: '#dc2626',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  textAlign: 'left',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#dc2626' }}>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Видалити
                              </button>
                            </div>
                          </Portal>
                        )}
                      </div>
                    )}
                    
                    {/* Main content */}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                      {/* Left Column - Avatar */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '80px', flexShrink: 0 }}>
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            flexShrink: 0,
                            backgroundColor: teacher.photo_url ? 'transparent' : '#dbeafe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid #bfdbfe',
                          }}
                        >
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
                              fontSize: '1.25rem',
                              fontWeight: 600,
                              color: '#2563eb',
                            }}>
                              {firstLetter}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Right Column - Details */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* Name */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <a
                              href={`/teachers/${teacher.id}`}
                              style={{
                                fontWeight: 600,
                                fontSize: '1rem',
                                color: '#111827',
                                textDecoration: 'none',
                              }}
                            >
                              {teacher.name}
                            </a>
                          </div>
                        </div>

                        {/* Contact info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                          {teacher.phone && (
                            <div 
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(teacher.phone!, `phone-${teacher.id}`); }}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.375rem',
                                fontSize: '0.8125rem', 
                                color: copiedField === `phone-${teacher.id}` ? '#10b981' : '#6b7280',
                                cursor: 'pointer',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => { if (copiedField !== `phone-${teacher.id}`) e.currentTarget.style.color = '#2563eb'; }}
                              onMouseLeave={(e) => { if (copiedField !== `phone-${teacher.id}`) e.currentTarget.style.color = '#6b7280'; }}
                              title="Клікніть щоб скопіювати"
                            >
                              {copiedField === `phone-${teacher.id}` ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                              )}
                              <span style={{ wordBreak: 'break-all' }}>{teacher.phone}</span>
                            </div>
                          )}
                          
                          {teacher.email && (
                            <div 
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(teacher.email, `email-${teacher.id}`); }}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.375rem',
                                fontSize: '0.8125rem', 
                                color: copiedField === `email-${teacher.id}` ? '#10b981' : '#6b7280',
                                cursor: 'pointer',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => { if (copiedField !== `email-${teacher.id}`) e.currentTarget.style.color = '#2563eb'; }}
                              onMouseLeave={(e) => { if (copiedField !== `email-${teacher.id}`) e.currentTarget.style.color = '#6b7280'; }}
                              title="Клікніть щоб скопіювати"
                            >
                              {copiedField === `email-${teacher.id}` ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                  <polyline points="22,6 12,13 2,6" />
                                </svg>
                              )}
                              <span style={{ wordBreak: 'break-all' }}>{teacher.email}</span>
                            </div>
                          )}

                          {teacher.telegram_id && (
                            <div 
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(teacher.telegram_id!, `telegram-${teacher.id}`); }}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.375rem',
                                fontSize: '0.8125rem', 
                                color: copiedField === `telegram-${teacher.id}` ? '#10b981' : '#6b7280',
                                cursor: 'pointer',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => { if (copiedField !== `telegram-${teacher.id}`) e.currentTarget.style.color = '#2563eb'; }}
                              onMouseLeave={(e) => { if (copiedField !== `telegram-${teacher.id}`) e.currentTarget.style.color = '#6b7280'; }}
                              title="Клікніть щоб скопіювати"
                            >
                              {copiedField === `telegram-${teacher.id}` ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                </svg>
                              )}
                              <span>@{teacher.telegram_id}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Groups list - bottom of card */}
                    <div style={{ 
                      marginTop: 'auto', 
                      paddingTop: '0.75rem',
                      borderTop: '1px solid #f3f4f6',
                    }}>
                      <div style={{ 
                        fontSize: '0.6875rem', 
                        fontWeight: 600, 
                        color: '#6b7280', 
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '0.5rem',
                      }}>
                        Групи ({teacher.groups?.length || 0})
                      </div>
                      <div style={{ 
                        maxHeight: '140px', 
                        overflowY: 'auto',
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.375rem',
                        paddingRight: '0.25rem',
                      }}>
                        {teacher.groups && teacher.groups.length > 0 ? (
                          teacher.groups.map((group) => (
                            <button
                              key={group.id}
                              onClick={() => handleOpenGroupModal(group)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 0.625rem',
                                backgroundColor: '#f0fdf4',
                                borderRadius: '0.5rem',
                                fontSize: '0.8125rem',
                                color: '#166534',
                                textDecoration: 'none',
                                transition: 'all 0.2s ease',
                                border: '1px solid #bbf7d0',
                                boxShadow: '0 1px 2px rgba(22, 163, 74, 0.05)',
                                cursor: 'pointer',
                                width: '100%',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => { 
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.15)';
                              }}
                              onMouseLeave={(e) => { 
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 1px 2px rgba(22, 163, 74, 0.05)';
                              }}
                            >
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '0.375rem',
                                backgroundColor: '#22c55e',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                flexDirection: 'column',
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                color: 'white',
                              }}>
                                <span>{getDayName(group.weekly_day)}</span>
                                <span style={{ opacity: 0.8, fontSize: '0.5rem' }}>{formatTime(group.start_time)}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ 
                                  fontWeight: 600, 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}>
                                  {group.title}
                                </div>
                                {group.course_title && (
                                  <div style={{ 
                                    fontSize: '0.6875rem', 
                                    opacity: 0.8,
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap' 
                                  }}>
                                    {group.course_title}
                                  </div>
                                )}
                              </div>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </button>
                          ))
                        ) : (
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            padding: '1rem', 
                            color: '#9ca3af',
                            fontSize: '0.8125rem',
                          }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem', opacity: 0.5 }}>
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            Немає груп
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              {t('common.noData') || 'Немає даних'}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'white', 
            padding: '2rem', 
            borderRadius: '1.25rem',
            width: '90%', 
            maxWidth: '520px', 
            maxHeight: '90vh', 
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'modalSlideIn 0.2s ease-out',
          }}>
            <style>{`
              @keyframes modalSlideIn {
                from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>
            <h2 style={{ marginTop: 0, marginBottom: '1.75rem', fontSize: '1.375rem', fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>
              {editingTeacher ? 'Редагувати викладача' : 'Новий викладач'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              {/* Photo Upload */}
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {formData.photo ? (
                  <>
                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden', border: '3px solid #e5e7eb', flexShrink: 0, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                      <img src={formData.photo} alt="Teacher" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                        Змінити
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={removePhoto}>
                        Видалити
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    Завантажити фото
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Name Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: '500', fontSize: '0.875rem', color: '#374151' }}>Прізвище *</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    className="form-input"
                    placeholder="Прізвище"
                    style={{ borderColor: '#d1d5db', padding: '0.625rem 0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: '500', fontSize: '0.875rem', color: '#374151' }}>Ім'я *</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    className="form-input"
                    placeholder="Ім'я"
                    style={{ borderColor: '#d1d5db', padding: '0.625rem 0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: '500', fontSize: '0.875rem', color: '#374151' }}>По батькові</label>
                <input 
                  type="text" 
                  value={formData.patronymic}
                  onChange={(e) => setFormData({...formData, patronymic: e.target.value})}
                  className="form-input"
                  placeholder="По батькові"
                  style={{ borderColor: '#d1d5db', padding: '0.625rem 0.875rem' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: '500', fontSize: '0.875rem', color: '#374151' }}>Email *</label>
                <input 
                  type="email" 
                  required 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="form-input"
                  placeholder="email@example.com"
                  style={{ borderColor: '#d1d5db', padding: '0.625rem 0.875rem' }}
                />
              </div>

              {/* Phone with +380 prefix */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: '500', fontSize: '0.875rem', color: '#374151' }}>Телефон</label>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '0.375rem',
                  backgroundColor: '#fff',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}>
                  <span style={{ 
                    padding: '0.625rem 0.75rem', 
                    backgroundColor: '#f3f4f6', 
                    color: '#374151', 
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    borderRight: '1px solid #d1d5db'
                  }}>+380</span>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="form-input"
                    placeholder="00 000 00 00"
                    maxLength={9}
                    style={{ 
                      flex: 1, 
                      border: 'none',
                      outline: 'none',
                      padding: '0.625rem 0.75rem',
                      fontSize: '1rem',
                      letterSpacing: '0.05em'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: '500', fontSize: '0.875rem', color: '#374151' }}>Telegram</label>
                <input 
                  type="text" 
                  value={formData.telegram_id}
                  onChange={(e) => setFormData({...formData, telegram_id: e.target.value})}
                  className="form-input"
                  placeholder="username (без @)"
                  style={{ borderColor: '#d1d5db', padding: '0.625rem 0.875rem' }}
                />
              </div>

              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: '500', fontSize: '0.875rem', color: '#374151' }}>Примітка</label>
                <textarea 
                  value={formData.notes} 
                  rows={3}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="form-input"
                  style={{ borderColor: '#d1d5db', resize: 'vertical', padding: '0.625rem 0.875rem' }}
                  placeholder="Додаткова інформація про викладача..."
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.625rem 1.25rem' }}
                >
                  Скасувати
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.625rem 1.5rem' }}
                >
                  {editingTeacher ? 'Зберегти' : 'Створити'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '1.5rem', borderRadius: '0.75rem',
            width: '90%', maxWidth: '520px'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>
              {deleteMode === 'permanent' ? 'Підтвердження остаточного видалення' : 'Підтвердження деактивації'}
            </h2>
            
            {/* Mode selector */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setDeleteMode('deactivate')}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  border: deleteMode === 'deactivate' ? '2px solid #4CAF50' : '1px solid #d1d5db',
                  background: deleteMode === 'deactivate' ? '#f0fdf4' : 'white',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: deleteMode === 'deactivate' ? 600 : 400
                }}
              >
                Деактивувати
              </button>
              <button
                type="button"
                onClick={() => setDeleteMode('permanent')}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  border: deleteMode === 'permanent' ? '2px solid #ef4444' : '1px solid #d1d5db',
                  background: deleteMode === 'permanent' ? '#fef2f2' : 'white',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: deleteMode === 'permanent' ? 600 : 400
                }}
              >
                Видалити остаточно
              </button>
            </div>
            
            {deleteMode === 'permanent' ? (
              <>
                <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
                  Ви збираєтеся остаточно видалити викладача <strong>{teacherToDelete?.name}</strong>. 
                  Ця дія незворотня.
                </p>
                
                {/* Warning about groups */}
                {teacherGroupsWarning.length > 0 && (
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
                      Викладач веде активні групи
                    </div>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#92400e' }}>
                      При остаточному видаленні викладач буде автоматично відключений від груп:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#92400e' }}>
                      {teacherGroupsWarning.map(group => (
                        <li key={group.id}>
                          <strong>{group.title}</strong> ({group.course_title})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <p style={{ marginBottom: '1rem', color: '#dc2626', fontSize: '0.875rem' }}>
                  Увага! Всі дані про викладача будуть видалені остаточно.
                </p>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
                  Ви збираєтеся деактивувати викладача <strong>{teacherToDelete?.name}</strong>. 
                  Викладач не буде видалений остаточно, а лише деактивований.
                </p>
                
                {/* Warning about groups */}
                {teacherGroupsWarning.length > 0 && (
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
                      Викладач веде активні групи
                    </div>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#92400e' }}>
                      Перед деактивацією викладача потрібно призначити іншого викладача для наступних груп:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#92400e' }}>
                      {teacherGroupsWarning.map(group => (
                        <li key={group.id}>
                          <strong>{group.title}</strong> ({group.course_title})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {teacherGroupsWarning.length === 0 && (
                  <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                    Викладач не веде жодної активної групи і може бути деактивований.
                  </p>
                )}
              </>
            )}
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.875rem' }}>
                Введіть пароль для підтвердження
              </label>
              <input 
                type="password" 
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="form-input"
                style={{ borderColor: deleteError ? '#ef4444' : '#d1d5db' }}
                placeholder="Ваш пароль"
                disabled={deleteMode === 'deactivate' && teacherGroupsWarning.length > 0}
              />
              {deleteError && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.25rem' }}>{deleteError}</p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={handleDeleteCancel}
                className="btn btn-secondary"
                disabled={deleting}
              >
                Скасувати
              </button>
              <button 
                type="button"
                onClick={confirmDelete}
                className={deleteMode === 'permanent' ? 'btn btn-danger' : 'btn btn-danger'}
                disabled={deleting || (deleteMode === 'deactivate' && teacherGroupsWarning.length > 0) || !deletePassword.trim()}
              >
                {deleting ? 'Видалення...' : deleteMode === 'permanent' ? 'Видалити остаточно' : (teacherGroupsWarning.length > 0 ? 'Спочатку призначте викладача' : 'Деактивувати')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          background: toast.type === 'success' ? '#22c55e' : '#ef4444',
          color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.5rem',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 1001,
          animation: 'slideIn 0.3s ease-out',
        }}>
          <style>{`
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(1rem); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {toast.message}
        </div>
      )};
    </Layout>
  );
}
