'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { t } from '@/i18n/t';

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
  age_label: string;
  duration_months: number;
  program: string | null;
  flyer_path: string | null;
  is_active: number;
  groups_count?: number;
  students_count?: number;
}

export default function CoursesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({ 
    title: '', 
    description: '', 
    age_label: '6+', 
    duration_months: 1, 
    program: '' 
  });
  const [formErrors, setFormErrors] = useState<{ age_label?: string }>({});
  const [saving, setSaving] = useState(false);
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [uploadingFlyer, setUploadingFlyer] = useState(false);
  const [deletingFlyer, setDeletingFlyer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

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

        const coursesRes = await fetch('/api/courses?withStats=true');
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

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.trim()) {
      const res = await fetch(`/api/courses?search=${encodeURIComponent(query)}&withStats=true`);
      const data = await res.json();
      setCourses(data.courses || []);
    } else {
      const res = await fetch('/api/courses?withStats=true');
      const data = await res.json();
      setCourses(data.courses || []);
    }
  };

  const handleCreate = () => {
    setEditingCourse(null);
    setFormData({ 
      title: '', 
      description: '', 
      age_label: '6+', 
      duration_months: 1, 
      program: '' 
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({ 
      title: course.title, 
      description: course.description || '', 
      age_label: course.age_label || '6+', 
      duration_months: course.duration_months || 1, 
      program: course.program || '' 
    });
    setFormErrors({});
    setShowModal(true);
  };

  const validateAgeLabel = (value: string): string | null => {
    const ageRegex = /^\d+\+$/;
    if (!ageRegex.test(value)) {
      return t('validation.invalidAgeFormat');
    }
    return null;
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return;
    
    // Validate age label
    const ageError = validateAgeLabel(formData.age_label);
    if (ageError) {
      setFormErrors({ age_label: ageError });
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
      } else {
        await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      
      setShowModal(false);
      // Refresh courses
      const res = await fetch('/api/courses?withStats=true');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (error) {
      console.error('Failed to save course:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (course: Course) => {
    const action = course.is_active ? t('actions.archive') : t('actions.restore');
    if (!confirm(`${action} ${t('nav.courses').toLowerCase()} "${course.title}"?`)) return;
    
    try {
      if (course.is_active) {
        await fetch(`/api/courses/${course.id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/courses/${course.id}`, { method: 'PATCH' });
      }
      
      const res = await fetch('/api/courses?withStats=true&includeInactive=true');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (error) {
      console.error('Failed to archive/restore course:', error);
    }
  };

  const handleDeleteClick = (course: Course) => {
    setCourseToDelete(course);
    setDeletePassword('');
    setDeleteError('');
    setShowDeleteModal(true);
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
  };

  const handleFlyerUpload = async () => {
    if (!editingCourse || !flyerFile) return;
    
    setUploadingFlyer(true);
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
        alert(error.error || 'Failed to upload flyer');
      }
    } catch (error) {
      console.error('Failed to upload flyer:', error);
      alert('Failed to upload flyer');
    } finally {
      setUploadingFlyer(false);
    }
  };

  const handleFlyerDelete = async () => {
    if (!editingCourse || !editingCourse.flyer_path) return;
    
    if (!confirm('Delete the course flyer?')) return;
    
    setDeletingFlyer(true);
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
        alert(error.error || 'Failed to delete flyer');
      }
    } catch (error) {
      console.error('Failed to delete flyer:', error);
      alert('Failed to delete flyer');
    } finally {
      setDeletingFlyer(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        alert('Only JPEG and PNG files are allowed');
        return;
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setFlyerFile(file);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('common.loading')}</div>;
  }

  if (!user) return null;

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase())
  );

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
          {user.role === 'admin' && (
            <button className="btn btn-primary" onClick={handleCreate}>
              + {t('modals.newCourse')}
            </button>
          )}
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
                      <span style={{ fontWeight: '500' }}>{course.age_label || '---'}</span>
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
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEdit(course)}
                          style={{ marginRight: '0.5rem' }}
                        >
                          {t('actions.edit')}
                        </button>
                        <button
                          className={`btn btn-sm ${course.is_active ? 'btn-secondary' : 'btn-success'}`}
                          onClick={() => handleArchive(course)}
                          style={{ marginRight: '0.5rem' }}
                        >
                          {course.is_active ? t('actions.archive') : t('actions.restore')}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteClick(course)}
                        >
                          {t('actions.delete')}
                        </button>
                      </td>
                    )}
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
                  type="text"
                  className={`form-input ${formErrors.age_label ? 'form-input-error' : ''}`}
                  value={formData.age_label}
                  onChange={(e) => {
                    setFormData({ ...formData, age_label: e.target.value });
                    if (formErrors.age_label) {
                      setFormErrors({ ...formErrors, age_label: undefined });
                    }
                  }}
                  placeholder={t('forms.courseAgeLabelPlaceholder')}
                />
                {formErrors.age_label && (
                  <span className="form-error">{formErrors.age_label}</span>
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
              <div className="form-group">
                <label className="form-label">{t('forms.courseProgram')}</label>
                <textarea
                  className="form-input"
                  value={formData.program}
                  onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                  placeholder={t('forms.courseProgramPlaceholder')}
                  rows={4}
                />
              </div>
              
              {/* Flyer upload section - only for editing existing courses */}
              {editingCourse && (
                <div className="form-group">
                  <label className="form-label">Flyer (JPEG/PNG, max 5MB)</label>
                  
                  {/* Existing flyer preview */}
                  {editingCourse.flyer_path ? (
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
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <a 
                          href={editingCourse.flyer_path} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          Open
                        </a>
                        <a 
                          href={editingCourse.flyer_path} 
                          download
                          className="btn btn-secondary btn-sm"
                        >
                          Download
                        </a>
                        <button 
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={handleFlyerDelete}
                          disabled={deletingFlyer}
                        >
                          {deletingFlyer ? 'Deleting...' : 'Delete'}
                        </button>
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
                        <div style={{ marginTop: '0.5rem' }}>
                          <span style={{ marginRight: '0.5rem' }}>
                            {flyerFile.name} ({(flyerFile.size / 1024).toFixed(1)} KB)
                          </span>
                          <button 
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleFlyerUpload}
                            disabled={uploadingFlyer}
                          >
                            {uploadingFlyer ? 'Uploading...' : 'Upload'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Підтвердження видалення</h3>
              <button className="modal-close" onClick={handleDeleteCancel} disabled={deleting}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 1rem 0' }}>
                Щоб видалити курс, введіть пароль адміністратора.
              </p>
              <p style={{ margin: '0 0 1rem 0', fontWeight: 500 }}>
                Курс: {courseToDelete.title}
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
                {deleting ? 'Видалення...' : 'Видалити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
