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
  age_label: string;
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
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setProgramValue('');
  };

  const handleDownloadPdf = () => {
    if (!course) return;
    // Use direct navigation so browser sends cookies automatically
    window.location.href = `/api/courses/${course.id}/program-pdf`;
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
          age_label: course.age_label,
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
      setIsModalOpen(false);
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

      {/* Course Header */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280' }}>
                {course.public_id}
              </span>
              <span className={`badge ${course.is_active ? 'badge-success' : 'badge-gray'}`}>
                {course.is_active ? t('status.active') : t('status.archived')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '600', margin: 0, marginBottom: '0.5rem' }}>
                {course.title}
              </h1>
              {course.program && (
                <button
                  onClick={handleDownloadPdf}
                  className="btn btn-secondary"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Відкрити програму
                </button>
              )}
            </div>
            {course.description && (
              <p style={{ color: '#6b7280', margin: 0, fontSize: '1rem' }}>
                {course.description}
              </p>
            )}
          </div>
          
          {course.flyer_path && (
            <div style={{ flexShrink: 0 }}>
              <img
                src={course.flyer_path}
                alt={course.title}
                style={{
                  maxWidth: '200px',
                  maxHeight: '200px',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  objectFit: 'cover',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Course Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Age Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.5rem',
              background: '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{t('table.age')}</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            {course.age_label || '---'}
          </div>
        </div>

        {/* Duration Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.5rem',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{t('table.duration')}</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            {course.duration_months ? `${course.duration_months} міс.` : '---'}
          </div>
        </div>
      </div>

      {/* Active Groups Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
            Активні групи
          </h2>
        </div>
        <div className="table-container">
          {activeGroups.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Назва</th>
                  <th>День/час</th>
                  <th>Викладач</th>
                  <th>Статус</th>
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
                    <td>
                      <span className={`badge ${getStatusBadgeClass(group.status)}`}>
                        {STATUS_LABELS[group.status] || group.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.9375rem' }}>
                Немає груп
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Graduate Groups Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
            Випущені групи
          </h2>
        </div>
        <div className="table-container">
          {graduateGroups.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Назва</th>
                  <th>День/час</th>
                  <th>Викладач</th>
                  <th>Статус</th>
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
                    <td>
                      <span className={`badge ${getStatusBadgeClass(group.status)}`}>
                        {STATUS_LABELS[group.status] || group.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.9375rem' }}>
                Немає груп
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Course Students Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
            Учні курсу
          </h2>
          {students.length > 0 && (
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Всього: {students.length}
            </span>
          )}
        </div>
        <div className="table-container">
          {students.length > 0 ? (
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
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.9375rem' }}>
                Немає учнів
              </div>
            </div>
          )}
        </div>
      </div>

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
      `}</style>
    </Layout>
  );
}
