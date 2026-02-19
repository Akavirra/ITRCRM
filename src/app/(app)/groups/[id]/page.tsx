'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { uk } from '@/i18n/uk';
import { formatShortDateKyiv, formatDateKyiv } from '@/lib/date-utils';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface Group {
  id: number;
  public_id: string;
  title: string;
  course_id: number;
  course_title: string;
  teacher_id: number;
  teacher_name: string;
  weekly_day: number;
  start_time: string;
  duration_minutes: number;
  monthly_price: number;
  students_count: number;
  status: 'active' | 'graduate' | 'inactive';
  note: string | null;
  photos_folder_url: string | null;
  is_active: number;
  start_date: string | null;
  created_at: string;
}

interface Student {
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  join_date: string;
  student_group_id: number;
  photo: string | null;
}

interface StudentSearch {
  id: number;
  full_name: string;
  phone: string | null;
  photo: string | null;
}

interface Lesson {
  id: number;
  group_id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  status: 'scheduled' | 'done' | 'canceled';
}

interface Course {
  id: number;
  title: string;
}

interface Teacher {
  id: number;
  name: string;
}

export default function GroupDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showLessonsModal, setShowLessonsModal] = useState(false);
  
  // Student search
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<StudentSearch[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Edit group form
  const [editForm, setEditForm] = useState({
    course_id: '',
    teacher_id: '',
    weekly_day: '',
    start_time: '',
    duration_minutes: 60,
    monthly_price: 0,
    status: 'active',
    note: '',
    photos_folder_url: '',
    start_date: '',
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);

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

        const groupRes = await fetch(`/api/groups/${groupId}?withStudents=true`);
        if (!groupRes.ok) {
          router.push('/groups');
          return;
        }
        const groupData = await groupRes.json();
        setGroup(groupData.group);
        setStudents(groupData.students || []);

        const lessonsRes = await fetch(`/api/lessons?groupId=${groupId}`);
        const lessonsData = await lessonsRes.json();
        setLessons(lessonsData.lessons || []);
        
        if (authData.user.role === 'admin') {
          const coursesRes = await fetch('/api/courses');
          const coursesData = await coursesRes.json();
          setCourses(coursesData.courses || []);
          
          const usersRes = await fetch('/api/users');
          const usersData = await usersRes.json();
          setTeachers((usersData.users || []).filter((u: User) => u.role === 'teacher'));
        }
      } catch (error) {
        console.error('Failed to fetch group:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, groupId]);

  useEffect(() => {
    if (showEditGroupModal && group) {
      setEditForm({
        course_id: String(group.course_id),
        teacher_id: String(group.teacher_id),
        weekly_day: String(group.weekly_day),
        start_time: group.start_time,
        duration_minutes: group.duration_minutes,
        monthly_price: group.monthly_price,
        status: group.status,
        note: group.note || '',
        photos_folder_url: group.photos_folder_url || '',
        start_date: group.start_date || '',
      });
    }
  }, [showEditGroupModal, group]);

  // Завантажити список учнів при відкритті модального вікна
  useEffect(() => {
    if (showAddStudentModal) {
      setStudentSearch('');
      setSearchResults([]);
      handleSearchStudents('');
    }
  }, [showAddStudentModal]);

  const handleSearchStudents = async (query: string) => {
    setStudentSearch(query);
    
    setSearching(true);
    try {
      // Якщо є текст пошуку - шукаємо, інакше отримуємо всіх учнів
      const searchParam = query.trim().length >= 2 ? `search=${encodeURIComponent(query)}` : '';
      const res = await fetch(`/api/students?${searchParam}&includeInactive=true`);
      const data = await res.json();
      const existingIds = students.map(s => s.id);
      setSearchResults((data.students || []).filter((s: StudentSearch) => !existingIds.includes(s.id)));
    } catch (error) {
      console.error('Failed to search students:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddStudent = async (studentId: number) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });
      
      if (res.ok) {
        const groupRes = await fetch(`/api/groups/${groupId}?withStudents=true`);
        const groupData = await groupRes.json();
        setStudents(groupData.students || []);
        setGroup(groupData.group);
        setShowAddStudentModal(false);
        setStudentSearch('');
        setSearchResults([]);
      } else {
        const data = await res.json();
        alert(data.error || 'Помилка додавання учня');
      }
    } catch (error) {
      console.error('Failed to add student:', error);
    }
  };

  const handleRemoveStudent = async (studentGroupId: number, studentName: string) => {
    if (!confirm(uk.confirm.removeStudent.replace('{name}', studentName))) {
      return;
    }
    
    try {
      const res = await fetch(`/api/groups/${groupId}/students?studentGroupId=${studentGroupId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        const groupRes = await fetch(`/api/groups/${groupId}?withStudents=true`);
        const groupData = await groupRes.json();
        setStudents(groupData.students || []);
        setGroup(groupData.group);
      }
    } catch (error) {
      console.error('Failed to remove student:', error);
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGroup(true);
    
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: parseInt(editForm.course_id),
          teacher_id: parseInt(editForm.teacher_id),
          weekly_day: editForm.weekly_day ? parseInt(editForm.weekly_day) : undefined,
          start_time: editForm.start_time,
          duration_minutes: editForm.duration_minutes,
          status: editForm.status,
          note: editForm.note || null,
          photos_folder_url: editForm.photos_folder_url || null,
          start_date: editForm.start_date || null,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setGroup(data.group);
        setShowEditGroupModal(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Помилка збереження');
      }
    } catch (error) {
      console.error('Failed to save group:', error);
    } finally {
      setSavingGroup(false);
    }
  };

  const getDayName = (dayIndex: number) => {
    return uk.daysShort[dayIndex as keyof typeof uk.daysShort] || '';
  };

  const getDayNameFull = (dayIndex: number) => {
    return uk.days[dayIndex as keyof typeof uk.days] || '';
  };

  const calculateMonthsLearning = (startDate: string | null) => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const now = new Date();
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return months < 0 ? 0 : months;
  };

  const getStatusLabel = (status: string) => {
    return uk.groupStatus[status as keyof typeof uk.groupStatus] || status;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'done':
        return 'badge-success';
      case 'canceled':
        return 'badge-danger';
      case 'scheduled':
      default:
        return 'badge-info';
    }
  };

  const formatDate = (dateStr: string) => {
    return formatShortDateKyiv(dateStr);
  };

  const getLessonStatusLabel = (status: string) => {
    switch (status) {
      case 'done':
        return 'Проведено';
      case 'canceled':
        return 'Скасовано';
      case 'scheduled':
      default:
        return 'Заплановано';
    }
  };

  const recentLessons = lessons.slice(-5).reverse();
  const allLessons = [...lessons].reverse();

  if (loading || !user) {
    return (
      <Layout user={{ id: 0, name: '', email: '', role: 'teacher' }}>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>
          {uk.common.loading}
        </div>
      </Layout>
    );
  }

  if (!group) return null;

  const isAdmin = user.role === 'admin';
  const monthsLearning = group.start_date ? calculateMonthsLearning(group.start_date) : null;
  const monthsText = monthsLearning !== null 
    ? `${monthsLearning} ${monthsLearning === 1 ? 'місяць' : monthsLearning >= 2 && monthsLearning <= 4 ? 'місяці' : 'місяців'}` 
    : '';

  return (
    <Layout user={user}>
      {/* Back Link */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => router.push('/groups')}
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
          {uk.nav.groups}
        </button>
      </div>

      {/* Group Title - Large Header */}
      <h1 style={{ fontSize: '2rem', fontWeight: '700', margin: '0 0 1.5rem 0', letterSpacing: '-0.025em', color: 'var(--gray-900)' }}>
        {group.title}
      </h1>

      {/* Header */}
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
            {group.public_id}
          </span>
          <span className={`badge ${group.status === 'active' ? 'badge-success' : group.status === 'graduate' ? 'badge-info' : 'badge-gray'}`}>
            {getStatusLabel(group.status)}
          </span>
        </div>
        
        {isAdmin && (
          <button
            onClick={() => setShowEditGroupModal(true)}
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Редагувати групу
          </button>
        )}
      </div>

      {/* Main Layout */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Desktop: 2 columns */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 340px', 
          gap: '1.5rem',
          alignItems: 'start'
        }}>
          
          {/* Left Column: Students + Lessons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Students Card */}
            <div className="card">
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Склад групи
                </h2>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddStudentModal(true)}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.375rem' }}>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Додати
                  </button>
                )}
              </div>
              <div style={{ padding: '0.5rem 0' }}>
                {students.length > 0 ? (
                  students.map((student) => (
                    <div 
                      key={student.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.875rem 1.25rem',
                        borderBottom: '1px solid var(--gray-100)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '50%', 
                        background: student.photo ? 'transparent' : 'var(--gray-100)', 
                        color: 'var(--gray-600)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        marginRight: '0.875rem',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}>
                        {student.photo ? (
                          <img 
                            src={student.photo} 
                            alt={student.full_name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '500', color: 'var(--gray-900)' }}>{student.full_name}</p>
                        <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.8125rem', color: 'var(--gray-500)' }}>{student.phone || 'Телефон не вказано'}</p>
                        {student.join_date ? (
                          <>
                            <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: 'var(--gray-400)' }}>Доданий: {formatDateKyiv(student.join_date)}</p>
                            {(() => {
                              const joinDate = new Date(student.join_date);
                              const now = new Date();
                              const months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
                              if (months > 0) {
                                const monthText = months === 1 ? 'місяць' : (months >= 2 && months <= 4) ? 'місяці' : 'місяців';
                                return (
                                  <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: 'var(--primary)' }}>{months} {monthText} навчання</p>
                                );
                              }
                              return null;
                            })()}
                          </>
                        ) : null}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveStudent(student.student_group_id, student.full_name)}
                          style={{
                            padding: '0.375rem 0.625rem',
                            background: 'var(--gray-100)',
                            border: 'none',
                            borderRadius: '0.375rem',
                            color: 'var(--gray-500)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--danger)';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--gray-100)';
                            e.currentTarget.style.color = 'var(--gray-500)';
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '2.5rem 1.25rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <p style={{ margin: 0 }}>Немає учнів у групі</p>
                  </div>
                )}
              </div>
            </div>

            {/* Lessons Card */}
            <div className="card">
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Заняття
                </h2>
                <button
                  onClick={() => setShowLessonsModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                  }}
                >
                  Графік уроків →
                </button>
              </div>
              <div style={{ padding: '0.5rem 0' }}>
                {recentLessons.length > 0 ? (
                  <>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '100px 100px 1fr', 
                      padding: '0.75rem 1.25rem',
                      borderBottom: '1px solid var(--gray-100)',
                    }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-400)', letterSpacing: '0.05em' }}>Дата</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-400)', letterSpacing: '0.05em' }}>Статус</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-400)', letterSpacing: '0.05em' }}>Тема</span>
                    </div>
                    {recentLessons.map((lesson) => (
                      <div 
                        key={lesson.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '100px 100px 1fr',
                          padding: '0.875rem 1.25rem',
                          borderBottom: '1px solid var(--gray-100)',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--gray-900)' }}>
                          {formatDate(lesson.lesson_date)}
                        </span>
                        <span>
                          <span className={`badge ${getStatusBadgeClass(lesson.status)}`}>
                            {getLessonStatusLabel(lesson.status)}
                          </span>
                        </span>
                        <span style={{ fontSize: '0.875rem', color: lesson.topic ? 'var(--gray-700)' : 'var(--gray-400)', fontStyle: lesson.topic ? 'normal' : 'italic' }}>
                          {lesson.topic || 'Тема не вказана'}
                        </span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ padding: '2.5rem 1.25rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <p style={{ margin: 0 }}>Немає занять</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Details */}
          <div className="card" style={{ position: 'sticky', top: '1rem' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-200)' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Деталі
              </h2>
            </div>
            <div style={{ padding: '1rem 1.25rem' }}>
              
              {/* Назва групи */}
              <div style={{ marginBottom: '0.875rem', padding: '0.875rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', border: '1px solid var(--gray-200)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.05em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  Назва
                </div>
                <div style={{ fontSize: '1.0625rem', fontWeight: '600', color: 'var(--gray-900)' }}>
                  {group.title}
                </div>
              </div>

              {/* Курс */}
              <div style={{ marginBottom: '0.875rem', padding: '0.875rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', border: '1px solid var(--gray-200)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.05em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  Курс
                </div>
                <div style={{ fontSize: '1.0625rem', fontWeight: '500', color: 'var(--gray-900)' }}>
                  {group.course_title}
                </div>
              </div>

              {/* Викладач */}
              <div style={{ marginBottom: '0.875rem', padding: '0.875rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', border: '1px solid var(--gray-200)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.05em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Викладач
                </div>
                <div style={{ fontSize: '1.0625rem', fontWeight: '500', color: 'var(--gray-900)' }}>
                  {group.teacher_name}
                </div>
              </div>

              {/* Розклад */}
              <div style={{ marginBottom: '0.875rem', padding: '0.875rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', border: '1px solid var(--gray-200)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.05em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Розклад
                </div>
                <div style={{ fontSize: '1.0625rem', fontWeight: '500', color: 'var(--gray-900)' }}>
                  {getDayNameFull(group.weekly_day)} о {group.start_time}
                  <span style={{ color: 'var(--gray-500)', marginLeft: '0.375rem' }}>({group.duration_minutes} хв)</span>
                </div>
              </div>

              {/* Тривалість навчання */}
              {monthsLearning !== null && (
                <div style={{ marginBottom: '0.875rem', padding: '0.875rem', backgroundColor: 'var(--primary)', borderRadius: '0.5rem', border: '1px solid var(--primary)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.05em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Навчається
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'white' }}>
                    {monthsText}
                  </div>
                </div>
              )}

              {/* Дата створення */}
              <div style={{ marginBottom: '0.875rem', padding: '0.875rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', border: '1px solid var(--gray-200)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.05em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Створено
                </div>
                <div style={{ fontSize: '1.0625rem', fontWeight: '500', color: 'var(--gray-900)' }}>
                  {formatDate(group.created_at)}
                </div>
              </div>

              {group.photos_folder_url && (
                <div style={{ marginBottom: '0.875rem' }}>
                  <a 
                    href={group.photos_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Відкрити фото
                  </a>
                </div>
              )}

              {group.note && (
                <div style={{ padding: '0.875rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', border: '1px solid var(--gray-200)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.05em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Примітка
                  </div>
                  <div style={{ fontSize: '0.9375rem', color: 'var(--gray-600', whiteSpace: 'pre-wrap' }}>
                    {group.note}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="modal-overlay" onClick={() => setShowAddStudentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Додати учня до групи</h2>
              <button className="modal-close" onClick={() => setShowAddStudentModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                className="form-input"
                placeholder="Пошук учня..."
                value={studentSearch}
                onChange={(e) => handleSearchStudents(e.target.value)}
                autoFocus
                style={{ marginBottom: '1rem' }}
              />
              
              {searching && <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '1rem 0' }}>{uk.common.loading}</p>}
              
              {searchResults.length > 0 && (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {searchResults.map((student) => (
                    <div
                      key={student.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.75rem',
                        borderBottom: '1px solid var(--gray-100)',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleAddStudent(student.id)}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '50%', 
                        background: student.photo ? 'transparent' : 'var(--gray-100)', 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        marginRight: '0.75rem',
                        flexShrink: 0,
                        overflow: 'hidden',
                        color: 'var(--gray-600)',
                      }}>
                        {student.photo ? (
                          <img 
                            src={student.photo} 
                            alt={student.full_name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: '500' }}>{student.full_name}</p>
                        {student.phone && (
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--gray-500)' }}>{student.phone}</p>
                        )}
                      </div>
                      <button className="btn btn-primary btn-sm">Додати</button>
                    </div>
                  ))}
                </div>
              )}
              
              {studentSearch.length >= 2 && !searching && searchResults.length === 0 && (
                <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '1rem 0' }}>
                  Учнів не знайдено
                </p>
              )}
              
              {studentSearch.length < 2 && !searching && searchResults.length === 0 && studentSearch.length > 0 && (
                <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '1rem 0' }}>
                  Введіть мінімум 2 символи для пошуку
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && (
        <div className="modal-overlay" onClick={() => setShowEditGroupModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Редагувати групу</h2>
              <button className="modal-close" onClick={() => setShowEditGroupModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveGroup}>
              <div className="modal-body">
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Курс *</label>
                  <select 
                    className="form-select"
                    value={editForm.course_id}
                    onChange={(e) => setEditForm({...editForm, course_id: e.target.value})}
                    required
                  >
                    <option value="">Оберіть курс</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Викладач *</label>
                  <select 
                    className="form-select"
                    value={editForm.teacher_id}
                    onChange={(e) => setEditForm({...editForm, teacher_id: e.target.value})}
                    required
                  >
                    <option value="">Оберіть викладача</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className="form-label">День тижня</label>
                    <select 
                      className="form-select"
                      value={editForm.weekly_day || ''}
                      disabled
                      style={{ backgroundColor: 'var(--gray-100)' }}
                    >
                      <option value="">Оберіть день</option>
                      {[1,2,3,4,5,6,7].map(day => (
                        <option key={day} value={String(day)}>{uk.days[day as keyof typeof uk.days]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Час початку</label>
                    <input 
                      type="time" 
                      className="form-input"
                      value={editForm.start_time}
                      disabled
                      style={{ backgroundColor: 'var(--gray-100)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className="form-label">Тривалість (хв)</label>
                    <input 
                      type="number" 
                      className="form-input"
                      value={editForm.duration_minutes}
                      onChange={(e) => setEditForm({...editForm, duration_minutes: parseInt(e.target.value) || 60})}
                      min="15"
                      step="15"
                    />
                  </div>

                  <div>
                    <label className="form-label">Статус</label>
                    <select 
                      className="form-select"
                      value={editForm.status}
                      onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                    >
                      <option value="active">Активна</option>
                      <option value="graduate">Випуск</option>
                      <option value="inactive">Неактивна</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Посилання на Google Drive</label>
                  <input 
                    type="url" 
                    className="form-input"
                    value={editForm.photos_folder_url}
                    onChange={(e) => setEditForm({...editForm, photos_folder_url: e.target.value})}
                    placeholder="https://drive.google.com/..."
                  />
                </div>

                <div>
                  <label className="form-label">Примітка</label>
                  <textarea 
                    className="form-input"
                    value={editForm.note}
                    onChange={(e) => setEditForm({...editForm, note: e.target.value})}
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowEditGroupModal(false)}
                >
                  Скасувати
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={savingGroup}
                >
                  {savingGroup ? 'Збереження...' : 'Зберегти'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* All Lessons Modal */}
      {showLessonsModal && (
        <div className="modal-overlay" onClick={() => setShowLessonsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Всі заняття групи</h2>
              <button className="modal-close" onClick={() => setShowLessonsModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              {allLessons.length > 0 ? (
                <>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '100px 100px 1fr', 
                    padding: '0.75rem 1.25rem',
                    borderBottom: '1px solid var(--gray-200)',
                    background: 'var(--gray-50)',
                  }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-400)', letterSpacing: '0.05em' }}>Дата</span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-400)', letterSpacing: '0.05em' }}>Статус</span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--gray-400)', letterSpacing: '0.05em' }}>Тема</span>
                  </div>
                  {allLessons.map((lesson) => (
                    <div 
                      key={lesson.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 100px 1fr',
                        padding: '0.875rem 1.25rem',
                        borderBottom: '1px solid var(--gray-100)',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--gray-900)' }}>
                        {formatDate(lesson.lesson_date)}
                      </span>
                      <span>
                        <span className={`badge ${getStatusBadgeClass(lesson.status)}`}>
                          {getLessonStatusLabel(lesson.status)}
                        </span>
                      </span>
                      <span style={{ fontSize: '0.875rem', color: lesson.topic ? 'var(--gray-700)' : 'var(--gray-400)', fontStyle: lesson.topic ? 'normal' : 'italic' }}>
                        {lesson.topic || 'Тема не вказана'}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ padding: '3rem 1.25rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                  <p style={{ margin: 0 }}>Немає занять</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
