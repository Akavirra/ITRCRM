'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Portal from '@/components/Portal';
import { useGroupModals } from '@/components/GroupModalsContext';
import { uk } from '@/i18n/uk';
import PageLoading from '@/components/PageLoading';
import CreateGroupModal from '@/components/CreateGroupModal';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface Course {
  id: number;
  title: string;
}

interface Teacher {
  id: number;
  name: string;
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
  start_date: string | null;
  is_active: boolean;
  created_at: string;
}

export default function GroupsPage() {
  const router = useRouter();
  const { openGroupModal } = useGroupModals();
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState<number[]>([]);
  // Sort: 'day' - by day of week, 'course' - by course (with day/time), 'months' - by months
  const [sortBy, setSortBy] = useState<'day' | 'course' | 'months' | null>(null);
  
  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  
  // Archive toggle
  const [showArchived, setShowArchived] = useState(false);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [groupDeletionWarning, setGroupDeletionWarning] = useState<{
    canDelete: boolean;
    students: { id: number; full_name: string }[];
    lessons: { id: number; date: string }[];
    payments: { id: number; amount: number; date: string }[];
  } | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // Graduate modal state
  const [showGraduateModal, setShowGraduateModal] = useState(false);
  const [groupToGraduate, setGroupToGraduate] = useState<Group | null>(null);
  const [graduationDate, setGraduationDate] = useState('');
  const [graduating, setGraduating] = useState(false);

  // Archive modal state
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [groupToArchive, setGroupToArchive] = useState<Group | null>(null);
  const [archiveDate, setArchiveDate] = useState('');
  const [archiving, setArchiving] = useState(false);

  // Change teacher modal state
  const [showChangeTeacherModal, setShowChangeTeacherModal] = useState(false);
  const [groupToChangeTeacher, setGroupToChangeTeacher] = useState<Group | null>(null);
  const [changeTeacherNewId, setChangeTeacherNewId] = useState('');
  const [changeTeacherReason, setChangeTeacherReason] = useState('');
  const [savingTeacherChange, setSavingTeacherChange] = useState(false);
  const [changeTeacherError, setChangeTeacherError] = useState('');

  // Reschedule modal state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [groupToReschedule, setGroupToReschedule] = useState<Group | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ newWeeklyDay: '', newStartTime: '', newDurationMinutes: '', reason: '' });
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);

  // Edit Group Modal state

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

        // Fetch groups with includeInactive to get all groups
        const groupsRes = await fetch('/api/groups?includeInactive=true');
        const groupsData = await groupsRes.json();
        setGroups(groupsData.groups || []);

        // Fetch courses for filter
        const coursesRes = await fetch('/api/courses');
        const coursesData = await coursesRes.json();
        setCourses(coursesData.courses || []);

        // Fetch teachers for filter (admin only)
        if (authData.user.role === 'admin') {
          const teachersRes = await fetch('/api/teachers');
          const teachersData = await teachersRes.json();
          setTeachers(Array.isArray(teachersData) ? teachersData : []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
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
    applyFilters(query, courseFilter, teacherFilter, daysFilter);
  };

  const handleFilterChange = (filterType: string, value: string) => {
    switch (filterType) {
      case 'course':
        setCourseFilter(value);
        applyFilters(search, value, teacherFilter, daysFilter);
        break;
      case 'teacher':
        setTeacherFilter(value);
        applyFilters(search, courseFilter, value, daysFilter);
        break;
    }
  };

  const handleDaysFilterChange = (day: number) => {
    const newDays = daysFilter.includes(day)
      ? daysFilter.filter(d => d !== day)
      : [...daysFilter, day];
    setDaysFilter(newDays);
    applyFilters(search, courseFilter, teacherFilter, newDays);
  };

  const applyFilters = async (searchQuery: string, course: string, teacher: string, days: number[]) => {
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (course) params.append('courseId', course);
    if (teacher) params.append('teacherId', teacher);
    if (days.length > 0) params.append('days', days.join(','));
    params.append('includeInactive', 'true');

    const res = await fetch(`/api/groups?${params.toString()}`);
    const data = await res.json();
    setGroups(data.groups || []);
  };

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

  const getStatusLabel = (status: string) => {
    return uk.groupStatus[status as keyof typeof uk.groupStatus] || status;
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


  const handleArchive = async (group: Group) => {
    const action = group.status === 'active' ? 'archive' : 'restore';
    const actionText = group.status === 'active' ? 'архівувати' : 'відновити';
    
    if (!confirm(`${actionText} групу "${group.title}"?`)) return;
    
    try {
      await fetch(`/api/groups/${group.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
      // Refresh groups
      const res = await fetch('/api/groups?includeInactive=true');
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Failed to archive/restore group:', error);
    }
  };

  const handleDeleteClick = async (group: Group) => {
    setGroupToDelete(group);
    setDeletePassword('');
    setDeleteError('');
    setGroupDeletionWarning(null);
    setOpenDropdownId(null);
    setShowDeleteModal(true);
    
    // Check if group can be deleted
    try {
      const res = await fetch(`/api/groups/${group.id}?checkDelete=true`);
      const data = await res.json();
      setGroupDeletionWarning(data);
    } catch (error) {
      console.error('Failed to check group deletion status:', error);
      setGroupDeletionWarning({ canDelete: false, students: [], lessons: [], payments: [] });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!groupToDelete) return;
    
    setDeleting(true);
    setDeleteError('');
    
    try {
      const response = await fetch(`/api/groups/${groupToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword })
      });
      
      if (response.ok) {
        setShowDeleteModal(false);
        setGroupToDelete(null);
        setDeletePassword('');
        // Refresh groups
        const res = await fetch('/api/groups?includeInactive=true');
        const data = await res.json();
        setGroups(data.groups || []);
      } else {
        const errorData = await response.json();
        if (response.status === 401) {
          setDeleteError('Невірний пароль');
        } else if (response.status === 403) {
          setDeleteError('Недостатньо прав');
        } else if (response.status === 409) {
          setDeleteError(errorData.error || 'Неможливо видалити групу');
        } else {
          setDeleteError(errorData.error || 'Сталася помилка. Спробуйте ще раз.');
        }
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
      setDeleteError('Сталася помилка. Спробуйте ще раз.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setGroupToDelete(null);
    setDeletePassword('');
    setDeleteError('');
    setGroupDeletionWarning(null);
  };

  // Graduate handlers
  const handleGraduateClick = (group: Group) => {
    setGroupToGraduate(group);
    setGraduationDate(new Date().toISOString().split('T')[0]);
    setOpenDropdownId(null);
    setShowGraduateModal(true);
  };

  const handleGraduateConfirm = async () => {
    if (!groupToGraduate || !graduationDate) return;
    setGraduating(true);
    try {
      const res = await fetch(`/api/groups/${groupToGraduate.id}/graduate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graduation_date: graduationDate }),
      });
      if (res.ok) {
        setShowGraduateModal(false);
        setGroupToGraduate(null);
        // Refresh groups list
        const groupsRes = await fetch('/api/groups');
        const data = await groupsRes.json();
        setGroups(data.groups || []);
      } else {
        const data = await res.json();
        alert(data.error || 'Помилка випуску групи');
      }
    } catch (error) {
      console.error('Graduate error:', error);
    } finally {
      setGraduating(false);
    }
  };

  // Archive handlers
  const handleArchiveClick = (group: Group) => {
    setGroupToArchive(group);
    setArchiveDate(new Date().toISOString().split('T')[0]);
    setOpenDropdownId(null);
    setShowArchiveModal(true);
  };

  const handleArchiveConfirm = async () => {
    if (!groupToArchive || !archiveDate) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/groups/${groupToArchive.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive_date: archiveDate }),
      });
      if (res.ok) {
        setShowArchiveModal(false);
        setGroupToArchive(null);
        const groupsRes = await fetch('/api/groups?includeInactive=true');
        const data = await groupsRes.json();
        setGroups(data.groups || []);
      } else {
        const data = await res.json();
        alert(data.error || 'Помилка архівації групи');
      }
    } catch (error) {
      console.error('Archive error:', error);
    } finally {
      setArchiving(false);
    }
  };

  // Change teacher handlers
  const handleChangeTeacherClick = (group: Group) => {
    setGroupToChangeTeacher(group);
    setChangeTeacherNewId('');
    setChangeTeacherReason('');
    setChangeTeacherError('');
    setOpenDropdownId(null);
    setShowChangeTeacherModal(true);
  };

  const handleChangeTeacherSave = async () => {
    if (!groupToChangeTeacher || !changeTeacherNewId) return;
    setSavingTeacherChange(true);
    setChangeTeacherError('');
    try {
      const res = await fetch(`/api/groups/${groupToChangeTeacher.id}/change-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTeacherId: parseInt(changeTeacherNewId),
          reason: changeTeacherReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChangeTeacherError(data.error || 'Помилка зміни викладача');
        return;
      }
      setShowChangeTeacherModal(false);
      setGroupToChangeTeacher(null);
      // Refresh groups list
      const groupsRes = await fetch('/api/groups?includeInactive=true');
      const groupsData = await groupsRes.json();
      setGroups(groupsData.groups || []);
    } catch {
      setChangeTeacherError("Помилка з'єднання");
    } finally {
      setSavingTeacherChange(false);
    }
  };

  // Reschedule handlers
  const handleRescheduleClick = (group: Group) => {
    setGroupToReschedule(group);
    setRescheduleForm({
      newWeeklyDay: String(group.weekly_day),
      newStartTime: group.start_time,
      newDurationMinutes: String(group.duration_minutes),
      reason: '',
    });
    setRescheduleError('');
    setOpenDropdownId(null);
    setShowRescheduleModal(true);
  };

  const handleRescheduleConfirm = async () => {
    if (!groupToReschedule || !rescheduleForm.newWeeklyDay || !rescheduleForm.newStartTime || !rescheduleForm.newDurationMinutes) return;
    setRescheduling(true);
    setRescheduleError('');
    try {
      const res = await fetch(`/api/groups/${groupToReschedule.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newWeeklyDay: parseInt(rescheduleForm.newWeeklyDay),
          newStartTime: rescheduleForm.newStartTime,
          newDurationMinutes: parseInt(rescheduleForm.newDurationMinutes),
          reason: rescheduleForm.reason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRescheduleError(data.error || 'Помилка перенесення');
        return;
      }
      setShowRescheduleModal(false);
      setGroupToReschedule(null);
      // Refresh groups list
      const groupsRes = await fetch('/api/groups?includeInactive=true');
      const groupsData = await groupsRes.json();
      setGroups(groupsData.groups || []);
    } catch {
      setRescheduleError("Помилка з'єднання");
    } finally {
      setRescheduling(false);
    }
  };


  if (loading) {
    return (
      <Layout user={{ id: 0, name: '', email: '', role: 'admin' }}>
        <PageLoading />
      </Layout>
    );
  }

  if (!user) return null;

  // Filter groups based on archive toggle and sort by selected criteria
  const filteredGroups = groups
    .filter(group => {
      if (showArchived) {
        // Show inactive (archived) and graduate groups in archive view
        return (group.status === 'inactive' || group.status === 'graduate') && 
          group.title.toLowerCase().includes(search.toLowerCase());
      }
      // Show only active groups
      return group.status === 'active' && group.title.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'day') {
        // Sort by day of week, then by time
        if (a.weekly_day !== b.weekly_day) {
          return a.weekly_day - b.weekly_day;
        }
        return a.start_time.localeCompare(b.start_time);
      } else if (sortBy === 'course') {
        // Sort by course title (alphabetically), then by day, then by time
        const courseCompare = a.course_title.localeCompare(b.course_title, 'uk');
        if (courseCompare !== 0) return courseCompare;
        if (a.weekly_day !== b.weekly_day) {
          return a.weekly_day - b.weekly_day;
        }
        return a.start_time.localeCompare(b.start_time);
      } else if (sortBy === 'months') {
        // Sort by months since creation (ascending)
        return getMonthsSinceCreated(a.created_at) - getMonthsSinceCreated(b.created_at);
      }
      return 0;
    });

  return (
    <Layout user={user}>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {/* Search */}
          <input
            type="text"
            className="form-input"
            placeholder={`${uk.actions.search}...`}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: '200px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
          />

          {/* Course filter - compact select */}
          <select
            className="form-input"
            value={courseFilter}
            onChange={(e) => handleFilterChange('course', e.target.value)}
            style={{ width: '160px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
          >
            <option value="">{uk.pages.courses}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>

          {/* Teacher filter (admin only) */}
          {user.role === 'admin' && (
            <select
              className="form-input"
              value={teacherFilter}
              onChange={(e) => handleFilterChange('teacher', e.target.value)}
              style={{ width: '160px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
            >
              <option value="">{uk.roles.teacher}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          )}

          {/* Sort buttons */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {/* Sort by day of week */}
            <button
              onClick={() => setSortBy(sortBy === 'day' ? null : 'day')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.5rem 0.875rem',
                fontSize: '0.875rem',
                fontWeight: sortBy === 'day' ? '600' : '400',
                borderRadius: '0.375rem',
                border: sortBy === 'day' ? '1px solid #374151' : '1px solid #e5e7eb',
                backgroundColor: sortBy === 'day' ? '#374151' : 'white',
                color: sortBy === 'day' ? 'white' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {sortBy === 'day' ? (
                  <path d="M12 5v14M5 12l7-7 7 7" />
                ) : (
                  <path d="M8 6l4 4 4-4M8 18l4-4 4 4" />
                )}
              </svg>
              День
            </button>

            {/* Sort by course */}
            <button
              onClick={() => setSortBy(sortBy === 'course' ? null : 'course')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.5rem 0.875rem',
                fontSize: '0.875rem',
                fontWeight: sortBy === 'course' ? '600' : '400',
                borderRadius: '0.375rem',
                border: sortBy === 'course' ? '1px solid #374151' : '1px solid #e5e7eb',
                backgroundColor: sortBy === 'course' ? '#374151' : 'white',
                color: sortBy === 'course' ? 'white' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {sortBy === 'course' ? (
                  <path d="M12 5v14M5 12l7-7 7 7" />
                ) : (
                  <path d="M8 6l4 4 4-4M8 18l4-4 4 4" />
                )}
              </svg>
              Курс
            </button>

            {/* Sort by months */}
            <button
              onClick={() => setSortBy(sortBy === 'months' ? null : 'months')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.5rem 0.875rem',
                fontSize: '0.875rem',
                fontWeight: sortBy === 'months' ? '600' : '400',
                borderRadius: '0.375rem',
                border: sortBy === 'months' ? '1px solid #374151' : '1px solid #e5e7eb',
                backgroundColor: sortBy === 'months' ? '#374151' : 'white',
                color: sortBy === 'months' ? 'white' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {sortBy === 'months' ? (
                  <path d="M12 5v14M5 12l7-7 7 7" />
                ) : (
                  <path d="M8 6l4 4 4-4M8 18l4-4 4 4" />
                )}
              </svg>
              Місяців
            </button>
          </div>

          {/* Days of week filter - compact chips */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <button
                key={day}
                onClick={() => handleDaysFilterChange(day)}
                style={{
                  padding: '0.5rem 0.625rem',
                  fontSize: '0.8125rem',
                  fontWeight: daysFilter.includes(day) ? '600' : '400',
                  borderRadius: '0.375rem',
                  border: daysFilter.includes(day) ? '1px solid #374151' : '1px solid #e5e7eb',
                  backgroundColor: daysFilter.includes(day) ? '#374151' : 'white',
                  color: daysFilter.includes(day) ? 'white' : '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {uk.daysShort[day as keyof typeof uk.daysShort] || getDayName(day).slice(0, 2)}
              </button>
            ))}
          </div>

          {/* Right side: toggle and button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            {/* Toggle switch for archived groups */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              <span 
                style={{ 
                  fontSize: '0.8125rem', 
                  fontWeight: !showArchived ? '600' : '400', 
                  color: !showArchived ? '#111827' : '#9ca3af',
                  transition: 'all 0.2s',
                }}
              >
                {uk.status.active}
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
                {uk.status.archived}
              </span>
            </div>
            {user.role === 'admin' && (
              <button className="btn btn-primary" onClick={() => setShowNewGroupModal(true)}>
                + {uk.actions.addGroup}
              </button>
            )}
          </div>
        </div>

        <div className="table-container">
          {filteredGroups.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>{uk.table.id}</th>
                  <th>{uk.table.title}</th>
                  <th>{uk.table.course}</th>
                  <th>{uk.table.schedule}</th>
                  {user.role === 'admin' && <th>{uk.table.teacher}</th>}
                  <th style={{ textAlign: 'center' }}>{uk.table.students}</th>
                  <th style={{ textAlign: 'center' }}>Місяців</th>
                  <th>{uk.common.status}</th>
                  <th>{uk.table.note}</th>
                  {user.role === 'admin' && <th style={{ textAlign: 'right' }}>{uk.common.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((group) => (
                  <tr key={group.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280' }}>
                      {group.public_id}
                    </td>
                    <td>
                      <a href={`/groups/${group.id}`} style={{ fontWeight: '500' }}>
                        {group.title}
                      </a>
                    </td>
                    <td>{group.course_title}</td>
                    <td>
                      {getDayName(group.weekly_day)} {group.start_time}
                      <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                        ({group.duration_minutes} {uk.plural.minute.many})
                      </span>
                    </td>
                    {user.role === 'admin' && <td>{group.teacher_name}</td>}
                    <td style={{ textAlign: 'center' }}>{group.students_count}</td>
                    <td style={{ textAlign: 'center', fontWeight: 500, color: 'var(--gray-700)' }}>
                      {getMonthsSinceCreated(group.created_at)}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(group.status)}`}>
                        {getStatusLabel(group.status)}
                      </span>
                    </td>
                    <td>
                      {group.note ? (
                        <span style={{ 
                          maxWidth: '150px', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}>
                          {group.note}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    {user.role === 'admin' && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-block' }}>
                          <button
                            ref={openDropdownId === group.id ? dropdownButtonRef : undefined}
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === group.id ? null : group.id);
                            }}
                            style={{ 
                              padding: '0.5rem',
                              borderRadius: '0.5rem',
                              backgroundColor: openDropdownId === group.id ? '#f3f4f6' : 'transparent',
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
                          {openDropdownId === group.id && (
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
                                  @keyframes spin {
                                    to { transform: rotate(360deg); }
                                  }
                                `}</style>
                                <a
                                  href={`/groups/${group.id}`}
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
                                  Переглянути групу
                                </a>
                                <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0' }} />
                                <button
                                  className="btn"
                                  onClick={(e) => { e.stopPropagation(); handleChangeTeacherClick(group); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    width: '100%', padding: '0.625rem 0.75rem',
                                    color: '#1d4ed8', textAlign: 'left',
                                    background: 'none', border: 'none',
                                    fontSize: '0.875rem', fontWeight: '500',
                                    borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.15s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
                                  </svg>
                                  Змінити викладача
                                </button>
                                {group.status === 'active' && (
                                  <>
                                    <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0' }} />
                                    <button
                                      className="btn"
                                      onClick={(e) => { e.stopPropagation(); handleRescheduleClick(group); }}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                                        width: '100%', padding: '0.625rem 0.75rem',
                                        color: '#0369a1', textAlign: 'left',
                                        background: 'none', border: 'none',
                                        fontSize: '0.875rem', fontWeight: '500',
                                        borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.15s',
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f9ff'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                                        <line x1="3" y1="10" x2="21" y2="10"/>
                                        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
                                      </svg>
                                      Перенести групу
                                    </button>
                                  </>
                                )}
                                {group.status !== 'graduate' && (
                                  <>
                                    <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0' }} />
                                    <button
                                      className="btn"
                                      onClick={(e) => { e.stopPropagation(); handleGraduateClick(group); }}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                                        width: '100%', padding: '0.625rem 0.75rem',
                                        color: '#7c3aed', textAlign: 'left',
                                        background: 'none', border: 'none',
                                        fontSize: '0.875rem', fontWeight: '500',
                                        borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.15s',
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f3ff'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                                      </svg>
                                      Випустити групу
                                    </button>
                                  </>
                                )}
                                {group.status === 'active' && (
                                  <>
                                    <button
                                      className="btn"
                                      onClick={(e) => { e.stopPropagation(); handleArchiveClick(group); }}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                                        width: '100%', padding: '0.625rem 0.75rem',
                                        color: '#b45309', textAlign: 'left',
                                        background: 'none', border: 'none',
                                        fontSize: '0.875rem', fontWeight: '500',
                                        borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.15s',
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fffbeb'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="21 8 21 21 3 21 3 8" />
                                        <rect x="1" y="3" width="22" height="5" />
                                        <line x1="10" y1="12" x2="14" y2="12" />
                                      </svg>
                                      Архівувати групу
                                    </button>
                                  </>
                                )}
                                <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0' }} />
                                <button
                                  className="btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(group);
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
                                  Видалити групу
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
                          openGroupModal(group.id, group.title);
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
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="empty-state-title">{uk.emptyStates.noGroups}</h3>
              <p className="empty-state-text">
                {user.role === 'teacher' 
                  ? uk.emptyStates.noGroupsTeacher
                  : uk.emptyStates.noGroupsHint}
              </p>
              {user.role === 'admin' && (
                <button className="btn btn-primary" onClick={() => setShowNewGroupModal(true)}>
                  {uk.actions.addGroup}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Graduate Modal */}
      {showChangeTeacherModal && groupToChangeTeacher && (
        <div className="modal-overlay" onClick={() => !savingTeacherChange && setShowChangeTeacherModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Змінити викладача
              </h3>
              <button className="modal-close" onClick={() => setShowChangeTeacherModal(false)} disabled={savingTeacherChange}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 1rem 0', color: '#374151', fontSize: '0.9375rem' }}>
                Група: <strong>{groupToChangeTeacher.title}</strong>
              </p>
              <p style={{ margin: '0 0 1rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                Поточний викладач: <strong>{groupToChangeTeacher.teacher_name}</strong>
              </p>
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem', color: '#374151' }}>
                  Новий викладач *
                </label>
                <select
                  className="form-select"
                  value={changeTeacherNewId}
                  onChange={(e) => setChangeTeacherNewId(e.target.value)}
                  disabled={savingTeacherChange}
                >
                  <option value="">Оберіть викладача...</option>
                  {teachers.filter(t => t.id !== groupToChangeTeacher.teacher_id).map(t => (
                    <option key={t.id} value={String(t.id)}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem', color: '#374151' }}>
                  Причина (необов'язково)
                </label>
                <textarea
                  className="form-input"
                  value={changeTeacherReason}
                  onChange={(e) => setChangeTeacherReason(e.target.value)}
                  placeholder="Вкажіть причину зміни..."
                  rows={2}
                  disabled={savingTeacherChange}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              {changeTeacherError && (
                <p style={{ margin: '0.625rem 0 0', color: '#dc2626', fontSize: '0.875rem' }}>{changeTeacherError}</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowChangeTeacherModal(false)} disabled={savingTeacherChange}>
                Скасувати
              </button>
              <button
                className="btn btn-primary"
                onClick={handleChangeTeacherSave}
                disabled={savingTeacherChange || !changeTeacherNewId}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: !changeTeacherNewId ? 0.6 : 1 }}
              >
                {savingTeacherChange && (
                  <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                )}
                {savingTeacherChange ? 'Збереження...' : 'Змінити викладача'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGraduateModal && groupToGraduate && (
        <div className="modal-overlay" onClick={() => !graduating && setShowGraduateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                Випуск групи
              </h3>
              <button className="modal-close" onClick={() => setShowGraduateModal(false)} disabled={graduating}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 1.25rem 0', color: '#374151' }}>
                Група <strong>{groupToGraduate.title}</strong> буде переведена в архів зі статусом <strong>Випуск</strong>.
              </p>
              <ul style={{ margin: '0 0 1.25rem 0', paddingLeft: '1.25rem', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.7 }}>
                <li>Усі майбутні заняття після дати випуску будуть видалені</li>
                <li>Учні відв'язуються від групи (але список зберігається)</li>
                <li>Група зникне з профілів викладача та учнів</li>
                <li>Нові заняття більше не генеруватимуться</li>
              </ul>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', color: '#374151' }}>
                Дата випуску
              </label>
              <input
                type="date"
                className="form-input"
                value={graduationDate}
                onChange={(e) => setGraduationDate(e.target.value)}
                disabled={graduating}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowGraduateModal(false)} disabled={graduating}>
                Скасувати
              </button>
              <button
                className="btn"
                onClick={handleGraduateConfirm}
                disabled={graduating || !graduationDate}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  backgroundColor: '#7c3aed', color: 'white', border: 'none',
                  padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
                  fontWeight: 500, cursor: graduating ? 'default' : 'pointer',
                  opacity: graduating ? 0.7 : 1,
                }}
              >
                {graduating && (
                  <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                )}
                Випустити групу
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && groupToArchive && (
        <div className="modal-overlay" onClick={() => !archiving && setShowArchiveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                Архівування групи
              </h3>
              <button className="modal-close" onClick={() => setShowArchiveModal(false)} disabled={archiving}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 1.25rem 0', color: '#374151' }}>
                Група <strong>{groupToArchive.title}</strong> буде переведена в архів зі статусом <strong>Неактивна</strong>.
              </p>
              <ul style={{ margin: '0 0 1.25rem 0', paddingLeft: '1.25rem', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.7 }}>
                <li>Усі майбутні заняття після дати архівації будуть видалені</li>
                <li>Учні відв'язуються від групи (але список зберігається)</li>
                <li>В історії кожного учня з'явиться відповідна відмітка</li>
                <li>Група зникне з профілів викладача та учнів</li>
                <li>Нові заняття більше не генеруватимуться</li>
              </ul>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', color: '#374151' }}>
                Дата архівації
              </label>
              <input
                type="date"
                className="form-input"
                value={archiveDate}
                onChange={(e) => setArchiveDate(e.target.value)}
                disabled={archiving}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowArchiveModal(false)} disabled={archiving}>
                Скасувати
              </button>
              <button
                className="btn"
                onClick={handleArchiveConfirm}
                disabled={archiving || !archiveDate}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  backgroundColor: '#b45309', color: 'white', border: 'none',
                  padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
                  fontWeight: 500, cursor: archiving ? 'default' : 'pointer',
                  opacity: archiving ? 0.7 : 1,
                }}
              >
                {archiving && (
                  <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                )}
                Архівувати групу
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && groupToDelete && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Підтвердження видалення</h3>
              <button className="modal-close" onClick={handleDeleteCancel} disabled={deleting}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 1rem 0' }}>
                Ви збираєтеся остаточно видалити групу <strong>{groupToDelete.title}</strong>.
              </p>
              
              {/* Loading state */}
              {groupDeletionWarning === null && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  Перевірка можливості видалення...
                </div>
              )}
              
              {/* Warning about students, lessons, and payments */}
              {groupDeletionWarning && !groupDeletionWarning.canDelete && (
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
                    Група містить дані
                  </div>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#92400e' }}>
                    Неможливо видалити групу, оскільки вона містить:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#92400e' }}>
                    {groupDeletionWarning.students.length > 0 && (
                      <li>
                        <strong>{groupDeletionWarning.students.length}</strong> {groupDeletionWarning.students.length === 1 ? 'учень' : groupDeletionWarning.students.length < 5 ? 'учні' : 'учнів'}:
                        <ul style={{ marginTop: '0.25rem' }}>
                          {groupDeletionWarning.students.slice(0, 5).map(s => (
                            <li key={s.id}>{s.full_name}</li>
                          ))}
                          {groupDeletionWarning.students.length > 5 && (
                            <li>...та ще {groupDeletionWarning.students.length - 5}</li>
                          )}
                        </ul>
                      </li>
                    )}
                    {groupDeletionWarning.lessons.length > 0 && (
                      <li>
                        <strong>{groupDeletionWarning.lessons.length}</strong> {groupDeletionWarning.lessons.length === 1 ? 'заняття' : groupDeletionWarning.lessons.length < 5 ? 'заняття' : 'занять'}
                      </li>
                    )}
                    {groupDeletionWarning.payments.length > 0 && (
                      <li>
                        <strong>{groupDeletionWarning.payments.length}</strong> {groupDeletionWarning.payments.length === 1 ? 'платіж' : groupDeletionWarning.payments.length < 5 ? 'платежі' : 'платежів'}
                      </li>
                    )}
                  </ul>
                </div>
              )}
              
              {/* Safe to delete message */}
              {groupDeletionWarning && groupDeletionWarning.canDelete && (
                <div style={{
                  backgroundColor: '#ecfdf5',
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
                    Групу можна видалити
                  </div>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#065f46' }}>
                    Група порожня і не містить жодних даних.
                  </p>
                </div>
              )}
              
              <p style={{ margin: '0 0 1rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                Ця дія незворотня. Всі дані про групу будуть видалені.
              </p>
              
              <p style={{ margin: '0 0 1rem 0' }}>
                Щоб підтвердити видалення, введіть пароль адміністратора.
              </p>
              
              {/* Only show password input if group can be deleted */}
              {groupDeletionWarning && groupDeletionWarning.canDelete && (
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
              )}
              
              {/* Show message if cannot delete */}
              {groupDeletionWarning && !groupDeletionWarning.canDelete && (
                <div style={{
                  color: '#dc2626',
                  backgroundColor: '#fef2f2',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}>
                  Спочатку виберіть дію «Архівувати» замість видалення, щоб зберегти історію групи.
                </div>
              )}
              
              {deleteError && (
                <div style={{ 
                  color: '#dc2626', 
                  backgroundColor: '#fef2f2', 
                  padding: '0.75rem', 
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  marginTop: '1rem'
                }}>
                  {deleteError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {groupDeletionWarning === null ? (
                <button className="btn btn-secondary" onClick={handleDeleteCancel} disabled={deleting}>
                  Скасувати
                </button>
              ) : groupDeletionWarning.canDelete ? (
                <>
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
                </>
              ) : (
                <button className="btn btn-secondary" onClick={handleDeleteCancel}>
                  Закрити
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      <CreateGroupModal 
        isOpen={showNewGroupModal} 
        onClose={() => setShowNewGroupModal(false)} 
        onSuccess={async () => {
          setShowNewGroupModal(false);
          const groupsRes = await fetch('/api/groups?includeInactive=true');
          const groupsData = await groupsRes.json();
          setGroups(groupsData.groups || []);
        }} 
      />

      {/* Reschedule Modal */}
      {showRescheduleModal && groupToReschedule && (
        <div className="modal-overlay" onClick={() => !rescheduling && setShowRescheduleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Перенести розклад групи
              </h3>
              <button className="modal-close" onClick={() => setShowRescheduleModal(false)} disabled={rescheduling}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bae6fd', marginBottom: '1.25rem', fontSize: '0.8125rem', color: '#0369a1' }}>
                <strong>Поточний розклад:</strong> {uk.days[groupToReschedule.weekly_day as keyof typeof uk.days]} о {groupToReschedule.start_time} ({groupToReschedule.duration_minutes} хв)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem', color: '#374151' }}>День тижня</label>
                  <select
                    className="form-select"
                    value={rescheduleForm.newWeeklyDay}
                    onChange={e => setRescheduleForm(f => ({ ...f, newWeeklyDay: e.target.value }))}
                    disabled={rescheduling}
                  >
                    {[1,2,3,4,5,6,7].map(d => (
                      <option key={d} value={String(d)}>{uk.days[d as keyof typeof uk.days]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem', color: '#374151' }}>Час початку</label>
                  <input
                    type="time"
                    className="form-input"
                    value={rescheduleForm.newStartTime}
                    onChange={e => setRescheduleForm(f => ({ ...f, newStartTime: e.target.value }))}
                    disabled={rescheduling}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem', color: '#374151' }}>Тривалість (хв)</label>
                <input
                  type="number"
                  className="form-input"
                  value={rescheduleForm.newDurationMinutes}
                  onChange={e => setRescheduleForm(f => ({ ...f, newDurationMinutes: e.target.value }))}
                  min="15" step="15" max="480"
                  disabled={rescheduling}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem', color: '#374151' }}>Причина зміни (необов&apos;язково)</label>
                <textarea
                  className="form-input"
                  value={rescheduleForm.reason}
                  onChange={e => setRescheduleForm(f => ({ ...f, reason: e.target.value }))}
                  rows={2}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  disabled={rescheduling}
                  placeholder="Наприклад: зміна зали, зручніший час для батьків..."
                />
              </div>
              <ul style={{ margin: '0', paddingLeft: '1.25rem', color: '#6b7280', fontSize: '0.8125rem', lineHeight: 1.7 }}>
                <li>Всі майбутні заняття групи будуть перенесені на новий день/час</li>
                <li>Минулі та вже проведені заняття залишаться без змін</li>
                <li>Назва групи автоматично оновиться</li>
              </ul>
              {rescheduleError && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#dc2626', padding: '0.625rem', backgroundColor: '#fef2f2', borderRadius: '0.375rem' }}>
                  {rescheduleError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRescheduleModal(false)} disabled={rescheduling}>
                Скасувати
              </button>
              <button
                className="btn"
                onClick={handleRescheduleConfirm}
                disabled={rescheduling || !rescheduleForm.newWeeklyDay || !rescheduleForm.newStartTime || !rescheduleForm.newDurationMinutes}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  backgroundColor: '#0369a1', color: 'white', border: 'none',
                  padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
                  fontWeight: 500, cursor: rescheduling ? 'default' : 'pointer',
                  opacity: rescheduling ? 0.7 : 1,
                }}
              >
                {rescheduling && (
                  <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                )}
                Перенести групу
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
