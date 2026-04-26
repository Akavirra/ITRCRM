'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGroupModals } from '@/components/GroupModalsContext';
import { useStudentModals } from '@/components/StudentModalsContext';
import { User, useUser } from '@/components/UserContext';
import Portal from '@/components/Portal';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import type { StudentsFilterBootstrap } from '@/lib/students-page';
import PageLoading from '@/components/PageLoading';
import CreateGroupModal from '@/components/CreateGroupModal';
import CreateStudentModal from '@/components/CreateStudentModal';

interface StudentGroup {
  id: number;
  title: string;
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
    parent_name: string | null;
    parent_phone: string | null;
    join_date: string;
    student_group_id: number;
    photo: string | null;
  }>;
}

interface Student {
  id: number;
  public_id: string;
  full_name: string;
  email: string | null;
  parent_name: string | null;
  notes: string | null;
  birth_date: string | null;
  photo: string | null;
  school: string | null;
  discount: number | null;
  parent_relation: string | null;
  study_status: 'studying' | 'not_studying';
  groups: StudentGroup[];
  parent_phone?: string | null;
  parent2_name?: string | null;
  parent2_phone?: string | null;
  parent2_relation?: string | null;
  interested_courses?: string | null;
  source?: string | null;
  groups_count?: number;
  is_active?: boolean;
  created_at?: string;
}

interface StudentsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const RELATION_OPTIONS = [
  { value: 'mother', label: t('forms.relationMother') },
  { value: 'father', label: t('forms.relationFather') },
  { value: 'grandmother', label: t('forms.relationGrandmother') },
  { value: 'grandfather', label: t('forms.relationGrandfather') },
  { value: 'other', label: t('forms.relationOther') },
];

// Function to translate relation from English to Ukrainian
function translateRelation(relation: string | null): string {
  if (!relation) return '';
  const relationMap: Record<string, string> = {
    'mother': 'Мама',
    'father': 'Тато',
    'grandmother': 'Бабуся',
    'grandfather': 'Дідусь',
    'other': 'Інше',
  };
  return relationMap[relation.toLowerCase()] || relation;
}

const SOURCE_OPTIONS = [
  { value: 'social', label: t('forms.sourceSocial') },
  { value: 'friends', label: t('forms.sourceFriends') },
  { value: 'search', label: t('forms.sourceSearch') },
  { value: 'other', label: t('forms.sourceOther') },
];

interface Course {
  id: number;
  title: string;
  public_id: string;
}

function formatPhoneNumber(value: string): string {
  // Allow user to clear the field completely
  if (value === '') {
    return '';
  }
  
  // Remove all non-digit characters
  let digits = value.replace(/\D/g, '');
  
  // If no digits, return empty
  if (digits.length === 0) {
    return '';
  }
  
  // Take only last 9 digits (without country code)
  const phoneDigits = digits.slice(-9);
  
  return phoneDigits;
}

function getPrimaryContactPhone(student: Pick<Student, 'parent_phone'>): string | null {
  return student.parent_phone || null;
}

function formatStudentListName(fullName: string, surnameFirst: boolean): string {
  const normalized = fullName.trim().replace(/\s+/g, ' ');
  if (!surnameFirst || !normalized) return normalized;

  const parts = normalized.split(' ');
  if (parts.length < 2) return normalized;

  const surname = parts[parts.length - 1];
  const givenNames = parts.slice(0, -1).join(' ');
  return `${surname} ${givenNames}`;
}

// Calculate age from birth date
function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age >= 0 ? age : null;
}

// Format age with correct Ukrainian endings
function formatAge(birthDate: string | null): string {
  const age = calculateAge(birthDate);
  if (age === null) return '-';
  
  // Правильні закінчення для української мови
  if (age % 10 === 1 && age % 100 !== 11) {
    return `${age} рік`;
  } else if ([2, 3, 4].includes(age % 10) && ![12, 13, 14].includes(age % 100)) {
    return `${age} роки`;
  } else {
    return `${age} років`;
  }
}

// Get first letter of name for avatar
function getFirstLetter(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function getDayName(day: number): string {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  return days[day - 1] || '';
}

function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes}`;
}

export default function StudentsPageClient({ initialFilters }: { initialFilters: StudentsFilterBootstrap }) {
  const STUDENTS_PAGE_SIZE = 24;
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed');
  const [showSurnameFirst, setShowSurnameFirst] = useState(true);
  const { user } = useUser();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<StudentsPagination>({
    page: 1,
    limit: STUDENTS_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [showSharedCreateModal, setShowSharedCreateModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const requestAbortRef = useRef<AbortController | null>(null);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [studentGroupsWarning, setStudentGroupsWarning] = useState<{id: number; title: string; course_title: string}[]>([]);
  
  // Group modals from context
  const { openGroupModal, closeGroupModal, isModalOpen } = useGroupModals();
  // Student modals from context
  const { openStudentModal } = useStudentModals();
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [courses, setCourses] = useState<Course[]>(initialFilters.courses);
  
  // Groups for filtering
  const [groups, setGroups] = useState<{id: number; title: string; course_id: number; course_title: string}[]>(initialFilters.groups);
  
  // Filter states
  const [courseFilter, setCourseFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [selectedAges, setSelectedAges] = useState<number[]>([]);
  const [allAges, setAllAges] = useState<number[]>(initialFilters.ages);

  // Note editing state
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  
  // Note expansion state - track which notes are expanded
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  // Bulk selection state
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  const toggleStudentSelection = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedStudents(new Set());
  const handleSelectAll = () => {
    if (selectedStudents.size === students.length && students.length > 0) {
      clearSelection();
    } else {
      setSelectedStudents(new Set(students.map(s => s.id)));
    }
  };

  const selectedStudentsData = students
    .filter(s => selectedStudents.has(s.id))
    .map(s => ({
      id: s.id,
      full_name: s.full_name,
      public_id: s.public_id
    }));

  const openBulkCreateGroup = () => {
    setShowCreateGroupModal(true);
  };
  
  // Sorting state
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const loadStudents = useCallback(async () => {
    const params = new URLSearchParams({
      withGroups: 'true',
      page: String(currentPage),
      limit: String(STUDENTS_PAGE_SIZE),
      sortBy,
      sortOrder,
    });

    if (sortBy === 'name' && showSurnameFirst) {
      params.set('surnameFirst', 'true');
    }

    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (courseFilter) params.set('courseId', courseFilter);
    if (groupFilter) params.set('groupId', groupFilter);
    if (selectedAges.length > 0) params.set('ages', selectedAges.join(','));

    const queryString = params.toString();

    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;

    const response = await fetch(`/api/students?${queryString}`, { signal: controller.signal });
    const result = await response.json();
    setStudents(result.students || []);
    setPagination(result.pagination || {
      page: currentPage,
      limit: STUDENTS_PAGE_SIZE,
      total: (result.students || []).length,
      totalPages: 1,
    });
  }, [courseFilter, currentPage, debouncedSearch, groupFilter, selectedAges, showSurnameFirst, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
    };
  }, []);
  
  const toggleNoteExpand = (studentId: number) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    // Load saved view mode
    try {
      const savedViewMode = localStorage.getItem('studentsViewMode');
      if (savedViewMode === 'compact' || savedViewMode === 'detailed') {
        setViewMode(savedViewMode);
      }

      const savedNameOrder = localStorage.getItem('studentsSurnameFirst');
      if (savedNameOrder === 'false') {
        setShowSurnameFirst(false);
      } else if (savedNameOrder === 'true') {
        setShowSurnameFirst(true);
      }
    } catch (e) {
      console.warn('LocalStorage blocked or unavailable:', e);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (hasLoadedOnceRef.current) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        await loadStudents();
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Failed to fetch students:', error);
        }
      } finally {
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    fetchData();
  }, [loadStudents]);

  useEffect(() => {
    if (safeSearchParams.get('create') === '1') {
      setShowSharedCreateModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    setSelectedStudents((prev) => new Set(Array.from(prev).filter((id) => students.some((student) => student.id === id))));
  }, [students]);

  // Auto-hide toast after 2 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleToggleSurnameFirst = () => {
    setShowSurnameFirst((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('studentsSurnameFirst', String(next));
      } catch (e) {
        console.warn('LocalStorage blocked or unavailable:', e);
      }
      return next;
    });
  };

  const handleSearch = async (query: string) => {
    setSearch(query);
    setCurrentPage(1);
  };

  // Filter handlers
  const handleCourseFilterChange = (courseId: string) => {
    setCourseFilter(courseId);
    setCurrentPage(1);
    // Reset group filter when course changes
    if (courseId) {
      setGroupFilter('');
    }
  };

  const handleGroupFilterChange = (groupId: string) => {
    setGroupFilter(groupId);
    setCurrentPage(1);
  };

  const handleAgeFilterToggle = (age: number) => {
    setCurrentPage(1);
    setSelectedAges(prev => 
      prev.includes(age) 
        ? prev.filter(a => a !== age)
        : [...prev, age]
    );
  };

  const handleClearAgeFilter = () => {
    setSelectedAges([]);
    setCurrentPage(1);
  };

  // Copy phone to clipboard
  const copyPhone = async (phone: string | null, type: 'main' | 'parent') => {
    if (!phone) return;
    
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedField(`${type}-${phone}`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  const handleCreate = () => {
    setEditingStudent(null);
    setShowSharedCreateModal(true);
  };

  const handleEdit = async (student: Student) => {
    try {
      const res = await fetch(`/api/students/${student.id}`);
      if (!res.ok) {
        throw new Error('Failed to load full student details');
      }

      const data = await res.json();
      const fullStudent: Student = data.student || student;

      setEditingStudent(fullStudent);
      setShowSharedCreateModal(true);
    } catch (error) {
      console.error('Failed to load student for edit:', error);
      setToast({ message: 'Не вдалося завантажити повні дані учня', type: 'error' });
    }
  };

  // Delete handlers
  const handleDeleteClick = async (student: Student) => {
    setStudentToDelete(student);
    setDeletePassword('');
    setDeleteError('');
    setStudentGroupsWarning([]);
    setOpenDropdownId(null);
    
    // First, check if student has active groups
    try {
      const res = await fetch(`/api/students/${student.id}?permanent=true`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      
      if (res.status === 409 && data.warning) {
        // Student has groups - show warning
        setStudentGroupsWarning(data.groups || []);
      } else if (data.canDelete) {
        // Student has no groups - clear warning
        setStudentGroupsWarning([]);
      }
      
      setShowDeleteModal(true);
    } catch (error) {
      console.error('Failed to check student groups:', error);
      setShowDeleteModal(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return;
    
    setDeleting(true);
    setDeleteError('');
    
    try {
      const res = await fetch(`/api/students/${studentToDelete.id}?permanent=true&force=true`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setShowDeleteModal(false);
        setStudentToDelete(null);
        await loadStudents();
      } else if (res.status === 401) {
        setDeleteError('Невірний пароль');
      } else {
        setDeleteError(data.error || 'Сталася помилка. Спробуйте ще раз.');
      }
    } catch (error) {
      console.error('Failed to delete student:', error);
      setDeleteError('Сталася помилка. Спробуйте ще раз.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setStudentToDelete(null);
    setStudentGroupsWarning([]);
    setDeletePassword('');
    setDeleteError('');
  };

  // Open group modal - uses global context to prevent duplicates
  const handleOpenGroupModal = (group: StudentGroup) => {
    openGroupModal(group.id, group.title);
  };

  // Close group modal - uses global context
  const handleCloseGroupModal = (groupId: number) => {
    closeGroupModal(groupId);
  };

  // Note editing functions
  const startEditingNote = (student: Student) => {
    setEditingNoteId(student.id);
    setNoteText(student.notes || '');
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setNoteText('');
  };

  const saveNote = async (studentId: number) => {
    setSavingNote(true);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteText }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Помилка збереження нотатки: ${errorData.error || res.statusText}`);
        setSavingNote(false);
        return;
      }
      
      // Update local state
      setStudents(students.map(s => 
        s.id === studentId ? { ...s, notes: noteText || null } : s
      ));
      
      setEditingNoteId(null);
      setNoteText('');
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Помилка мережі. Спробуйте ще раз.');
    } finally {
      setSavingNote(false);
    }
  };

  const clearNote = async (studentId: number) => {
    if (!confirm('Очистити нотатку?')) return;
    
    setSavingNote(true);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '' }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Помилка очищення нотатки: ${errorData.error || res.statusText}`);
        setSavingNote(false);
        return;
      }
      
      // Update local state
      setStudents(students.map(s => 
        s.id === studentId ? { ...s, notes: null } : s
      ));
      
      setEditingNoteId(null);
      setNoteText('');
    } catch (error) {
      console.error('Failed to clear note:', error);
      alert('Помилка мережі. Спробуйте ще раз.');
    } finally {
      setSavingNote(false);
    }
  };

  // Handle click outside to close student dropdown
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
    return (
      <>
        <PageLoading />
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search */}
          <input
            type="text"
            className="form-input"
            placeholder={`${t('actions.search')} ${t('nav.students').toLowerCase()}...`}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: '200px', maxWidth: '100%', minWidth: '170px', padding: '0.5rem 0.875rem', fontSize: '0.875rem', flex: '1 1 200px' }}
          />

          {/* Course filter */}
          <select
            className="form-input"
            value={courseFilter}
            onChange={(e) => handleCourseFilterChange(e.target.value)}
            style={{ width: '160px', maxWidth: '100%', minWidth: '140px', padding: '0.5rem 0.875rem', fontSize: '0.875rem', flex: '0 1 160px' }}
          >
            <option value="">Курс</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>

          {/* Group filter */}
          <select
            className="form-input"
            value={groupFilter}
            onChange={(e) => handleGroupFilterChange(e.target.value)}
            style={{ width: '180px', maxWidth: '100%', minWidth: '150px', padding: '0.5rem 0.875rem', fontSize: '0.875rem', flex: '0 1 180px' }}
          >
            <option value="">Група</option>
            {groups
              .filter(g => !courseFilter || g.course_id === parseInt(courseFilter))
              .map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}
                </option>
              ))}
          </select>

          {/* Age filter - interactive multi-select chips */}
          {allAges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem', flex: '1 1 260px', minWidth: '220px' }}>
              {allAges.map((age) => (
                <button
                  key={age}
                  onClick={() => handleAgeFilterToggle(age)}
                  style={{
                    padding: '0.5rem 0.625rem',
                    fontSize: '0.8125rem',
                    fontWeight: selectedAges.includes(age) ? '600' : '400',
                    borderRadius: '0.375rem',
                    border: selectedAges.includes(age) ? '1px solid #374151' : '1px solid #e5e7eb',
                    backgroundColor: selectedAges.includes(age) ? '#374151' : 'white',
                    color: selectedAges.includes(age) ? 'white' : '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {age}
                </button>
              ))}
              {selectedAges.length > 0 && (
                <button
                  onClick={handleClearAgeFilter}
                  style={{
                    padding: '0.5rem 0.625rem',
                    fontSize: '0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #ef4444',
                    backgroundColor: 'white',
                    color: '#ef4444',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  title="Очистити фільтр віку"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Right side: count and button */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem 0.75rem', marginLeft: 'auto', flex: '1 1 420px', minWidth: 0 }}>
            {isRefreshing && (
              <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 500, whiteSpace: 'nowrap' }}>
                Оновлення...
              </span>
            )}
            <span style={{ fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
              Показано {students.length} з {pagination.total} {pagination.total === 1 ? 'учня' : pagination.total > 1 && pagination.total < 5 ? 'учнів' : 'учнів'}
            </span>
            
            {/* Sort buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280', marginRight: '0.25rem' }}>Сортування:</span>
              <button
                onClick={() => {
                  setCurrentPage(1);
                  if (sortBy === 'name') {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('name');
                    setSortOrder('asc');
                  }
                }}
                style={{
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: sortBy === 'name' ? '600' : '400',
                  borderRadius: '0.375rem',
                  border: sortBy === 'name' ? '1px solid #374151' : '1px solid #e5e7eb',
                  backgroundColor: sortBy === 'name' ? '#374151' : 'white',
                  color: sortBy === 'name' ? 'white' : '#374151',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                title="Сортувати за іменем"
              >
                А-Я
                {sortBy === 'name' && (
                  <span style={{ fontSize: '0.625rem' }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                )}
              </button>
              <button
                onClick={() => {
                  setCurrentPage(1);
                  if (sortBy === 'created_at') {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('created_at');
                    setSortOrder('desc');
                  }
                }}
                style={{
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: sortBy === 'created_at' ? '600' : '400',
                  borderRadius: '0.375rem',
                  border: sortBy === 'created_at' ? '1px solid #374151' : '1px solid #e5e7eb',
                  backgroundColor: sortBy === 'created_at' ? '#374151' : 'white',
                  color: sortBy === 'created_at' ? 'white' : '#374151',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                title="Сортувати за датою створення"
              >
                {sortOrder === 'asc' ? 'Найстарі' : 'Найнові'}
                {sortBy === 'created_at' && (
                  <span style={{ fontSize: '0.625rem' }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                )}
              </button>
            </div>
            
            <button
              type="button"
              onClick={handleToggleSurnameFirst}
              aria-pressed={showSurnameFirst}
              title={showSurnameFirst ? 'Показувати імʼя першим' : 'Показувати прізвище першим'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.3125rem 0.375rem 0.3125rem 0.75rem',
                minHeight: '2rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                borderRadius: '9999px',
                border: `1px solid ${showSurnameFirst ? '#c7d2fe' : '#e2e8f0'}`,
                backgroundColor: showSurnameFirst ? '#eef2ff' : '#ffffff',
                color: showSurnameFirst ? '#3730a3' : '#475569',
                cursor: 'pointer',
                transition: 'background-color 160ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1)), border-color 160ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1)), color 160ms ease, transform 120ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = showSurnameFirst ? '#a5b4fc' : '#cbd5e1';
                e.currentTarget.style.backgroundColor = showSurnameFirst ? '#e0e7ff' : '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = showSurnameFirst ? '#c7d2fe' : '#e2e8f0';
                e.currentTarget.style.backgroundColor = showSurnameFirst ? '#eef2ff' : '#ffffff';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Прізвище спочатку
              </span>
              <span
                aria-hidden="true"
                style={{
                  position: 'relative',
                  width: '2.125rem',
                  height: '1.25rem',
                  borderRadius: '9999px',
                  backgroundColor: showSurnameFirst ? '#6366f1' : '#cbd5e1',
                  transition: 'background-color 160ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: showSurnameFirst ? 'calc(100% - 1rem - 2px)' : '2px',
                    width: '1rem',
                    height: '1rem',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.2)',
                    transition: 'left 180ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))',
                  }}
                />
              </span>
            </button>

            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.5rem', padding: '0.25rem', alignItems: 'center', gap: '0.125rem', flexShrink: 0 }}>
              <button
                onClick={() => { setViewMode('detailed'); localStorage.setItem('studentsViewMode', 'detailed'); }}
                style={{
                  padding: '0', width: '32px', height: '32px', borderRadius: '0.375rem', border: 'none', cursor: 'pointer',
                  backgroundColor: viewMode === 'detailed' ? 'white' : 'transparent',
                  color: viewMode === 'detailed' ? '#4f46e5' : '#64748b',
                  boxShadow: viewMode === 'detailed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="Детальний вигляд"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              </button>
              <button
                onClick={() => { setViewMode('compact'); localStorage.setItem('studentsViewMode', 'compact'); }}
                style={{
                  padding: '0', width: '32px', height: '32px', borderRadius: '0.375rem', border: 'none', cursor: 'pointer',
                  backgroundColor: viewMode === 'compact' ? 'white' : 'transparent',
                  color: viewMode === 'compact' ? '#4f46e5' : '#64748b',
                  boxShadow: viewMode === 'compact' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="Мінімалістичний вигляд"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              </button>
            </div>
            
            {user.role === 'admin' && (
              <button className="btn btn-primary" onClick={handleCreate} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                + {t('modals.newStudent')}
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '1rem 0.75rem' }}>
          {students.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'detailed' 
                ? 'repeat(auto-fill, minmax(360px, 1fr))' 
                : 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: viewMode === 'detailed' ? '1.25rem' : '0.875rem',
              alignItems: 'start',
              opacity: isRefreshing ? 0.72 : 1,
              transition: 'opacity 0.15s ease',
            }}>
              {students.map((student) => {
                const age = calculateAge(student.birth_date);
                const displayName = formatStudentListName(student.full_name, showSurnameFirst);
                const firstLetter = getFirstLetter(displayName);
                
                // Truncate notes for display
                const MAX_NOTE_LENGTH = 80;
                const isNoteTruncated = student.notes && student.notes.length > MAX_NOTE_LENGTH;
                const displayNote = (isNoteTruncated && !expandedNotes.has(student.id))
                  ? student.notes!.substring(0, MAX_NOTE_LENGTH) + '...'
                  : student.notes;
                
                if (viewMode === 'compact') {
                  return (
                    <div
                      key={student.id}
                      className="student-card-hover"
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '0.75rem',
                        border: '1px solid #f0f0f5',
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        // Avoid triggering navigation if clicking on phone/copy button
                        if ((e.target as HTMLElement).closest('.copy-phone-btn')) return;
                        router.push(`/students/${student.id}`);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                        e.currentTarget.style.borderColor = '#e0e7ff';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                        e.currentTarget.style.borderColor = '#f0f0f5';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Bulk Selection Checkbox Area */}
                      <div 
                        style={{ display: 'flex', alignItems: 'center', paddingRight: '0.25rem' }}
                        onClick={(e) => toggleStudentSelection(student.id, e)}
                      >
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '4px',
                          border: `2px solid ${selectedStudents.has(student.id) ? '#4f46e5' : '#d1d5db'}`,
                          backgroundColor: selectedStudents.has(student.id) ? '#4f46e5' : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s'
                        }}>
                          {selectedStudents.has(student.id) && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          )}
                        </div>
                      </div>

                      {/* Avatar */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            backgroundColor: student.photo ? 'transparent' : 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1.5px solid #e0e7ff',
                          }}
                        >
                          {student.photo ? (
                            <img src={student.photo} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#6366f1' }}>{firstLetter}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Info String */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <span style={{
                            fontFamily: 'monospace', fontSize: '0.625rem', color: '#64748b', 
                            backgroundColor: '#f8fafc', padding: '0.125rem 0.25rem', borderRadius: '0.25rem'
                          }}>
                            {student.public_id}
                          </span>
                          <span style={{
                            fontWeight: 600, fontSize: '0.875rem', color: '#1e293b',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {displayName}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {age !== null && (
                            <span style={{ fontSize: '0.6875rem', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.125rem', fontWeight: 500 }}>
                              {formatAge(student.birth_date)}
                            </span>
                          )}
                          
                          {getPrimaryContactPhone(student) && age !== null && <span style={{ color: '#cbd5e1', fontSize: '0.6875rem' }}>•</span>}
                          
                          {getPrimaryContactPhone(student) && (
                            <span
                              className="copy-phone-btn"
                              onClick={(e) => { e.stopPropagation(); copyPhone(getPrimaryContactPhone(student), 'main'); }}
                              style={{ 
                                fontSize: '0.75rem', color: copiedField === `main-${getPrimaryContactPhone(student)}` ? '#10b981' : '#64748b',
                                display: 'flex', alignItems: 'center', gap: '0.1875rem', cursor: 'pointer', transition: 'color 0.15s',
                                fontWeight: 500, fontVariantNumeric: 'tabular-nums'
                              }}
                              onMouseEnter={(e) => { if (copiedField !== `main-${getPrimaryContactPhone(student)}`) e.currentTarget.style.color = '#4f46e5'; }}
                              onMouseLeave={(e) => { if (copiedField !== `main-${getPrimaryContactPhone(student)}`) e.currentTarget.style.color = '#64748b'; }}
                            >
                              {copiedField === `main-${getPrimaryContactPhone(student)}` ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              ) : (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                              )}
                              {getPrimaryContactPhone(student)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={student.id}
                    className="student-card-hover"
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '1rem',
                      border: '1px solid #f0f0f5',
                      padding: '0',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.08), 0 2px 10px rgba(0,0,0,0.04)';
                      e.currentTarget.style.borderColor = '#e0e7ff';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)';
                      e.currentTarget.style.borderColor = '#f0f0f5';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Top section: Header bar with ID, status, actions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.625rem 1rem',
                      borderBottom: '1px solid #f5f5fa',
                      backgroundColor: '#fafbff',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div 
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '20px', height: '20px', borderRadius: '4px', cursor: 'pointer',
                            border: `2px solid ${selectedStudents.has(student.id) ? '#4f46e5' : '#d1d5db'}`,
                            backgroundColor: selectedStudents.has(student.id) ? '#4f46e5' : 'white',
                            transition: 'all 0.15s'
                          }}
                          onClick={(e) => toggleStudentSelection(student.id, e)}
                        >
                          {selectedStudents.has(student.id) && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          )}
                        </div>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '0.6875rem',
                          color: '#94a3b8',
                          backgroundColor: '#f1f5f9',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.375rem',
                          letterSpacing: '0.02em',
                        }}>
                          {student.public_id}
                        </span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          letterSpacing: '0.01em',
                          backgroundColor: student.study_status === 'studying' ? '#ecfdf5' : '#f9fafb',
                          color: student.study_status === 'studying' ? '#059669' : '#9ca3af',
                          border: `1px solid ${student.study_status === 'studying' ? '#a7f3d0' : '#e5e7eb'}`,
                        }}>
                          <span style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: student.study_status === 'studying' ? '#10b981' : '#d1d5db',
                          }} />
                          {student.study_status === 'studying' ? t('status.studying') : t('status.notStudying')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
                        {/* Open in modal button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudentModal(student.id, student.full_name);
                          }}
                          style={{
                            padding: '0.375rem',
                            borderRadius: '0.5rem',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eef2ff'; e.currentTarget.style.color = '#6366f1'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                          title="Відкрити в модальному вікні"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </button>
                        {/* Menu - Three dots button (for admins only) */}
                        {user.role === 'admin' && (
                          <div style={{ position: 'relative' }}>
                            <button
                              ref={openDropdownId === student.id ? dropdownButtonRef : undefined}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(openDropdownId === student.id ? null : student.id);
                              }}
                              style={{
                                padding: '0.375rem',
                                borderRadius: '0.5rem',
                                backgroundColor: openDropdownId === student.id ? '#eef2ff' : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                color: openDropdownId === student.id ? '#6366f1' : '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              onMouseEnter={(e) => { if (openDropdownId !== student.id) { e.currentTarget.style.backgroundColor = '#eef2ff'; e.currentTarget.style.color = '#6366f1'; } }}
                              onMouseLeave={(e) => { if (openDropdownId !== student.id) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                              </svg>
                            </button>
                            {openDropdownId === student.id && (
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
                                    href={`/students/${student.id}`}
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
                                      handleEdit(student);
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
                                      handleDeleteClick(student);
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
                      </div>
                    </div>
                    
                    {/* Main content area */}
                    <div style={{ padding: '1.125rem 1.25rem', display: 'flex', gap: '1.125rem', flex: 1 }}>
                      {/* Left Column - Avatar & Age */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                        {/* Round Avatar with Discount Badge */}
                        <div style={{ position: 'relative' }}>
                          <div
                            style={{
                              width: '52px',
                              height: '52px',
                              borderRadius: '50%',
                              overflow: 'hidden',
                              flexShrink: 0,
                              backgroundColor: student.photo ? 'transparent' : 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                              background: student.photo ? 'transparent' : 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '2.5px solid #e0e7ff',
                              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.1)',
                            }}
                          >
                            {student.photo ? (
                              <img
                                src={student.photo.startsWith('data:') ? student.photo : student.photo}
                                alt={displayName}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            ) : (
                              <span style={{
                                fontSize: '1.125rem',
                                fontWeight: 700,
                                color: '#6366f1',
                                letterSpacing: '-0.02em',
                              }}>
                                {firstLetter}
                              </span>
                            )}
                          </div>
                          {/* Discount Badge on Avatar Corner */}
                          {student.discount != null && student.discount > 0 && (
                            <div
                              title={`Знижка на навчання: ${student.discount}%`}
                              style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-10px',
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '9999px',
                                fontSize: '0.625rem',
                                fontWeight: '700',
                                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.35)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.125rem',
                                zIndex: 1,
                                border: '2px solid white',
                                cursor: 'default',
                                lineHeight: 1.2,
                              }}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                <line x1="7" y1="7" x2="7.01" y2="7"></line>
                              </svg>
                              {student.discount}%
                            </div>
                          )}
                        </div>
                        
                        {/* Age */}
                        {age !== null && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.1875rem',
                            padding: '0.1875rem 0.5rem',
                            backgroundColor: '#eef2ff',
                            borderRadius: '9999px',
                            fontSize: '0.6875rem',
                          }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span style={{ fontWeight: 600, color: '#6366f1' }}>
                              {formatAge(student.birth_date)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Right Column - Details */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {/* Name */}
                        <a
                          href={`/students/${student.id}`}
                          style={{
                            fontWeight: 700,
                            fontSize: '0.9375rem',
                            color: '#1e293b',
                            textDecoration: 'none',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                            letterSpacing: '-0.01em',
                            lineHeight: 1.3,
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#6366f1'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#1e293b'; }}
                        >
                          {displayName}
                        </a>
                        
                        {/* Contact Info */}
                        {(getPrimaryContactPhone(student) || student.email) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {getPrimaryContactPhone(student) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                <span
                                  onClick={() => copyPhone(getPrimaryContactPhone(student), 'main')}
                                  style={{
                                    fontSize: '0.8125rem',
                                    color: copiedField === `main-${getPrimaryContactPhone(student)}` ? '#10b981' : '#475569',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3125rem',
                                    transition: 'color 0.15s',
                                    fontWeight: 500,
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                  onMouseEnter={(e) => { if (copiedField !== `main-${getPrimaryContactPhone(student)}`) e.currentTarget.style.color = '#6366f1'; }}
                                  onMouseLeave={(e) => { if (copiedField !== `main-${getPrimaryContactPhone(student)}`) e.currentTarget.style.color = '#475569'; }}
                                  title="Клікніть щоб скопіювати"
                                >
                                  {copiedField === `main-${getPrimaryContactPhone(student)}` ? (
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  ) : (
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                  )}
                                  {getPrimaryContactPhone(student)}
                                </span>
                                {/* Parent info */}
                                {(student.parent_name || student.parent_relation) && (
                                  <span style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 400 }}>
                                    · {student.parent_name && student.parent_relation
                                      ? `${student.parent_name} (${translateRelation(student.parent_relation)})`
                                      : student.parent_name || translateRelation(student.parent_relation)}
                                  </span>
                                )}
                              </div>
                            )}
                            {student.email && (
                              <span
                                onClick={() => {
                                  navigator.clipboard.writeText(student.email || '');
                                  setCopiedField(`email-${student.email}`);
                                  setTimeout(() => setCopiedField(null), 2000);
                                }}
                                style={{
                                  fontSize: '0.8125rem',
                                  color: copiedField === `email-${student.email}` ? '#10b981' : '#475569',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3125rem',
                                  transition: 'color 0.15s',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={(e) => { if (copiedField !== `email-${student.email}`) e.currentTarget.style.color = '#6366f1'; }}
                                onMouseLeave={(e) => { if (copiedField !== `email-${student.email}`) e.currentTarget.style.color = '#475569'; }}
                                title={`${student.email} (клікніть щоб скопіювати)`}
                              >
                                {copiedField === `email-${student.email}` ? (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                  </svg>
                                )}
                                {student.email}
                              </span>
                            )}
                            {/* Show parent info on separate line only if no phone */}
                            {!getPrimaryContactPhone(student) && (student.parent_name || student.parent_relation) && (
                              <span style={{ fontSize: '0.6875rem', color: '#94a3b8', paddingLeft: '1.125rem' }}>
                                {student.parent_name && student.parent_relation
                                  ? `${student.parent_name} (${translateRelation(student.parent_relation)})`
                                  : student.parent_name || translateRelation(student.parent_relation)}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Groups list */}
                        {student.groups && student.groups.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                            {student.groups.map((group) => (
                              <div
                                key={group.id}
                                onClick={() => handleOpenGroupModal(group)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.1875rem 0.5rem',
                                  backgroundColor: '#f0fdf4',
                                  border: '1px solid #bbf7d0',
                                  borderRadius: '9999px',
                                  textDecoration: 'none',
                                  fontSize: '0.6875rem',
                                  color: '#15803d',
                                  fontWeight: 500,
                                  transition: 'all 0.15s',
                                  cursor: 'pointer',
                                  letterSpacing: '0.01em',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                  <circle cx="9" cy="7" r="4" />
                                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                {group.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Note section - bottom */}
                    <div style={{ padding: '0 1.25rem 1rem' }}>
                      {editingNoteId === student.id ? (
                        <div
                          style={{
                            padding: '0.75rem',
                            backgroundColor: '#fffbeb',
                            borderRadius: '0.625rem',
                            border: '1px solid #fde68a',
                          }}
                        >
                          <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Додати нотатку..."
                            style={{
                              width: '100%',
                              minHeight: '56px',
                              padding: '0.5rem',
                              fontSize: '0.8125rem',
                              border: '1px solid #e5e7eb',
                              borderRadius: '0.375rem',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              lineHeight: 1.5,
                              outline: 'none',
                            }}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => saveNote(student.id)}
                              disabled={savingNote}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', borderRadius: '0.375rem' }}
                            >
                              {savingNote ? '...' : 'Зберегти'}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={cancelEditingNote}
                              disabled={savingNote}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', borderRadius: '0.375rem' }}
                            >
                              Скасувати
                            </button>
                          </div>
                        </div>
                      ) : student.notes ? (
                        <div style={{
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#fffbeb',
                          borderRadius: '0.625rem',
                          border: '1px solid #fde68a',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', wordBreak: 'break-word' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '0.1875rem', opacity: 0.7 }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10 9 9 9 8 9" />
                            </svg>
                            <span
                              style={{ fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'break-word', flex: 1, display: expandedNotes.has(student.id) ? 'block' : '-webkit-box', WebkitLineClamp: expandedNotes.has(student.id) ? 999 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                              title={isNoteTruncated ? student.notes : undefined}
                            >
                              {displayNote}
                              {isNoteTruncated && (
                                <span
                                  style={{ color: '#b45309', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                                  onClick={() => toggleNoteExpand(student.id)}
                                >
                                  {expandedNotes.has(student.id) ? ' Згорнути' : ' Читати далі'}
                                </span>
                              )}
                            </span>
                            {user.role === 'admin' && (
                              <div style={{ display: 'flex', gap: '0.125rem', flexShrink: 0, marginLeft: '0.25rem' }}>
                                <button
                                  onClick={() => startEditingNote(student)}
                                  style={{
                                    padding: '0.25rem',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#d97706',
                                    opacity: 0.5,
                                    borderRadius: '0.25rem',
                                    transition: 'opacity 0.15s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                                  title="Редагувати нотатку"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => clearNote(student.id)}
                                  style={{
                                    padding: '0.25rem',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#d97706',
                                    opacity: 0.5,
                                    borderRadius: '0.25rem',
                                    transition: 'opacity 0.15s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                                  title="Очистити нотатку"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : user.role === 'admin' ? (
                        <button
                          onClick={() => startEditingNote(student)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.375rem',
                            padding: '0.5rem',
                            backgroundColor: 'transparent',
                            border: '1px dashed #e2e8f0',
                            borderRadius: '0.625rem',
                            color: '#94a3b8',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            width: '100%',
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#64748b'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#94a3b8'; }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Додати нотатку
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="empty-state-title">{t('emptyStates.noStudents')}</h3>
              <p className="empty-state-text">{t('emptyStates.noStudentsHint')}</p>
              {user.role === 'admin' && (
                <button className="btn btn-primary" onClick={handleCreate}>
                  {t('emptyStates.addStudent')}
                </button>
              )}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div
              style={{
                marginTop: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
                paddingTop: '1rem',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                Сторінка {pagination.page} з {pagination.totalPages}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  style={{
                    padding: '0.5rem 0.875rem',
                    borderRadius: '0.625rem',
                    border: '1px solid #dbe2ea',
                    backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white',
                    color: currentPage <= 1 ? '#94a3b8' : '#0f172a',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                  }}
                >
                  Назад
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  disabled={currentPage >= pagination.totalPages}
                  style={{
                    padding: '0.5rem 0.875rem',
                    borderRadius: '0.625rem',
                    border: '1px solid #dbe2ea',
                    backgroundColor: currentPage >= pagination.totalPages ? '#f8fafc' : 'white',
                    color: currentPage >= pagination.totalPages ? '#94a3b8' : '#0f172a',
                    cursor: currentPage >= pagination.totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                  }}
                >
                  Далі
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateStudentModal
        isOpen={showSharedCreateModal}
        studentToEdit={editingStudent}
        onClose={() => {
          setShowSharedCreateModal(false);
          setEditingStudent(null);
        }}
        onCreated={async () => {
          setShowSharedCreateModal(false);
          setEditingStudent(null);
          await loadStudents();
        }}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && studentToDelete && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Підтвердження видалення</h3>
              <button className="modal-close" onClick={handleDeleteCancel} disabled={deleting}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 1rem 0' }}>
                Ви збираєтеся остаточно видалити учня <strong>{studentToDelete.full_name}</strong>.
              </p>
              
              {/* Warning about groups */}
              {studentGroupsWarning.length > 0 && (
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
                    Учень бере участь у групах
                  </div>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#92400e' }}>
                    При видаленні учень буде автоматично вилучений з наступних груп:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#92400e' }}>
                    {studentGroupsWarning.map(group => (
                      <li key={group.id}>
                        <strong>{group.title}</strong> ({group.course_title})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p style={{ margin: '0 0 1rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                Ця дія незворотня. Всі дані про учня, включаючи відвідування та платежі, будуть видалені.
              </p>
              
              <p style={{ margin: '0 0 1rem 0' }}>
                Щоб підтвердити видалення, введіть пароль адміністратора.
              </p>
              
              <div className="form-group">
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
                  backgroundColor: '#fee2e2',
                  border: '1px solid #ef4444',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  color: '#dc2626',
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
      
      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: toast.type === 'success' ? '#059669' : '#dc2626',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            zIndex: 1000,
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          {toast.message}
        </div>
      )};
      {/* Floating Action Bar for Bulk Selection */}
      <div style={{
        position: 'fixed',
        bottom: selectedStudents.size > 0 ? '2rem' : '-5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#1e293b',
        color: 'white',
        padding: '0.75rem 1.5rem',
        borderRadius: '9999px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            backgroundColor: '#4f46e5',
            color: 'white',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}>
            {selectedStudents.size}
          </div>
          <span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>обрано</span>
        </div>
        
        <div style={{ width: '1px', height: '20px', backgroundColor: '#475569' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={openBulkCreateGroup}
            style={{
              backgroundColor: 'white',
              color: '#0f172a',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              transition: 'backgroundColor 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Сформувати групу
          </button>
          
          <button
            onClick={clearSelection}
            style={{
              backgroundColor: 'transparent',
              color: '#94a3b8',
              border: 'none',
              padding: '0.5rem',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#334155'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
            title="Скасувати вибір"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        initialStudents={selectedStudentsData as any}
        onSuccess={() => {
          setShowCreateGroupModal(false);
          clearSelection();
          setToast({ message: 'Групу успішно створено!', type: 'success' });
          setTimeout(() => setToast(null), 3000);
        }}
      />
    </>
  );
}




