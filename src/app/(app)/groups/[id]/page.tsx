'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { uk } from '@/i18n/uk';
import { formatShortDateKyiv, formatDateKyiv } from '@/lib/date-utils';
import { useStudentModals } from '@/components/StudentModalsContext';
import { useLessonModals } from '@/components/LessonModalsContext';
import GroupHistoryPanel from '@/components/GroupHistoryPanel';

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
  is_active: boolean;
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

type AttStatus = 'present' | 'absent' | 'makeup_planned' | 'makeup_done';

interface RegLesson {
  lesson_id: number;
  lesson_date: string;
  topic: string | null;
}

interface RegStudentRow {
  student_id: number;
  student_name: string;
  attendance: Record<number, AttStatus | null>;
  present: number;
  absent: number;
  total: number;
  rate: number;
}

interface AllTimeMonth {
  year: number;
  month: number;
  lessons: RegLesson[];
}

interface AllTimeRegister {
  group_title: string;
  months: AllTimeMonth[];
  students: RegStudentRow[];
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
  
  // Student modals
  const { openStudentModal } = useStudentModals();
  const { openLessonModal } = useLessonModals();
  
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsExpanded, setStudentsExpanded] = useState(true);
  const [lessonsExpanded, setLessonsExpanded] = useState(false);
  const [registerData, setRegisterData] = useState<AllTimeRegister | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);

  // Modal states
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  
  // Student search
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<StudentSearch[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingStudentId, setAddingStudentId] = useState<number | null>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Константа для ключа localStorage
  const STORAGE_KEY = 'itrobot-group-modals';

  // При відкритті сторінки групи - автоматично закрити модальне вікно для цієї групи
  useEffect(() => {
    if (groupId) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Перевіряємо формат - може бути масив (GroupModalsManager) або об'єкт (GroupModalsContext)
          let modalForGroup = null;
          
          if (Array.isArray(parsed)) {
            // Формат GroupModalsManager: масив об'єктів
            modalForGroup = parsed.find((m: { id: number }) => m.id === Number(groupId));
          } else if (typeof parsed === 'object') {
            // Формат GroupModalsContext: об'єкт з ключами groupId
            modalForGroup = parsed[groupId];
          }
          
          if (modalForGroup) {
            if (Array.isArray(parsed)) {
              // Видаляємо модальне вікно з масиву
              const newModals = parsed.filter((m: { id: number }) => m.id !== Number(groupId));
              localStorage.setItem(STORAGE_KEY, JSON.stringify(newModals));
            } else {
              // Видаляємо модальне вікно з об'єкта
              const newModals = { ...parsed };
              delete newModals[groupId];
              localStorage.setItem(STORAGE_KEY, JSON.stringify(newModals));
            }
            console.log(`Закрито модальне вікно групи ${groupId} (відкрите в іншому вікні)`);
          }
        }
      } catch (e) {
        console.error('Error checking modal state:', e);
      }
    }
  }, [groupId]);

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

        setRegisterLoading(true);
        try {
          const regRes = await fetch(`/api/attendance?view=groupRegisterAllTime&groupId=${groupId}&includeFuture=true`);
          const regData = await regRes.json();
          const parsed = regData?.data ?? regData;
          setRegisterData((parsed && Array.isArray(parsed.months)) ? parsed : null);
        } catch {
          // register data is non-critical
        } finally {
          setRegisterLoading(false);
        }
        
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

  // Скидаємо стан пошуку при відкритті модального вікна
  useEffect(() => {
    if (showAddStudentModal) {
      setStudentSearch('');
      setSearchResults([]);
    }
  }, [showAddStudentModal]);

  const handleSearchStudents = (query: string) => {
    setStudentSearch(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(query)}&includeInactive=true`);
        const data = await res.json();
        const existingIds = students.map(s => s.id);
        setSearchResults((data.students || []).filter((s: StudentSearch) => !existingIds.includes(s.id)));
      } catch (error) {
        console.error('Failed to search students:', error);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleAddStudent = async (studentId: number) => {
    setAddingStudentId(studentId);
    try {
      const res = await fetch(`/api/groups/${groupId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });

      if (res.ok) {
        const result = await res.json();
        const found = searchResults.find(s => s.id === studentId);
        if (found) {
          const newStudent: Student = {
            id: found.id,
            public_id: '',
            full_name: found.full_name,
            phone: found.phone || null,
            parent_name: null,
            parent_phone: null,
            join_date: new Date().toISOString(),
            photo: found.photo || null,
            student_group_id: result.id,
          };
          setStudents(prev => [...prev, newStudent]);
          setGroup(prev => prev ? { ...prev, students_count: (prev.students_count || 0) + 1 } : prev);
        }
        setSearchResults(prev => prev.filter(s => s.id !== studentId));
      } else {
        const data = await res.json();
        alert(data.error || 'Помилка додавання учня');
      }
    } catch (error) {
      console.error('Failed to add student:', error);
    } finally {
      setAddingStudentId(null);
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

  const formatDate = (dateStr: string) => {
    return formatShortDateKyiv(dateStr);
  };

  const MONTH_NAMES = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
  const MONTH_SHORT = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
  const WEEKDAY_SHORT = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];

  const formatLessonDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getUTCDate()).padStart(2,'0')} ${MONTH_SHORT[d.getUTCMonth()]}`;
  };

  const getWeekdayShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return WEEKDAY_SHORT[d.getUTCDay()];
  };

  const renderAttCell = (status: AttStatus | null) => {
    if (!status) return <span style={{ color: '#d1d5db' }}>○</span>;
    if (status === 'present') return <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>;
    if (status === 'absent') return <span style={{ color: '#dc2626', fontWeight: 700 }}>✗</span>;
    if (status === 'makeup_done') return <span style={{ color: '#2563eb', fontWeight: 700 }}>✓</span>;
    return <span style={{ color: '#d97706', fontWeight: 700 }}>↺</span>;
  };

  const renderRateBar = (rate: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      <div style={{ flex: 1, height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden', minWidth: 40 }}>
        <div style={{ height: '100%', width: `${rate}%`, backgroundColor: rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626', minWidth: 32 }}>{rate}%</span>
    </div>
  );

  const renderMonthMatrix = (month: AllTimeMonth, students: RegStudentRow[]) => (
    <div key={`${month.year}-${month.month}`} style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
            <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.8125rem', position: 'sticky', left: 0, backgroundColor: '#fafafa', minWidth: 140, whiteSpace: 'nowrap' }}>Учень</th>
            {month.lessons.map(l => (
              <th key={l.lesson_id}
                style={{ padding: '0.375rem 0.5rem', textAlign: 'center', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', cursor: 'pointer' }}
                title={l.topic ? `${l.topic} — відкрити заняття` : 'Відкрити заняття'}
                onClick={() => openLessonModal(l.lesson_id, `Заняття #${l.lesson_id}`, undefined)}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#eef2ff'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
                <div style={{ fontSize: '0.6rem', color: '#9ca3af', fontWeight: 500 }}>{getWeekdayShort(l.lesson_date)}</div>
                <div style={{ fontSize: '0.75rem' }}>{formatLessonDate(l.lesson_date)}</div>
                {l.topic && <div style={{ fontSize: '0.55rem', color: '#9ca3af', fontWeight: 400, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.topic}</div>}
              </th>
            ))}
            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600, color: '#374151', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>Всього</th>
            <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.8125rem', minWidth: 100 }}>%</th>
          </tr>
        </thead>
        <tbody>
          {students.map(s => {
            const monthPresent = month.lessons.filter(l => {
              const st = s.attendance[l.lesson_id];
              return st === 'present' || st === 'makeup_done';
            }).length;
            const monthAbsent = month.lessons.filter(l => {
              const st = s.attendance[l.lesson_id];
              return st === 'absent' || st === 'makeup_planned';
            }).length;
            const monthRate = month.lessons.length > 0 ? Math.round((monthPresent / month.lessons.length) * 100) : 0;
            return (
              <tr key={s.student_id} style={{ borderBottom: '1px solid #f9fafb' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <td style={{ padding: '0.5rem 1rem', fontWeight: 500, color: '#1d4ed8', position: 'sticky', left: 0, backgroundColor: 'white', whiteSpace: 'nowrap', cursor: 'pointer' }}
                  onClick={() => openStudentModal(s.student_id, s.student_name)}>{s.student_name}</td>
                {month.lessons.map(l => (
                  <td key={l.lesson_id} style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>
                    {renderAttCell(s.attendance[l.lesson_id] ?? null)}
                  </td>
                ))}
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#374151' }}>
                  <span style={{ fontWeight: 600, color: '#16a34a' }}>{monthPresent}</span>
                  <span style={{ color: '#9ca3af' }}>/{month.lessons.length}</span>
                  {monthAbsent > 0 && <span style={{ color: '#dc2626', marginLeft: 3, fontSize: '0.8125rem' }}>({monthAbsent}✗)</span>}
                </td>
                <td style={{ padding: '0.5rem 1rem' }}>{renderRateBar(monthRate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (loading || !user) {
    return (
      <Layout user={{ id: 0, name: '', email: '', role: 'teacher' }}>
        <div style={{ maxWidth: '100%' }}>

          {/* Animated group icon */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', paddingTop: '0.5rem' }}>
            {/* Avatars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '0.875rem' }}>
              {/* Back-left */}
              <div className="group-loader-avatar" style={{ animationDelay: '0s, 0.45s', width: 36, height: 36, borderRadius: '50%', backgroundColor: '#bfdbfe', border: '2.5px solid white', boxShadow: '0 2px 6px rgba(59,130,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              {/* Center (larger, front) */}
              <div className="group-loader-avatar" style={{ animationDelay: '0.12s, 0.57s', width: 48, height: 48, borderRadius: '50%', backgroundColor: '#3b82f6', border: '3px solid white', boxShadow: '0 4px 12px rgba(59,130,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              {/* Back-right */}
              <div className="group-loader-avatar" style={{ animationDelay: '0.24s, 0.69s', width: 36, height: 36, borderRadius: '50%', backgroundColor: '#dbeafe', border: '2.5px solid white', boxShadow: '0 2px 6px rgba(59,130,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              {/* Far-right small */}
              <div className="group-loader-avatar" style={{ animationDelay: '0.36s, 0.81s', width: 28, height: 28, borderRadius: '50%', backgroundColor: '#eff6ff', border: '2px solid white', boxShadow: '0 1px 4px rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            </div>
            {/* Label skeleton */}
            <div className="skeleton" style={{ height: 13, width: 110, borderRadius: 6, marginBottom: 4 }} />
          </div>

          {/* Page header skeleton */}
          <div className="skeleton-card-enter" style={{ animationDelay: '0.3s', marginBottom: '1.5rem' }}>
            <div className="skeleton" style={{ height: 36, width: '55%', marginBottom: '1rem', borderRadius: 8 }} />
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 999 }} />
              <div className="skeleton" style={{ height: 22, width: 60, borderRadius: 999 }} />
            </div>
          </div>

          {/* Two-column layout skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Students card skeleton */}
              <div className="card skeleton-card-enter" style={{ animationDelay: '0.42s', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                    <div className="skeleton" style={{ height: 18, width: 120, borderRadius: 5 }} />
                  </div>
                  <div className="skeleton" style={{ height: 32, width: 84, borderRadius: 6 }} />
                </div>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton" style={{ height: 14, width: `${55 + i * 12}%`, marginBottom: 6, borderRadius: 4 }} />
                      <div className="skeleton" style={{ height: 12, width: '40%', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Lessons card skeleton */}
              <div className="card skeleton-card-enter" style={{ animationDelay: '0.54s', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 18, width: 90, borderRadius: 5 }} />
                  </div>
                  <div className="skeleton" style={{ height: 14, width: 100, borderRadius: 4 }} />
                </div>
                <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: 8 }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{ flex: 1 }}>
                      <div className="skeleton" style={{ height: 10, borderRadius: 3, marginBottom: 4 }} />
                      <div className="skeleton" style={{ height: 10, borderRadius: 3 }} />
                    </div>
                  ))}
                </div>
                {[1, 2].map(i => (
                  <div key={i} style={{ padding: '0.5rem 1.25rem', borderTop: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="skeleton" style={{ height: 13, width: 120, borderRadius: 4 }} />
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                      {[1,2,3,4,5].map(j => (
                        <div key={j} className="skeleton" style={{ width: 18, height: 18, borderRadius: '50%' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Right column — details card */}
            <div className="card skeleton-card-enter" style={{ animationDelay: '0.42s', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                <div className="skeleton" style={{ height: 18, width: 70, borderRadius: 5 }} />
              </div>
              <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {[100, 80, 90, 75, 60].map((w, i) => (
                  <div key={i} style={{ padding: '0.875rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', border: '1px solid var(--gray-200)' }}>
                    <div className="skeleton" style={{ height: 10, width: '45%', marginBottom: 8, borderRadius: 3 }} />
                    <div className="skeleton" style={{ height: 16, width: `${w}%`, borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </div>

          </div>
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
              <div style={{ padding: '1.25rem', borderBottom: studentsExpanded ? '1px solid var(--gray-200)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setStudentsExpanded(!studentsExpanded)}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Склад групи
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAddStudentModal(true); }}
                      className="btn btn-primary"
                      style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', marginRight: '0.25rem' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.25rem' }}>
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Додати
                    </button>
                  )}
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="var(--gray-400)" 
                    strokeWidth="2"
                    style={{ transition: 'transform 0.2s', transform: studentsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
              {studentsExpanded && (
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
                        cursor: 'pointer',
                      }}
                      onClick={() => openStudentModal(student.id, student.full_name)}
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
                          onClick={(e) => { e.stopPropagation(); handleRemoveStudent(student.student_group_id, student.full_name); }}
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
              )}
            </div>

            {/* Lessons Card */}
            <div className="card">
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setLessonsExpanded(!lessonsExpanded)}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Заняття
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--gray-400)' }}>
                    {lessonsExpanded ? 'Усі місяці' : (() => {
                      if (!registerData?.months?.length) return 'Поточний місяць';
                      const now = new Date();
                      const curYear = now.getFullYear();
                      const curMonth = now.getMonth() + 1;
                      const hasCurrentMonth = registerData.months.some(m => m.year === curYear && m.month === curMonth);
                      if (hasCurrentMonth) return 'Поточний місяць';
                      const last = registerData.months[registerData.months.length - 1];
                      return `${MONTH_NAMES[last.month - 1]} ${last.year}`;
                    })()}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--gray-400)"
                    strokeWidth="2"
                    style={{ transition: 'transform 0.2s', transform: lessonsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
              <div>
                {registerLoading ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.875rem' }}>Завантаження...</div>
                ) : !registerData || !registerData.months?.length ? (
                  <div style={{ padding: '2.5rem 1.25rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <p style={{ margin: 0 }}>Немає занять</p>
                  </div>
                ) : (() => {
                  const now = new Date();
                  const curYear = now.getFullYear();
                  const curMonth = now.getMonth() + 1;
                  let monthsToShow: AllTimeMonth[];
                  if (lessonsExpanded) {
                    monthsToShow = [...registerData.months].reverse();
                  } else {
                    const currentMonthData = registerData.months.filter(m => m.year === curYear && m.month === curMonth);
                    if (currentMonthData.length > 0) {
                      monthsToShow = currentMonthData;
                    } else {
                      // No lessons this month — show the most recent available month
                      monthsToShow = registerData.months.length > 0
                        ? [registerData.months[registerData.months.length - 1]]
                        : [];
                    }
                  }
                  return (
                    <div>
                      {monthsToShow.map(month => (
                        <div key={`${month.year}-${month.month}`}>
                          {(lessonsExpanded || monthsToShow.length > 1 || month.month !== curMonth || month.year !== curYear) && (
                            <div style={{ padding: '0.625rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', borderTop: '1px solid #f3f4f6', fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                              {MONTH_NAMES[month.month - 1]} {month.year}
                              <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: '0.5rem' }}>— {month.lessons.length} {month.lessons.length === 1 ? 'заняття' : 'занять'}</span>
                            </div>
                          )}
                          {renderMonthMatrix(month, registerData.students)}
                        </div>
                      ))}
                    </div>
                  );
                })()}
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

              {/* Group History */}
              <div style={{ marginTop: '1rem' }}>
                <GroupHistoryPanel groupId={groupId} />
              </div>

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
              
              <style>{`@keyframes grp-spin { to { transform: rotate(360deg); } }`}</style>

              {searching && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem 0', color: 'var(--gray-500)' }}>
                  <span style={{ width: '16px', height: '16px', border: '2px solid var(--gray-300)', borderTopColor: 'var(--primary)', borderRadius: '50%', display: 'inline-block', animation: 'grp-spin 0.7s linear infinite' }} />
                  Пошук...
                </div>
              )}

              {!searching && studentSearch.length < 2 && (
                <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '1.5rem 0', fontSize: '0.875rem' }}>
                  Введіть мінімум 2 символи для пошуку
                </p>
              )}

              {!searching && studentSearch.length >= 2 && searchResults.length === 0 && (
                <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '1rem 0' }}>
                  Учнів не знайдено
                </p>
              )}

              {searchResults.length > 0 && (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {searchResults.map((student) => {
                    const isAdding = addingStudentId === student.id;
                    return (
                      <div
                        key={student.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.75rem',
                          borderBottom: '1px solid var(--gray-100)',
                        }}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: student.photo ? 'transparent' : 'var(--gray-100)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: '600', marginRight: '0.75rem',
                          flexShrink: 0, overflow: 'hidden', color: 'var(--gray-600)',
                        }}>
                          {student.photo ? (
                            <img src={student.photo} alt={student.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={isAdding}
                          onClick={() => handleAddStudent(student.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', opacity: isAdding ? 0.7 : 1, minWidth: '80px', justifyContent: 'center' }}
                        >
                          {isAdding ? (
                            <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'grp-spin 0.7s linear infinite' }} />
                          ) : null}
                          Додати
                        </button>
                      </div>
                    );
                  })}
                </div>
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

    </Layout>
  );
}
