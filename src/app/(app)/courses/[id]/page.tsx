'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { t } from '@/i18n/t';
import { uk } from '@/i18n/uk';

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
  
  // Program modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [programValue, setProgramValue] = useState('');
  const [savingProgram, setSavingProgram] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const MAX_PROGRAM_LENGTH = 10000;

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

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('common.loading')}</div>;
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
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => router.push('/courses')}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: 0,
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
        alignItems: 'flex-start', 
        flexWrap: 'wrap', 
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280' }}>
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
      </div>

      {/* Main Layout: Flyer Left, Content Right */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr',
        gap: '1.5rem',
        marginBottom: '1.5rem'
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
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
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
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9ca3af',
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
          </div>

          {/* Right Column: Content */}
          <div>
            {/* Course Title */}
            <h1 style={{ fontSize: '1.75rem', fontWeight: '600', margin: '0 0 1.5rem 0' }}>
              {course.title}
            </h1>

            {/* Опис програми */}
            {course.description && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: '0 0 0.75rem 0' }}>
                  Опис програми
                </h2>
                <p style={{ color: '#6b7280', margin: 0, fontSize: '0.9375rem', lineHeight: '1.6' }}>
                  {course.description}
                </p>
              </div>
            )}

            {/* Характеристики */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: '0 0 1rem 0' }}>
                Характеристики
              </h2>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Вік
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                    {course.age_min ? `${course.age_min}+` : '---'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Тривалість
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                    {course.duration_months ? `${course.duration_months} міс.` : '---'}
                  </div>
                </div>
              </div>
            </div>

            {/* Групи курсу - Two Columns */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
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
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '1.5rem' 
              }}>
                {/* Active Groups */}
                <div>
                  <h3 style={{ 
                    fontSize: '0.9375rem', 
                    fontWeight: '600', 
                    margin: '0 0 0.75rem 0',
                    color: '#059669'
                  }}>
                    Активні
                  </h3>
                  {activeGroups.length > 0 ? (
                    <div className="table-container" style={{ padding: 0 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Назва</th>
                            <th>День/час</th>
                            <th>Викладач</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeGroups.map((group) => (
                            <tr key={group.id}>
                              <td>
                                <a href={`/groups/${group.id}`} style={{ fontWeight: '500' }}>
                                  {group.title}
                                </a>
                              </td>
                              <td>
                                {group.weekly_day && group.start_time
                                  ? `${getDayName(group.weekly_day)} ${group.start_time}`
                                  : '—'}
                              </td>
                              <td>{group.teacher_name || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '1.5rem', 
                      textAlign: 'center', 
                      color: '#9ca3af',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}>
                      <p style={{ margin: '0 0 1rem 0' }}>Немає активних груп</p>
                      {isAdmin && (
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

                {/* Graduate Groups */}
                <div>
                  <h3 style={{ 
                    fontSize: '0.9375rem', 
                    fontWeight: '600', 
                    margin: '0 0 0.75rem 0',
                    color: '#6366f1'
                  }}>
                    Випущені
                  </h3>
                  {graduateGroups.length > 0 ? (
                    <div className="table-container" style={{ padding: 0 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Назва</th>
                            <th>День/час</th>
                            <th>Викладач</th>
                          </tr>
                        </thead>
                        <tbody>
                          {graduateGroups.map((group) => (
                            <tr key={group.id}>
                              <td>
                                <a href={`/groups/${group.id}`} style={{ fontWeight: '500' }}>
                                  {group.title}
                                </a>
                              </td>
                              <td>
                                {group.weekly_day && group.start_time
                                  ? `${getDayName(group.weekly_day)} ${group.start_time}`
                                  : '—'}
                              </td>
                              <td>{group.teacher_name || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '1rem', 
                      textAlign: 'center', 
                      color: '#9ca3af',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}>
                      Немає випущених груп
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Учні на цьому курсі */}
            <div className="card">
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: '0 0 1rem 0' }}>
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
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: '#9ca3af',
                  fontSize: '0.9375rem'
                }}>
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
    </Layout>
  );
}
