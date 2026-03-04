'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGroupModals } from '@/components/GroupModalsContext';
import { useStudentModals } from '@/components/StudentModalsContext';
import Layout from '@/components/Layout';
import Portal from '@/components/Portal';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import PageLoading from '@/components/PageLoading';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface StudentGroup {
  id: number;
  public_id: string;
  title: string;
  course_title: string;
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

interface Student {
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  notes: string | null;
  birth_date: string | null;
  photo: string | null;
  school: string | null;
  discount: string | null;
  parent_relation: string | null;
  parent2_name: string | null;
  parent2_relation: string | null;
  interested_courses: string | null;
  source: string | null;
  groups_count: number;
  is_active: boolean;
  created_at: string;
  study_status: 'studying' | 'not_studying';
  groups?: StudentGroup[];
}

interface StudentFormData {
  first_name: string;
  last_name: string;
  birth_date: string;
  email: string;
  school: string;
  discount: string;
  photo: string | null;
  photoFile: File | null;
  phone: string;
  parent_name: string;
  parent_relation: string;
  parent_relation_other: string;
  parent_phone: string;
  parent2_name: string;
  parent2_relation: string;
  parent2_relation_other: string;
  notes: string;
  interested_courses: string[];
  source: string;
  source_other: string;
}

interface AutocompleteStudent {
  id: number;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
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

export default function StudentsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState<StudentFormData>({
    first_name: '',
    last_name: '',
    birth_date: '',
    email: '',
    school: '',
    discount: '',
    photo: null,
    photoFile: null,
    phone: '',
    parent_name: '',
    parent_relation: '',
    parent_relation_other: '',
    parent_phone: '',
    parent2_name: '',
    parent2_relation: '',
    parent2_relation_other: '',
    notes: '',
    interested_courses: [],
    source: '',
    source_other: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  
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
  
  // Autocomplete state
  const [nameSuggestions, setNameSuggestions] = useState<AutocompleteStudent[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [nameSearchTimeout, setNameSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Last name autocomplete state
  const [lastNameSuggestions, setLastNameSuggestions] = useState<AutocompleteStudent[]>([]);
  const [showLastNameSuggestions, setShowLastNameSuggestions] = useState(false);
  const [lastNameSearchTimeout, setLastNameSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // School autocomplete state
  const [schoolSuggestions, setSchoolSuggestions] = useState<string[]>([]);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [schoolSearchTimeout, setSchoolSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [schools, setSchools] = useState<string[]>([]);

  // Courses for dropdown
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);
  
  // Groups for filtering
  const [groups, setGroups] = useState<{id: number; title: string; course_id: number; course_title: string}[]>([]);
  
  // Filter states
  const [courseFilter, setCourseFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [selectedAges, setSelectedAges] = useState<number[]>([]);

  // Note editing state
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  
  // Note expansion state - track which notes are expanded
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  
  // Sorting state
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
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
    const fetchData = async () => {
      try {
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) {
          router.push('/login');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);

        const studentsRes = await fetch('/api/students?withGroups=true');
        const studentsData = await studentsRes.json();
        setStudents(studentsData.students || []);
        
        // Fetch courses for filter
        const coursesRes = await fetch('/api/courses');
        const coursesData = await coursesRes.json();
        setCourses(coursesData.courses || []);
        
        // Fetch groups for filter
        const groupsRes = await fetch('/api/groups?includeInactive=true');
        const groupsData = await groupsRes.json();
        setGroups(groupsData.groups || []);
      } catch (error) {
        console.error('Failed to fetch students:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // Auto-hide toast after 2 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.trim()) {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}&withGroups=true`);
      const data = await res.json();
      setStudents(data.students || []);
    } else {
      const res = await fetch('/api/students?withGroups=true');
      const data = await res.json();
      setStudents(data.students || []);
    }
  };

  // Filter handlers
  const handleCourseFilterChange = (courseId: string) => {
    setCourseFilter(courseId);
    // Reset group filter when course changes
    if (courseId) {
      setGroupFilter('');
    }
  };

  const handleGroupFilterChange = (groupId: string) => {
    setGroupFilter(groupId);
  };

  const handleAgeFilterToggle = (age: number) => {
    setSelectedAges(prev => 
      prev.includes(age) 
        ? prev.filter(a => a !== age)
        : [...prev, age]
    );
  };

  const handleClearAgeFilter = () => {
    setSelectedAges([]);
  };

  // Filter students based on selected filters
  const filteredStudents = students.filter(student => {
    // Course filter
    if (courseFilter) {
      const studentCourses = student.groups?.map(g => g.course_title) || [];
      const course = courses.find(c => c.id === parseInt(courseFilter));
      if (course && !studentCourses.includes(course.title)) {
        return false;
      }
    }

    // Group filter
    if (groupFilter) {
      const studentGroupIds = student.groups?.map(g => g.id) || [];
      if (!studentGroupIds.includes(parseInt(groupFilter))) {
        return false;
      }
    }

    // Age filter
    if (selectedAges.length > 0) {
      const age = calculateAge(student.birth_date);
      if (age === null || !selectedAges.includes(age)) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    // Sorting logic
    if (sortBy === 'name') {
      const nameA = a.full_name.toLowerCase();
      const nameB = b.full_name.toLowerCase();
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    } else if (sortBy === 'created_at') {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (sortOrder === 'asc') {
        return dateA - dateB;
      } else {
        return dateB - dateA;
      }
    }
    return 0;
  });

  // Get unique ages from all students
  const allAges = Array.from(new Set(students
    .map(s => calculateAge(s.birth_date))
    .filter((a): a is number => a !== null)
    .sort((a, b) => a - b)
  ));

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
  const searchStudentNames = async (query: string) => {
    if (query.length < 2) {
      setNameSuggestions([]);
      return;
    }
    
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      setNameSuggestions(data.students || []);
    } catch (error) {
      console.error('Failed to search students:', error);
    }
  };

  // Search for student last name autocomplete
  const searchStudentLastNames = async (query: string) => {
    if (query.length < 2) {
      setLastNameSuggestions([]);
      return;
    }
    
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      // Extract unique last names from results
      const students = data.students || [];
      const lastNameArray: string[] = [];
      students.forEach((s: AutocompleteStudent) => {
        const parts = s.full_name.trim().split(' ');
        const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
        if (lastName.length > 0 && !lastNameArray.includes(lastName)) {
          lastNameArray.push(lastName);
        }
      });
      setLastNameSuggestions(lastNameArray.map((name: string, index: number) => ({
        id: index,
        full_name: name,
        phone: null,
        parent_name: null
      })));
    } catch (error) {
      console.error('Failed to search last names:', error);
    }
  };

  // Get unique schools from students
  const loadSchools = async () => {
    try {
      const res = await fetch('/api/students?limit=1000');
      const data = await res.json();
      const students = data.students || [];
      const schoolArray: string[] = [];
      students.forEach((s: any) => {
        const school = s.school;
        if (school && school.length > 0 && !schoolArray.includes(school)) {
          schoolArray.push(school);
        }
      });
      setSchools(schoolArray);
    } catch (error) {
      console.error('Failed to load schools:', error);
    }
  };

  // Search schools
  const searchSchools = async (query: string) => {
    if (query.length < 2) {
      setSchoolSuggestions([]);
      return;
    }
    
    const filtered = schools.filter(s => s.toLowerCase().includes(query.toLowerCase()));
    setSchoolSuggestions(filtered.slice(0, 10));
  };

  // Load courses
  const loadCourses = async () => {
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (error) {
      console.error('Failed to load courses:', error);
    }
  };

  const handleFirstNameChange = (value: string) => {
    setFormData({ ...formData, first_name: value });
    
    // Clear previous timeout
    if (nameSearchTimeout) {
      clearTimeout(nameSearchTimeout);
    }
    
    // Set new timeout for search
    const timeout = setTimeout(() => {
      searchStudentNames(value);
      setShowSuggestions(true);
    }, 300);
    
    setNameSearchTimeout(timeout);
  };

  const handleLastNameChange = (value: string) => {
    setFormData({ ...formData, last_name: value });
    
    // Clear previous timeout
    if (lastNameSearchTimeout) {
      clearTimeout(lastNameSearchTimeout);
    }
    
    // Set new timeout for search
    const timeout = setTimeout(() => {
      searchStudentLastNames(value);
      setShowLastNameSuggestions(true);
    }, 300);
    
    setLastNameSearchTimeout(timeout);
  };

  const handleSchoolChange = (value: string) => {
    setFormData({ ...formData, school: value });
    
    // Clear previous timeout
    if (schoolSearchTimeout) {
      clearTimeout(schoolSearchTimeout);
    }
    
    // Set new timeout for search
    const timeout = setTimeout(() => {
      searchSchools(value);
      setShowSchoolSuggestions(true);
    }, 300);
    
    setSchoolSearchTimeout(timeout);
  };

  const handleSelectSuggestion = (student: AutocompleteStudent) => {
    // Parse full name into first and last name
    const nameParts = student.full_name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Extract 9 digits from phone (remove +380 prefix if present)
    let phoneDigits = '';
    if (student.phone) {
      const digits = student.phone.replace(/\D/g, '');
      phoneDigits = digits.slice(-9);
    }
    
    setFormData({
      ...formData,
      first_name: firstName,
      last_name: lastName,
      phone: phoneDigits,
      parent_name: student.parent_name || '',
    });
    
    setShowSuggestions(false);
    setNameSuggestions([]);
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      birth_date: '',
      email: '',
      school: '',
      discount: '',
      photo: null,
      photoFile: null,
      phone: '',
      parent_name: '',
      parent_relation: '',
      parent_relation_other: '',
      parent_phone: '',
      parent2_name: '',
      parent2_relation: '',
      parent2_relation_other: '',
      notes: '',
      interested_courses: [],
      source: '',
      source_other: '',
    });
    setErrors({});
    setNameSuggestions([]);
    setShowSuggestions(false);
    setLastNameSuggestions([]);
    setShowLastNameSuggestions(false);
    setSchoolSuggestions([]);
    setShowSchoolSuggestions(false);
    setCoursesDropdownOpen(false);
  };

  const handleCreate = () => {
    setEditingStudent(null);
    resetForm();
    setShowModal(true);
    // Load courses and schools for autocomplete
    loadCourses();
    loadSchools();
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    
    // Parse full name into first and last name
    const nameParts = student.full_name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Extract 9 digits from phone (remove +380 prefix if present)
    let phoneDigits = '';
    if (student.phone) {
      const digits = student.phone.replace(/\D/g, '');
      phoneDigits = digits.slice(-9);
    }
    
    let parentPhoneDigits = '';
    if (student.parent_phone) {
      const digits = student.parent_phone.replace(/\D/g, '');
      parentPhoneDigits = digits.slice(-9);
    }
    
    setFormData({
      first_name: firstName,
      last_name: lastName,
      birth_date: student.birth_date || '',
      email: student.email || '',
      school: student.school || '',
      discount: student.discount || '',
      photo: student.photo,
      photoFile: null,
      phone: phoneDigits,
      parent_name: student.parent_name || '',
      parent_relation: student.parent_relation || '',
      parent_relation_other: '',
      parent_phone: parentPhoneDigits,
      parent2_name: student.parent2_name || '',
      parent2_relation: student.parent2_relation || '',
      parent2_relation_other: '',
      notes: student.notes || '',
      interested_courses: student.interested_courses ? student.interested_courses.split(',').map(s => s.trim()).filter(Boolean) : [],
      source: student.source || '',
      source_other: '',
    });
    setShowModal(true);
    // Load courses and schools for autocomplete
    loadCourses();
    loadSchools();
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.first_name.trim()) {
      newErrors.first_name = t('validation.required');
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = t('validation.required');
    }
    // Validate phone - must have exactly 9 digits
    if (!formData.phone || formData.phone.length !== 9) {
      newErrors.phone = t('validation.required');
    }
    if (!formData.parent_name.trim()) {
      newErrors.parent_name = t('validation.required');
    }
    if (!formData.parent_relation) {
      newErrors.parent_relation = t('validation.required');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setSaving(true);
    try {
      // Combine first and last name
      const fullName = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();
      
      const apiData = {
        full_name: fullName,
        phone: formData.phone ? `+380${formData.phone}` : null,
        email: formData.email || null,
        parent_name: formData.parent_name,
        parent_phone: formData.parent_phone ? `+380${formData.parent_phone}` : null,
        notes: formData.notes,
        birth_date: formData.birth_date,
        school: formData.school,
        discount: formData.discount,
        parent_relation: formData.parent_relation === 'other' ? formData.parent_relation_other : formData.parent_relation,
        parent2_name: formData.parent2_name,
        parent2_relation: formData.parent2_relation === 'other' ? formData.parent2_relation_other : formData.parent2_relation,
        interested_courses: formData.interested_courses.join(', '),
        source: formData.source === 'other' ? formData.source_other : formData.source,
        photo: formData.photo,
      };
      
      let res;
      if (editingStudent) {
        res = await fetch(`/api/students/${editingStudent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiData),
        });
      } else {
        res = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiData),
        });
      }
      
      // Check if the request was successful
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to save student:', res.status, errorData);
        alert(`Помилка збереження: ${errorData.error || res.statusText}`);
        setSaving(false);
        return;
      }
      
      setShowModal(false);
      const studentsRes = await fetch('/api/students?withGroups=true');
      const data = await studentsRes.json();
      setStudents(data.students || []);
    } catch (error) {
      console.error('Failed to save student:', error);
      alert('Помилка мережі. Спробуйте ще раз.');
    } finally {
      setSaving(false);
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
        // Refresh students list
        const studentsRes = await fetch('/api/students?withGroups=true');
        const studentsData = await studentsRes.json();
        setStudents(studentsData.students || []);
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

  const handlePhoneChange = (field: 'phone' | 'parent_phone', value: string) => {
    const formatted = formatPhoneNumber(value);
    setFormData({ ...formData, [field]: formatted });
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

  // Close dropdowns when clicking outside or modal closes
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.autocomplete-container')) {
        setShowSuggestions(false);
        setShowLastNameSuggestions(false);
        setShowSchoolSuggestions(false);
      }
      // Close courses dropdown when clicking outside
      if (!target.closest('.courses-dropdown')) {
        setCoursesDropdownOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close courses dropdown when modal closes
  useEffect(() => {
    if (!showModal) {
      setCoursesDropdownOpen(false);
    }
  }, [showModal]);

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
      <Layout user={{ id: 0, name: '', email: '', role: 'admin' }}>
        <PageLoading />
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {/* Search */}
          <input
            type="text"
            className="form-input"
            placeholder={`${t('actions.search')} ${t('nav.students').toLowerCase()}...`}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: '200px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
          />

          {/* Course filter */}
          <select
            className="form-input"
            value={courseFilter}
            onChange={(e) => handleCourseFilterChange(e.target.value)}
            style={{ width: '160px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
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
            style={{ width: '180px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
              {filteredStudents.length} {filteredStudents.length === 1 ? 'учень' : filteredStudents.length > 1 && filteredStudents.length < 5 ? 'учні' : 'учнів'}
            </span>
            
            {/* Sort buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280', marginRight: '0.25rem' }}>Сортування:</span>
              <button
                onClick={() => {
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
                }}
                title="Сортувати за датою створення"
              >
                {sortOrder === 'asc' ? 'Найстарі' : 'Найнові'}
                {sortBy === 'created_at' && (
                  <span style={{ fontSize: '0.625rem' }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                )}
              </button>
            </div>
            
            {user.role === 'admin' && (
              <button className="btn btn-primary" onClick={handleCreate}>
                + {t('modals.newStudent')}
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '1rem 0.75rem' }}>
          {filteredStudents.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '1.25rem',
              alignItems: 'start',
            }}>
              {filteredStudents.map((student) => {
                const age = calculateAge(student.birth_date);
                const firstLetter = getFirstLetter(student.full_name);
                
                // Truncate notes for display
                const MAX_NOTE_LENGTH = 80;
                const isNoteTruncated = student.notes && student.notes.length > MAX_NOTE_LENGTH;
                const displayNote = (isNoteTruncated && !expandedNotes.has(student.id))
                  ? student.notes!.substring(0, MAX_NOTE_LENGTH) + '...'
                  : student.notes;
                
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
                                alt={student.full_name}
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
                          {student.discount && (
                            <div
                              title={`Знижка на навчання: ${student.discount.replace(/[^0-9]/g, '')}%`}
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
                              {student.discount.replace(/[^0-9]/g, '')}%
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
                          {student.full_name}
                        </a>
                        
                        {/* Contact Info */}
                        {(student.phone || student.email) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {student.phone && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                <span
                                  onClick={() => copyPhone(student.phone, 'main')}
                                  style={{
                                    fontSize: '0.8125rem',
                                    color: copiedField === `main-${student.phone}` ? '#10b981' : '#475569',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3125rem',
                                    transition: 'color 0.15s',
                                    fontWeight: 500,
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                  onMouseEnter={(e) => { if (copiedField !== `main-${student.phone}`) e.currentTarget.style.color = '#6366f1'; }}
                                  onMouseLeave={(e) => { if (copiedField !== `main-${student.phone}`) e.currentTarget.style.color = '#475569'; }}
                                  title="Клікніть щоб скопіювати"
                                >
                                  {copiedField === `main-${student.phone}` ? (
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  ) : (
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                  )}
                                  {student.phone}
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
                            {!student.phone && (student.parent_name || student.parent_relation) && (
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
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ padding: '1rem 1.25rem' }}>
              <h3 className="modal-title" style={{ fontSize: '1rem', fontWeight: 600 }}>
                {editingStudent ? t('modals.editStudent') : t('modals.newStudent')}
              </h3>
              <button 
                className="modal-close" 
                onClick={() => setShowModal(false)}
                style={{ fontSize: '1.5rem', lineHeight: 1, padding: '0.25rem' }}
              >
                ×
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem' }}>
              {/* Block 1: Основна інформація */}
              <div style={{ marginBottom: '1.75rem' }}>
                <h4 style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  marginBottom: '1rem', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em'
                }}>
                  Основна інформація
                </h4>
                
                {/* First Name and Last Name in one row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Autocomplete for first name */}
                  <div className="form-group autocomplete-container" style={{ position: 'relative' }}>
                    <label className="form-label">{t('forms.firstName')} *</label>
                    <input
                      ref={firstNameInputRef}
                      type="text"
                      className={`form-input ${errors.first_name ? 'form-input-error' : ''}`}
                      value={formData.first_name}
                      onChange={(e) => handleFirstNameChange(e.target.value)}
                      onFocus={() => formData.first_name.length >= 2 && setShowSuggestions(true)}
                      placeholder={t('forms.firstName')}
                      autoComplete="off"
                    />
                    {errors.first_name && <span className="form-error">{errors.first_name}</span>}
                    
                    {/* Autocomplete suggestions dropdown */}
                    {showSuggestions && nameSuggestions.length > 0 && (
                      <ul style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        listStyle: 'none',
                        margin: '0.25rem 0 0',
                        padding: 0,
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {nameSuggestions.map((student) => (
                          <li
                            key={student.id}
                            onClick={() => handleSelectSuggestion(student)}
                            style={{
                              padding: '0.625rem 0.75rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f3f4f6',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                          >
                            <span style={{ fontWeight: '500' }}>{student.full_name}</span>
                            {student.phone && <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{student.phone}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Autocomplete for last name */}
                  <div className="form-group autocomplete-container" style={{ position: 'relative' }}>
                    <label className="form-label">{t('forms.lastName')} *</label>
                    <input
                      type="text"
                      className={`form-input ${errors.last_name ? 'form-input-error' : ''}`}
                      value={formData.last_name}
                      onChange={(e) => handleLastNameChange(e.target.value)}
                      onFocus={() => formData.last_name.length >= 2 && setShowLastNameSuggestions(true)}
                      placeholder={t('forms.lastName')}
                      autoComplete="off"
                    />
                    {errors.last_name && <span className="form-error">{errors.last_name}</span>}
                    
                    {/* Autocomplete suggestions dropdown for last name */}
                    {showLastNameSuggestions && lastNameSuggestions.length > 0 && (
                      <ul style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        listStyle: 'none',
                        margin: '0.25rem 0 0',
                        padding: 0,
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {lastNameSuggestions.map((student) => (
                          <li
                            key={student.id}
                            onClick={() => {
                              setFormData({ ...formData, last_name: student.full_name });
                              setShowLastNameSuggestions(false);
                            }}
                            style={{
                              padding: '0.625rem 0.75rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                          >
                            <span style={{ fontWeight: '500' }}>{student.full_name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">{t('forms.birthDate')}</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.birth_date}
                      onChange={(e) => {
                        setFormData({ ...formData, birth_date: e.target.value });
                      }}
                      placeholder={t('forms.birthDatePlaceholder')}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="student@example.com"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Autocomplete for school */}
                  <div className="form-group autocomplete-container" style={{ position: 'relative' }}>
                    <label className="form-label">{t('forms.school')}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.school}
                      onChange={(e) => handleSchoolChange(e.target.value)}
                      onFocus={() => formData.school.length >= 2 && setShowSchoolSuggestions(true)}
                      placeholder={t('forms.schoolPlaceholder')}
                      autoComplete="off"
                    />
                    
                    {/* Autocomplete suggestions dropdown for school */}
                    {showSchoolSuggestions && schoolSuggestions.length > 0 && (
                      <ul style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        listStyle: 'none',
                        margin: '0.25rem 0 0',
                        padding: 0,
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {schoolSuggestions.map((school, index) => (
                          <li
                            key={index}
                            onClick={() => {
                              setFormData({ ...formData, school: school });
                              setShowSchoolSuggestions(false);
                            }}
                            style={{
                              padding: '0.625rem 0.75rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                          >
                            <span>{school}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">{t('forms.discount')}</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.discount}
                      onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                      placeholder={t('forms.discountPlaceholder')}
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('forms.photo')}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {formData.photo ? (
                        <>
                          <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #e5e7eb', flexShrink: 0 }}>
                            <img src={formData.photo} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                              {t('forms.changePhoto')}
                            </button>
                            <button type="button" className="btn btn-outline btn-sm" onClick={removePhoto}>
                              {t('forms.removePhoto')}
                            </button>
                          </div>
                        </>
                      ) : (
                        <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                          {t('forms.uploadPhoto')}
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
                  </div>
                </div>
              </div>

              {/* Block 2: Контактна інформація */}
              <div style={{ marginBottom: '1.75rem' }}>

                <div className="form-group">
                  <label className="form-label">{t('forms.mainPhone')} *</label>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    border: errors.phone ? '1px solid #ef4444' : '1px solid #d1d5db',
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
                      className={errors.phone ? 'form-input-error' : ''}
                      value={formData.phone}
                      onChange={(e) => handlePhoneChange('phone', e.target.value)}
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
                  {errors.phone && <span className="form-error">{errors.phone}</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">{t('forms.contactName')} *</label>
                    <input
                      type="text"
                      className={`form-input ${errors.parent_name ? 'form-input-error' : ''}`}
                      value={formData.parent_name}
                      onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                      placeholder={t('forms.contactNamePlaceholder')}
                    />
                    {errors.parent_name && <span className="form-error">{errors.parent_name}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('forms.whoIsThis')} *</label>
                    <select
                      className={`form-input ${errors.parent_relation ? 'form-input-error' : ''}`}
                      value={formData.parent_relation}
                      onChange={(e) => setFormData({ ...formData, parent_relation: e.target.value })}
                    >
                      <option value="">{t('forms.whoIsThisPlaceholder')}</option>
                      {RELATION_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {errors.parent_relation && <span className="form-error">{errors.parent_relation}</span>}
                  </div>
                </div>

                {formData.parent_relation === 'other' && (
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      value={formData.parent_relation_other}
                      onChange={(e) => setFormData({ ...formData, parent_relation_other: e.target.value })}
                      placeholder={t('forms.relationOtherPlaceholder')}
                    />
                  </div>
                )}
              </div>

              {/* Additional phone - optional */}
              <div style={{ marginBottom: '1.75rem' }}>

                <div className="form-group">
                  <label className="form-label">{t('forms.additionalPhone')}</label>
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
                      className="form-input"
                      value={formData.parent_phone}
                      onChange={(e) => handlePhoneChange('parent_phone', e.target.value)}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">{t('forms.contactName')}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.parent2_name}
                      onChange={(e) => setFormData({ ...formData, parent2_name: e.target.value })}
                      placeholder={t('forms.contactNamePlaceholder')}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('forms.whoIsThis')}</label>
                    <select
                      className="form-input"
                      value={formData.parent2_relation}
                      onChange={(e) => setFormData({ ...formData, parent2_relation: e.target.value })}
                    >
                      <option value="">{t('forms.whoIsThisPlaceholder')}</option>
                      {RELATION_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.parent2_relation === 'other' && (
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      value={formData.parent2_relation_other}
                      onChange={(e) => setFormData({ ...formData, parent2_relation_other: e.target.value })}
                      placeholder={t('forms.relationOtherPlaceholder')}
                    />
                  </div>
                )}
              </div>

              {/* Block 3: Додаткова інформація */}
              <div>
                <h4 style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  marginBottom: '1rem', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em'
                }}>
                  {t('forms.additionalInfo')}
                </h4>

                <div className="form-group">
                  <textarea
                    className="form-input"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t('forms.notePlaceholder')}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: '80px' }}
                  />
                </div>

                <div className="form-group courses-dropdown" style={{ position: 'relative' }}>
                  <label className="form-label">{t('forms.interestedCourses')}</label>
                  <div
                    onClick={() => setCoursesDropdownOpen(!coursesDropdownOpen)}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      padding: '0.625rem 0.75rem',
                      backgroundColor: '#fff',
                      cursor: 'pointer',
                      minHeight: '42px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ color: formData.interested_courses.length > 0 ? '#111827' : '#9ca3af', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {formData.interested_courses.length > 0 
                        ? formData.interested_courses.join(', ') 
                        : t('forms.interestedCoursesPlaceholder')}
                    </span>
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      style={{ transform: coursesDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                    >
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                  
                  {coursesDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: '#fff',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      marginTop: '0.25rem',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                      {courses.map(course => (
                        <label
                          key={course.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.625rem 0.75rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f3f4f6',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        >
                          <input
                            type="checkbox"
                            checked={formData.interested_courses.includes(course.title)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ 
                                  ...formData, 
                                  interested_courses: [...formData.interested_courses, course.title] 
                                });
                              } else {
                                setFormData({ 
                                  ...formData, 
                                  interested_courses: formData.interested_courses.filter(c => c !== course.title) 
                                });
                              }
                            }}
                            style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                          />
                          <span style={{ fontSize: '0.875rem' }}>{course.title}</span>
                        </label>
                      ))}
                      {courses.length === 0 && (
                        <div style={{ padding: '0.75rem', color: '#9ca3af', fontSize: '0.875rem' }}>
                          {t('forms.interestedCoursesPlaceholder')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">{t('forms.source')}</label>
                  <select
                    className="form-input"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    <option value="">{t('forms.sourcePlaceholder')}</option>
                    {SOURCE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {formData.source === 'other' && (
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      value={formData.source_other}
                      onChange={(e) => setFormData({ ...formData, source_other: e.target.value })}
                      placeholder={t('forms.sourceOtherPlaceholder')}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '1rem 1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                {t('actions.cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t('common.saving') : t('actions.save')}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </Layout>
  );
}
