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

interface Student {
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
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
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface StudentGroup {
  id: number;
  public_id: string | null;
  title: string;
  course_title: string;
  status: string;
  join_date: string;
  teacher_name: string | null;
}

interface StudentFormData {
  first_name: string;
  last_name: string;
  birth_date: string;
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

interface Course {
  id: number;
  title: string;
  public_id: string;
}

const RELATION_OPTIONS = [
  { value: 'mother', label: t('forms.relationMother') },
  { value: 'father', label: t('forms.relationFather') },
  { value: 'grandmother', label: t('forms.relationGrandmother') },
  { value: 'grandfather', label: t('forms.relationGrandfather') },
  { value: 'other', label: t('forms.relationOther') },
];

const SOURCE_OPTIONS = [
  { value: 'social', label: t('forms.sourceSocial') },
  { value: 'friends', label: t('forms.sourceFriends') },
  { value: 'search', label: t('forms.sourceSearch') },
  { value: 'other', label: t('forms.sourceOther') },
];

// Hardcoded status labels
const STATUS_LABELS: Record<string, string> = {
  active: 'Активна',
  inactive: 'Неактивна',
  graduate: 'Випущена',
  archived: 'Архів',
};

// Format phone number for display
function formatPhone(phone: string | null): string {
  if (!phone) return '';
  // Remove +380 and format
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12) {
    return `+${digits.slice(0, 3)} (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
  }
  return phone;
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

// Get first letter of name for avatar
function getFirstLetter(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function formatPhoneNumber(value: string): string {
  if (value === '') {
    return '';
  }
  
  let digits = value.replace(/\D/g, '');
  if (digits.length === 0) {
    return '';
  }
  
  const phoneDigits = digits.slice(-9);
  return phoneDigits;
}

export default function StudentProfilePage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<StudentFormData>({
    first_name: '',
    last_name: '',
    birth_date: '',
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Courses for autocomplete
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);

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

        // Fetch student with groups
        const studentRes = await fetch(`/api/students/${studentId}?withGroups=true`);
        if (studentRes.status === 404) {
          setNotFound(true);
          return;
        }
        if (!studentRes.ok) {
          router.push('/students');
          return;
        }
        const studentData = await studentRes.json();
        setStudent(studentData.student);
        setGroups(studentData.student.groups || []);
        
        // Fetch courses for autocomplete
        const coursesRes = await fetch('/api/courses');
        if (coursesRes.ok) {
          const coursesData = await coursesRes.json();
          setCourses(coursesData.courses || []);
        }
      } catch (error) {
        console.error('Failed to fetch student:', error);
        router.push('/students');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, router]);

  const getRelationLabel = (relation: string | null): string => {
    if (!relation) return '';
    const option = RELATION_OPTIONS.find(opt => opt.value === relation);
    return option ? option.label : relation;
  };

  const getSourceLabel = (source: string | null): string => {
    if (!source) return '';
    const option = SOURCE_OPTIONS.find(opt => opt.value === source);
    return option ? option.label : source;
  };

  const startEdit = () => {
    if (!student) return;
    
    const nameParts = student.full_name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
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
    setIsEditMode(true);
    setErrors({});
  };

  const cancelEdit = () => {
    setIsEditMode(false);
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.first_name.trim()) {
      newErrors.first_name = t('validation.required');
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = t('validation.required');
    }
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
    if (!validateForm() || !student) return;
    
    setSaving(true);
    try {
      const fullName = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();
      
      const apiData = {
        full_name: fullName,
        phone: formData.phone ? `+380${formData.phone}` : null,
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
      
      const response = await fetch(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });
      
      if (!response.ok) {
        const data = await response.json();
        setToast({ message: data.error || 'Не вдалося зберегти', type: 'error' });
        return;
      }
      
      // Refresh student data
      const studentRes = await fetch(`/api/students/${studentId}?withGroups=true`);
      const studentData = await studentRes.json();
      setStudent(studentData.student);
      setGroups(studentData.student.groups || []);
      
      setIsEditMode(false);
      setToast({ message: 'Дані успішно збережено', type: 'success' });
    } catch (error) {
      console.error('Failed to save student:', error);
      setToast({ message: 'Не вдалося зберегти', type: 'error' });
    } finally {
      setSaving(false);
    }
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

  const toggleCourse = (courseId: string) => {
    setFormData(prev => ({
      ...prev,
      interested_courses: prev.interested_courses.includes(courseId)
        ? prev.interested_courses.filter(id => id !== courseId)
        : [...prev.interested_courses, courseId]
    }));
  };

  const handlePhoneChange = (field: 'phone' | 'parent_phone', value: string) => {
    const formatted = formatPhoneNumber(value);
    setFormData({ ...formData, [field]: formatted });
  };

  // Show loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return null;
  }

  // At this point, user is guaranteed to be defined
  const currentUser = user as User;

  // Show 404 state
  if (notFound || !student) {
    return (
      <Layout user={currentUser}>
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Учня не знайдено</h1>
          <a href="/students" className="btn btn-primary">Повернутися до списку</a>
        </div>
      </Layout>
    );
  }

  const isAdmin = currentUser.role === 'admin';
  const age = calculateAge(student.birth_date);
  const firstLetter = getFirstLetter(student.full_name);

  // Edit mode form
  if (isEditMode) {
    return (
      <Layout user={currentUser}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => router.push('/students')}
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
            {t('nav.students')}
          </button>
        </div>

        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>
            Редагування учня
          </h1>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={cancelEdit}
              className="btn btn-secondary"
              disabled={saving}
            >
              Скасувати
            </button>
            <button
              onClick={handleSave}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Збереження...' : 'Зберегти'}
            </button>
          </div>
        </div>

        {/* Edit Form */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '320px 1fr', 
          gap: '1.5rem',
          alignItems: 'start'
        }}>
          {/* Left Column: Photo */}
          <div style={{ position: 'sticky', top: '1rem' }}>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 1rem 0', color: 'var(--gray-700)', textAlign: 'left' }}>
                Фото учня
              </h3>
              
              <div style={{
                width: '160px',
                height: '160px',
                borderRadius: '50%',
                margin: '0 auto 1rem',
                overflow: 'hidden',
                backgroundColor: '#e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid #e0e7ff',
              }}>
                {formData.photo ? (
                  <img
                    src={formData.photo}
                    alt="Student"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <span style={{
                    fontSize: '3rem',
                    fontWeight: 600,
                    color: '#4f46e5',
                  }}>
                    {formData.first_name ? getFirstLetter(formData.first_name) : '?'}
                  </span>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                >
                  Завантажити
                </button>
                {formData.photo && (
                  <button
                    onClick={removePhoto}
                    className="btn"
                    style={{ 
                      fontSize: '0.8125rem', 
                      padding: '0.375rem 0.75rem',
                      backgroundColor: 'var(--gray-100)',
                      color: 'var(--gray-600)',
                    }}
                  >
                    Видалити
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Form Fields */}
          <div>
            {/* Basic Info Card */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.25rem 0', color: 'var(--gray-700)' }}>
                Основна інформація
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Ім'я *
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  {errors.first_name && (
                    <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.first_name}</div>
                  )}
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Прізвище *
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  {errors.last_name && (
                    <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.last_name}</div>
                  )}
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Дата народження
                  </label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Школа
                  </label>
                  <input
                    type="text"
                    value={formData.school}
                    onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                    placeholder="Назва школи"
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Знижка
                  </label>
                  <input
                    type="text"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                    placeholder="Наприклад: 10%"
                  />
                </div>
              </div>
            </div>

            {/* Основний контакт */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.25rem 0', color: 'var(--gray-700)' }}>
                Основний контакт
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Телефон *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ 
                      padding: '0.625rem 0.75rem', 
                      backgroundColor: 'var(--gray-100)', 
                      border: '1px solid var(--gray-300)',
                      borderRight: 'none',
                      borderRadius: '0.375rem 0 0 0.375rem',
                      color: 'var(--gray-500)',
                      fontSize: '0.875rem'
                    }}>
                      +380
                    </span>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handlePhoneChange('phone', e.target.value)}
                      className="form-input"
                      style={{ 
                        width: '100%',
                        borderRadius: '0 0.375rem 0.375rem 0',
                        marginLeft: '-1px'
                      }}
                      placeholder="XX XXX XX XX"
                      maxLength={9}
                    />
                  </div>
                  {errors.phone && (
                    <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.phone}</div>
                  )}
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Ім'я контактної особи *
                  </label>
                  <input
                    type="text"
                    value={formData.parent_name}
                    onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  {errors.parent_name && (
                    <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.parent_name}</div>
                  )}
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Стосунок *
                  </label>
                  <select
                    value={formData.parent_relation}
                    onChange={(e) => setFormData({ ...formData, parent_relation: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">Оберіть...</option>
                    {RELATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {errors.parent_relation && (
                    <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.parent_relation}</div>
                  )}
                </div>
                
                {formData.parent_relation === 'other' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                      Вкажіть стосунок
                    </label>
                    <input
                      type="text"
                      value={formData.parent_relation_other}
                      onChange={(e) => setFormData({ ...formData, parent_relation_other: e.target.value })}
                      className="form-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Додатковий контакт */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.25rem 0', color: 'var(--gray-700)' }}>
                Додатковий контакт
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Телефон
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ 
                      padding: '0.625rem 0.75rem', 
                      backgroundColor: 'var(--gray-100)', 
                      border: '1px solid var(--gray-300)',
                      borderRight: 'none',
                      borderRadius: '0.375rem 0 0 0.375rem',
                      color: 'var(--gray-500)',
                      fontSize: '0.875rem'
                    }}>
                      +380
                    </span>
                    <input
                      type="tel"
                      value={formData.parent_phone}
                      onChange={(e) => handlePhoneChange('parent_phone', e.target.value)}
                      className="form-input"
                      style={{ 
                        width: '100%',
                        borderRadius: '0 0.375rem 0.375rem 0',
                        marginLeft: '-1px'
                      }}
                      placeholder="XX XXX XX XX"
                      maxLength={9}
                    />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Ім'я контактної особи
                  </label>
                  <input
                    type="text"
                    value={formData.parent2_name}
                    onChange={(e) => setFormData({ ...formData, parent2_name: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Стосунок
                  </label>
                  <select
                    value={formData.parent2_relation}
                    onChange={(e) => setFormData({ ...formData, parent2_relation: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">Оберіть...</option>
                    {RELATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                {formData.parent2_relation === 'other' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                      Вкажіть стосунок
                    </label>
                    <input
                      type="text"
                      value={formData.parent2_relation_other}
                      onChange={(e) => setFormData({ ...formData, parent2_relation_other: e.target.value })}
                      className="form-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Additional Info Card */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.25rem 0', color: 'var(--gray-700)' }}>
                Додаткова інформація
              </h3>
              
              {/* Interested Courses */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.5rem' }}>
                  Цікаві курси
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setCoursesDropdownOpen(!coursesDropdownOpen)}
                    className="btn"
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      backgroundColor: 'white',
                      border: '1px solid var(--gray-300)',
                      padding: '0.625rem 0.75rem',
                    }}
                  >
                    <span style={{ color: formData.interested_courses.length > 0 ? 'var(--gray-900)' : 'var(--gray-500)' }}>
                      {formData.interested_courses.length > 0 
                        ? `${formData.interested_courses.length} обрано`
                        : 'Оберіть курси'}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  
                  {coursesDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '0.25rem',
                      backgroundColor: 'white',
                      border: '1px solid var(--gray-200)',
                      borderRadius: '0.375rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 20,
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}>
                      {courses.map(course => (
                        <label
                          key={course.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <input
                            type="checkbox"
                            checked={formData.interested_courses.includes(course.title)}
                            onChange={() => toggleCourse(course.title)}
                            style={{ width: '16px', height: '16px' }}
                          />
                          <span style={{ fontSize: '0.875rem' }}>{course.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                
                {formData.interested_courses.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
                    {formData.interested_courses.map(courseName => (
                      <span
                        key={courseName}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: 'var(--primary-light)',
                          color: 'var(--primary)',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                        }}
                      >
                        {courseName}
                        <button
                          onClick={() => toggleCourse(courseName)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: 'var(--primary)',
                            display: 'flex',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Source */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                  Джерело
                </label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="form-input"
                  style={{ width: '100%' }}
                >
                  <option value="">Оберіть...</option>
                  {SOURCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {formData.source === 'other' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                    Вкажіть джерело
                  </label>
                  <input
                    type="text"
                    value={formData.source_other}
                    onChange={(e) => setFormData({ ...formData, source_other: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.375rem' }}>
                  Нотатки
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
                  placeholder="Додаткова інформація про учня..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Toast notification */}
        {toast && (
          <div
            className={`toast toast-${toast.type}`}
            style={{
              position: 'fixed',
              bottom: '1.5rem',
              right: '1.5rem',
              zIndex: 1000,
            }}
          >
            {toast.message}
          </div>
        )}
      </Layout>
    );
  }

  // View mode - Profile display
  return (
    <Layout user={currentUser}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => router.push('/students')}
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
          {t('nav.students')}
        </button>
      </div>

      {/* Header with Edit Button */}
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
            {student.public_id}
          </span>
          <span className={`badge ${student.is_active ? 'badge-success' : 'badge-gray'}`}>
            {student.is_active ? 'Активний' : 'Неактивний'}
          </span>
        </div>
        
        {isAdmin && (
          <button
            onClick={startEdit}
            className="btn btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Редагувати
          </button>
        )}
      </div>

      {/* Main Layout: Photo Left, Content Right */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Desktop: Side by side */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '320px 1fr', 
          gap: '1.5rem',
          alignItems: 'start'
        }}>
          {/* Left Column: Photo and Quick Info */}
          <div style={{ position: 'sticky', top: '1rem' }}>
            <div className="card" style={{ padding: '0', overflow: 'hidden', borderRadius: '0.75rem' }}>
              {/* Photo with Discount Badge */}
              <div style={{ position: 'relative', margin: '1.5rem' }}>
                <div style={{
                  aspectRatio: '1',
                  backgroundColor: '#e0e7ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  width: '100%',
                }}>
                  {student.photo ? (
                    <img
                      src={student.photo}
                      alt={student.full_name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <span style={{
                      fontSize: '5rem',
                      fontWeight: 600,
                      color: '#4f46e5',
                    }}>
                      {firstLetter}
                    </span>
                  )}
                </div>
                
                {/* Discount Badge on Avatar Corner */}
                {student.discount && (
                  <div style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    padding: '0.375rem 0.625rem',
                    borderRadius: '1rem',
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.125rem',
                    zIndex: 1,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                      <line x1="7" y1="7" x2="7.01" y2="7"></line>
                    </svg>
                    {student.discount}{!student.discount.includes('%') && '%'}
                  </div>
                )}
              </div>
              
              {/* Quick Info */}
              <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700', margin: '0 0 0.5rem 0', letterSpacing: '-0.025em', color: 'var(--gray-900)' }}>
                  {student.full_name}
                </h1>
                
                {age !== null && (
                  <div style={{ 
                    color: 'var(--primary)', 
                    fontSize: '1.75rem', 
                    fontWeight: '700',
                    marginBottom: '1.25rem',
                    letterSpacing: '-0.025em',
                  }}>
                    {age} {age === 1 ? 'рік' : age >= 2 && age <= 4 ? 'роки' : 'років'}
                  </div>
                )}

                {/* Contacts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Основний контакт */}
                  {student.phone && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.625rem 0.75rem',
                        backgroundColor: '#ecfdf5',
                        borderRadius: '0.5rem',
                        border: '1px solid #a7f3d0',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Основний контакт</div>
                        {student.parent_name && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', marginBottom: '0.125rem' }}>
                            {student.parent_name} {student.parent_relation && `(${getRelationLabel(student.parent_relation)})`}
                          </div>
                        )}
                        <a
                          href={`tel:${student.phone}`}
                          style={{
                            color: 'var(--gray-900)',
                            textDecoration: 'none',
                            fontSize: '0.9375rem',
                            fontWeight: '500',
                          }}
                        >
                          {formatPhone(student.phone)}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {/* Додатковий контакт */}
                  {student.parent_phone && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.625rem 0.75rem',
                        backgroundColor: '#eff6ff',
                        borderRadius: '0.5rem',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.6875rem', color: '#2563eb', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Додатковий контакт</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', marginBottom: '0.125rem' }}>
                          {student.parent2_name || 'Батьки'} {student.parent2_relation && `(${getRelationLabel(student.parent2_relation)})`}
                        </div>
                        <a
                          href={`tel:${student.parent_phone}`}
                          style={{
                            color: 'var(--gray-900)',
                            textDecoration: 'none',
                            fontSize: '0.9375rem',
                            fontWeight: '500',
                          }}
                        >
                          {formatPhone(student.parent_phone)}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Content */}
          <div>
            {/* Basic Info Card */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0', color: 'var(--gray-700)' }}>
                Основна інформація
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
                {student.birth_date && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </div>
                    <div>
                      <div style={{ color: 'var(--gray-500)', fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Дата народження
                      </div>
                      <div style={{ fontSize: '0.9375rem', color: 'var(--gray-900)' }}>
                        {new Date(student.birth_date).toLocaleDateString('uk-UA')}
                      </div>
                    </div>
                  </div>
                )}
                
                {student.school && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: '#dbeafe', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                    </div>
                    <div>
                      <div style={{ color: 'var(--gray-500)', fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Школа
                      </div>
                      <div style={{ fontSize: '0.9375rem', color: 'var(--gray-900)' }}>
                        {student.school}
                      </div>
                    </div>
                  </div>
                )}
                
                {student.interested_courses && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: '#fce7f3', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                      </svg>
                    </div>
                    <div>
                      <div style={{ color: 'var(--gray-500)', fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Цікаві курси
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                        {student.interested_courses.split(',').map((course, idx) => (
                          <span
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'var(--primary-light)',
                              color: 'var(--primary)',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                            }}
                          >
                            {course.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {student.source && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: '#e0e7ff', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                      </svg>
                    </div>
                    <div>
                      <div style={{ color: 'var(--gray-500)', fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Джерело
                      </div>
                      <div style={{ fontSize: '0.9375rem', color: 'var(--gray-900)' }}>
                        {getSourceLabel(student.source)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Groups Card */}
            {groups.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid var(--gray-200)'
                }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
                    Групи учня
                  </h2>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '24px',
                    height: '24px',
                    padding: '0 0.5rem',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}>
                    {groups.length}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {groups.map((group) => (
                    <a
                      key={group.id}
                      href={`/groups/${group.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem 1.5rem',
                        borderBottom: '1px solid var(--gray-100)',
                        textDecoration: 'none',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--gray-900)', marginBottom: '0.25rem' }}>
                          {group.title}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                          {group.course_title}
                          {group.teacher_name && ` • ${group.teacher_name}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`badge ${group.status === 'active' ? 'badge-success' : group.status === 'graduate' ? 'badge-info' : 'badge-gray'}`}>
                          {STATUS_LABELS[group.status] || group.status}
                        </span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Notes Card */}
            {student.notes && (
              <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0', color: 'var(--gray-700)' }}>
                  Нотатки
                </h2>
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: '#fefce8', 
                  borderRadius: '0.5rem',
                  border: '1px solid #fef08a',
                  color: 'var(--gray-700)',
                  fontSize: '0.9375rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                }}>
                  {student.notes}
                </div>
              </div>
            )}

            {/* Meta Info */}
            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
              <div>Створено: {new Date(student.created_at).toLocaleString('uk-UA')}</div>
              {student.updated_at && student.updated_at !== student.created_at && (
                <div>Оновлено: {new Date(student.updated_at).toLocaleString('uk-UA')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 1000,
          }}
        >
          {toast.message}
        </div>
      )}
    </Layout>
  );
}
