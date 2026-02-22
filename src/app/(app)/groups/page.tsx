'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Portal from '@/components/Portal';
import { useGroupModals } from '@/components/GroupModalsContext';
import { uk } from '@/i18n/uk';
import PageLoading from '@/components/PageLoading';

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
  
  // Status change
  const [changingStatus, setChangingStatus] = useState<number | null>(null);

  // New Group Modal state
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupCourseId, setNewGroupCourseId] = useState('');
  const [newGroupTeacherId, setNewGroupTeacherId] = useState('');
  const [newGroupWeeklyDay, setNewGroupWeeklyDay] = useState('');
  const [newGroupStartTime, setNewGroupStartTime] = useState('');
  const [newGroupStatus, setNewGroupStatus] = useState('active');
  const [newGroupNote, setNewGroupNote] = useState('');
  const [newGroupPhotosFolderUrl, setNewGroupPhotosFolderUrl] = useState('');
  const [newGroupStartDate, setNewGroupStartDate] = useState('');
  const [newGroupSaving, setNewGroupSaving] = useState(false);
  const [newGroupError, setNewGroupError] = useState<string | null>(null);
  const [newGroupTitlePreview, setNewGroupTitlePreview] = useState('');

  // Edit Group Modal state
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [editForm, setEditForm] = useState({
    course_id: '',
    teacher_id: '',
    weekly_day: '',
    start_time: '',
    duration_minutes: 60,
    monthly_price: 0,
    status: 'active' as 'active' | 'graduate' | 'inactive',
    note: '',
    photos_folder_url: '',
    start_date: '',
  });
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
          const usersRes = await fetch('/api/users');
          const usersData = await usersRes.json();
          setTeachers((usersData.users || []).filter((u: User) => u.role === 'teacher'));
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

  // Update new group title preview when form changes
  useEffect(() => {
    if (newGroupCourseId && newGroupWeeklyDay && newGroupStartTime) {
      const course = courses.find(c => c.id === parseInt(newGroupCourseId));
      const dayShort = uk.daysShort[parseInt(newGroupWeeklyDay) as keyof typeof uk.daysShort];
      if (course && dayShort) {
        setNewGroupTitlePreview(`${dayShort} ${newGroupStartTime} ${course.title}`);
      }
    } else {
      setNewGroupTitlePreview('');
    }
  }, [newGroupCourseId, newGroupWeeklyDay, newGroupStartTime, courses]);

  // Set default start date when modal opens
  useEffect(() => {
    if (showNewGroupModal && !newGroupStartDate) {
      const today = new Date().toISOString().split('T')[0];
      setNewGroupStartDate(today);
    }
  }, [showNewGroupModal, newGroupStartDate]);

  // Populate edit form when modal opens
  useEffect(() => {
    if (showEditGroupModal && editGroup) {
      setEditForm({
        course_id: String(editGroup.course_id),
        teacher_id: String(editGroup.teacher_id),
        weekly_day: String(editGroup.weekly_day),
        start_time: editGroup.start_time,
        duration_minutes: editGroup.duration_minutes,
        monthly_price: editGroup.monthly_price,
        status: editGroup.status,
        note: editGroup.note || '',
        photos_folder_url: editGroup.photos_folder_url || '',
        start_date: editGroup.start_date || '',
      });
    }
  }, [showEditGroupModal, editGroup]);

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

  const handleStatusChange = async (groupId: number, newStatus: string) => {
    setChangingStatus(groupId);
    try {
      await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      // Refresh groups
      const res = await fetch('/api/groups?includeInactive=true');
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Failed to change status:', error);
    } finally {
      setChangingStatus(null);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewGroupError(null);

    // Validation
    if (!newGroupCourseId) {
      setNewGroupError(uk.validation.selectCourse);
      return;
    }
    if (!newGroupWeeklyDay) {
      setNewGroupError(uk.validation.selectDay);
      return;
    }
    if (!newGroupStartTime) {
      setNewGroupError(uk.validation.selectTime);
      return;
    }
    if (!newGroupTeacherId) {
      setNewGroupError(uk.validation.selectTeacher);
      return;
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(newGroupStartTime)) {
      setNewGroupError(uk.validation.invalidTime);
      return;
    }

    // Validate URL if provided
    if (newGroupPhotosFolderUrl) {
      try {
        new URL(newGroupPhotosFolderUrl);
      } catch {
        setNewGroupError(uk.validation.invalidUrl);
        return;
      }
    }

    setNewGroupSaving(true);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: parseInt(newGroupCourseId),
          teacher_id: parseInt(newGroupTeacherId),
          weekly_day: parseInt(newGroupWeeklyDay),
          start_time: newGroupStartTime,
          status: newGroupStatus,
          note: newGroupNote || null,
          photos_folder_url: newGroupPhotosFolderUrl || null,
          start_date: newGroupStartDate || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Close modal and refresh groups
        setShowNewGroupModal(false);
        resetNewGroupForm();
        
        // Refresh groups
        const groupsRes = await fetch('/api/groups?includeInactive=true');
        const groupsData = await groupsRes.json();
        setGroups(groupsData.groups || []);
        
        // Navigate to new group
        router.push(`/groups/${data.id}`);
      } else {
        setNewGroupError(data.error || uk.toasts.error);
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      setNewGroupError(uk.toasts.error);
    } finally {
      setNewGroupSaving(false);
    }
  };

  const resetNewGroupForm = () => {
    setNewGroupCourseId('');
    setNewGroupTeacherId('');
    setNewGroupWeeklyDay('');
    setNewGroupStartTime('');
    setNewGroupStatus('active');
    setNewGroupNote('');
    setNewGroupPhotosFolderUrl('');
    setNewGroupStartDate('');
    setNewGroupError(null);
    setNewGroupTitlePreview('');
  };

  const handleCloseNewGroupModal = () => {
    setShowNewGroupModal(false);
    resetNewGroupForm();
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

  // Edit group handlers
  const handleEditClick = (group: Group) => {
    setEditGroup(group);
    setShowEditGroupModal(true);
    setOpenDropdownId(null);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroup) return;
    
    // Validate required fields
    if (!editForm.course_id || !editForm.teacher_id) {
      alert('Будь ласка, оберіть курс та викладача');
      return;
    }
    
    setSavingGroup(true);
    
    try {
      const res = await fetch(`/api/groups/${editGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: parseInt(editForm.course_id),
          teacher_id: parseInt(editForm.teacher_id),
          weekly_day: parseInt(editForm.weekly_day),
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
        // Update group in the list
        setGroups(groups.map(g => g.id === editGroup.id ? data.group : g));
        setShowEditGroupModal(false);
        setEditGroup(null);
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

  const handleCloseEditModal = () => {
    setShowEditGroupModal(false);
    setEditGroup(null);
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
                      {user.role === 'admin' && changingStatus !== group.id ? (
                        <select
                          value={group.status}
                          onChange={(e) => handleStatusChange(group.id, e.target.value)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            borderRadius: '0.375rem',
                            border: `2px solid ${
                              group.status === 'active' ? '#10b981' :
                              group.status === 'graduate' ? '#3b82f6' :
                              '#6b7280'
                            }`,
                            backgroundColor: 'white',
                            cursor: 'pointer',
                            fontWeight: 500,
                            color: group.status === 'active' ? '#065f46' :
                                   group.status === 'graduate' ? '#1e40af' :
                                   '#374151',
                          }}
                        >
                          <option value="active">{uk.groupStatus.active}</option>
                          <option value="graduate">{uk.groupStatus.graduate}</option>
                          <option value="inactive">{uk.groupStatus.inactive}</option>
                        </select>
                      ) : (
                        <span className={`badge ${getStatusBadgeClass(group.status)}`}>
                          {changingStatus === group.id ? '...' : getStatusLabel(group.status)}
                        </span>
                      )}
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditClick(group);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    width: '100%',
                                    padding: '0.625rem 0.75rem',
                                    color: '#374151',
                                    textDecoration: 'none',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    borderRadius: '0.5rem',
                                    transition: 'all 0.15s',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#1f2937'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#374151'; }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280' }}>
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                  Редагувати групу
                                </button>
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
      {showEditGroupModal && editGroup && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Редагувати групу</h2>
              <button className="modal-close" onClick={handleCloseEditModal}>×</button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body">
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Курс *</label>
                  <select 
                    className="form-select"
                    value={editForm.course_id}
                    onChange={(e) => setEditForm({...editForm, course_id: e.target.value})}
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
                      {[1,2,3,4,5,6,7].map(day => (
                        <option key={day} value={day}>{uk.days[day as keyof typeof uk.days]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Час початку</label>
                    <input 
                      type="time" 
                      className="form-input"
                      value={editForm.start_time || ''}
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
                      onChange={(e) => setEditForm({...editForm, status: e.target.value as 'active' | 'graduate' | 'inactive'})}
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
                  onClick={handleCloseEditModal}
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

      {/* New Group Modal */}
      {showNewGroupModal && (
        <div className="modal-overlay" onClick={handleCloseNewGroupModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh' }}>
            <div className="modal-header" style={{ 
              padding: '1.25rem 1.5rem', 
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f9fafb',
              borderRadius: '12px 12px 0 0'
            }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: '1.25rem', 
                fontWeight: '600',
                color: '#111827'
              }}>
                {uk.modals.newGroup}
              </h2>
              <button 
                className="modal-close" 
                onClick={handleCloseNewGroupModal}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  color: '#6b7280',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="modal-body" style={{ 
                padding: '1.5rem', 
                overflowY: 'auto',
                maxHeight: 'calc(90vh - 180px)'
              }}>
                {newGroupError && (
                  <div style={{ 
                    padding: '0.875rem 1rem', 
                    marginBottom: '1.25rem', 
                    backgroundColor: '#fef2f2', 
                    color: '#dc2626', 
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    fontSize: '0.875rem'
                  }}>
                    {newGroupError}
                  </div>
                )}

                {/* Title Preview */}
                {newGroupTitlePreview && (
                  <div style={{ 
                    padding: '1rem', 
                    marginBottom: '1.5rem', 
                    backgroundColor: '#eff6ff', 
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe'
                  }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#1d4ed8', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                      {uk.forms.groupTitle}
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.1rem', fontWeight: '600', color: '#1e40af' }}>
                      {newGroupTitlePreview}
                    </p>
                  </div>
                )}

                {/* Course Selection */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '500', 
                    color: '#374151',
                    fontSize: '0.9rem'
                  }}>
                    {uk.forms.course} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    className="form-input"
                    value={newGroupCourseId}
                    onChange={(e) => setNewGroupCourseId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      backgroundColor: '#fff',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
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
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '1rem', 
                  marginBottom: '1.25rem' 
                }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      fontSize: '0.9rem'
                    }}>
                      {uk.forms.dayOfWeek} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={newGroupWeeklyDay}
                      onChange={(e) => setNewGroupWeeklyDay(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        backgroundColor: '#fff'
                      }}
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
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      fontSize: '0.9rem'
                    }}>
                      {uk.forms.startTime} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="time"
                      className="form-input"
                      value={newGroupStartTime}
                      onChange={(e) => setNewGroupStartTime(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        backgroundColor: '#fff'
                      }}
                    />
                  </div>
                </div>

                {/* Teacher and Status */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '1rem', 
                  marginBottom: '1.25rem' 
                }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      fontSize: '0.9rem'
                    }}>
                      {uk.forms.teacher} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={newGroupTeacherId}
                      onChange={(e) => setNewGroupTeacherId(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        backgroundColor: '#fff'
                      }}
                    >
                      <option value="">{uk.forms.selectTeacher}</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      fontSize: '0.9rem'
                    }}>
                      {uk.common.status} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={newGroupStatus}
                      onChange={(e) => setNewGroupStatus(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        backgroundColor: '#fff'
                      }}
                    >
                      <option value="active">{uk.groupStatus.active}</option>
                      <option value="graduate">{uk.groupStatus.graduate}</option>
                      <option value="inactive">{uk.groupStatus.inactive}</option>
                    </select>
                  </div>
                </div>

                {/* Start Date */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '500', 
                    color: '#374151',
                    fontSize: '0.9rem'
                  }}>
                    {uk.forms.startDate}
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={newGroupStartDate}
                    onChange={(e) => setNewGroupStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      backgroundColor: '#fff'
                    }}
                  />
                </div>

                {/* Note */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '500', 
                    color: '#374151',
                    fontSize: '0.9rem'
                  }}>
                    {uk.forms.note}
                  </label>
                  <textarea
                    className="form-input"
                    value={newGroupNote}
                    onChange={(e) => setNewGroupNote(e.target.value)}
                    rows={2}
                    placeholder={uk.common.note}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      backgroundColor: '#fff',
                      resize: 'vertical',
                      minHeight: '60px'
                    }}
                  />
                </div>

                {/* Photos Folder URL */}
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '500', 
                    color: '#374151',
                    fontSize: '0.9rem'
                  }}>
                    {uk.forms.photosFolderUrl}
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    value={newGroupPhotosFolderUrl}
                    onChange={(e) => setNewGroupPhotosFolderUrl(e.target.value)}
                    placeholder={uk.forms.photosFolderPlaceholder}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      backgroundColor: '#fff'
                    }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ 
                padding: '1rem 1.5rem', 
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0 0 12px 12px'
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseNewGroupModal}
                  disabled={newGroupSaving}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: '500',
                    fontSize: '0.9rem'
                  }}
                >
                  {uk.actions.cancel}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={newGroupSaving}
                  style={{
                    padding: '0.625rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: '500',
                    fontSize: '0.9rem',
                    backgroundColor: '#2563eb'
                  }}
                >
                  {newGroupSaving ? uk.common.saving : uk.actions.create}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
