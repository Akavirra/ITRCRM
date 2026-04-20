'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { t } from '@/i18n/t';
import StudentAvatarCropModal from '@/components/StudentAvatarCropModal';

export type StudentRecord = {
  id: number;
  full_name: string;
  email: string | null;
  parent_name: string | null;
  notes: string | null;
  birth_date: string | null;
  photo?: string | null;
  school: string | null;
  discount: number | null;
  parent_relation: string | null;
  parent_phone?: string | null;
  parent2_name?: string | null;
  parent2_phone?: string | null;
  parent2_relation?: string | null;
  interested_courses?: string | null;
  source?: string | null;
  gender?: 'male' | 'female' | null;
};

type FormState = {
  first_name: string;
  last_name: string;
  birth_date: string;
  email: string;
  school: string;
  discount: string;
  gender: '' | 'male' | 'female';
  parent_name: string;
  parent_relation: string;
  parent_relation_other: string;
  parent_phone: string;
  parent2_name: string;
  parent2_phone: string;
  parent2_relation: string;
  parent2_relation_other: string;
  notes: string;
  interested_courses: string[];
  source: string;
  source_other: string;
  photo: string | null;
};

type AutocompleteStudent = {
  id: number;
  full_name: string;
  parent_name: string | null;
};

type Course = {
  id: number;
  title: string;
  public_id: string;
  is_active?: boolean;
};

const EMPTY_FORM: FormState = {
  first_name: '',
  last_name: '',
  birth_date: '',
  email: '',
  school: '',
  discount: '',
  gender: '',
  parent_name: '',
  parent_relation: '',
  parent_relation_other: '',
  parent_phone: '',
  parent2_name: '',
  parent2_phone: '',
  parent2_relation: '',
  parent2_relation_other: '',
  notes: '',
  interested_courses: [],
  source: '',
  source_other: '',
  photo: null,
};

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

function formatPhoneNumber(value: string) {
  return value.replace(/\D/g, '').slice(-9);
}

function detectGender(name: string): '' | 'male' | 'female' {
  const firstName = name.trim().split(/\s+/)[0].toLowerCase();
  if (!firstName) return '';
  // Common exceptions
  const ambiguous = ['саша', 'женя', 'женя', 'валі', 'валя'];
  if (ambiguous.includes(firstName)) return '';
  // Female names usually end with 'а' or 'я' in Ukrainian
  const lastChar = firstName.slice(-1);
  if (lastChar === 'а' || lastChar === 'я') {
    // Some male names also end with 'я' (e.g., Ілля, Миколая is rare)
    const maleEndingWithYa = ['ілля', 'нікіта', 'мікола', 'кузя', 'савва', 'таїсія'];
    if (maleEndingWithYa.includes(firstName)) return 'male';
    return 'female';
  }
  return 'male';
}

function extractPhoneDigits(value?: string | null) {
  return value ? value.replace(/\D/g, '').slice(-9) : '';
}

function normalizeDate(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getFirstLetter(value: string) {
  return value.trim().charAt(0).toUpperCase();
}

function normalizeOptionValue(
  value: string | null | undefined,
  options: Array<{ value: string }>
) {
  const normalized = (value || '').trim();
  if (!normalized) {
    return { value: '', other: '' };
  }

  const matches = options.some((option) => option.value === normalized);
  return matches
    ? { value: normalized, other: '' }
    : { value: 'other', other: normalized };
}

function mapStudentToForm(student: StudentRecord): FormState {
  const nameParts = student.full_name.trim().split(/\s+/);
  const primaryPhone = student.parent_phone || null;
  const primaryRelation = normalizeOptionValue(student.parent_relation, RELATION_OPTIONS);
  const secondaryRelation = normalizeOptionValue(student.parent2_relation, RELATION_OPTIONS);
  const source = normalizeOptionValue(student.source, SOURCE_OPTIONS);

  return {
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' '),
    birth_date: normalizeDate(student.birth_date),
    email: student.email || '',
    school: student.school || '',
    discount: student.discount != null ? String(student.discount) : '',
    gender: student.gender || '',
    parent_name: student.parent_name || '',
    parent_relation: primaryRelation.value,
    parent_relation_other: primaryRelation.other,
    parent_phone: extractPhoneDigits(primaryPhone),
    parent2_name: student.parent2_name || '',
    parent2_phone: extractPhoneDigits(student.parent2_phone),
    parent2_relation: secondaryRelation.value,
    parent2_relation_other: secondaryRelation.other,
    notes: student.notes || '',
    interested_courses: student.interested_courses
      ? student.interested_courses
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map((item) => item.replace(/^"+|"+$/g, '').trim())
          .filter(Boolean)
      : [],
    source: source.value,
    source_other: source.other,
    photo: student.photo || null,
  };
}

export type CreateStudentPrefill = Partial<
  Pick<
    StudentRecord,
    | 'full_name'
    | 'email'
    | 'parent_name'
    | 'parent_phone'
    | 'parent2_name'
    | 'parent2_phone'
    | 'parent_relation'
    | 'parent2_relation'
    | 'notes'
    | 'birth_date'
    | 'school'
    | 'discount'
    | 'photo'
    | 'interested_courses'
    | 'source'
  >
>;

function mapPrefillToForm(prefill: CreateStudentPrefill): FormState {
  const fullName = (prefill.full_name || '').trim();
  const nameParts = fullName ? fullName.split(/\s+/) : [];
  const primaryRelation = normalizeOptionValue(prefill.parent_relation ?? null, RELATION_OPTIONS);
  const secondaryRelation = normalizeOptionValue(prefill.parent2_relation ?? null, RELATION_OPTIONS);
  const source = normalizeOptionValue(prefill.source ?? null, SOURCE_OPTIONS);

  const primaryPhone = prefill.parent_phone || null;
  return {
    ...EMPTY_FORM,
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' '),
    birth_date: normalizeDate(prefill.birth_date ?? null),
    email: prefill.email || '',
    school: prefill.school || '',
    discount: prefill.discount != null ? String(prefill.discount) : '',
    gender: detectGender(nameParts[0] || ''),
    parent_name: prefill.parent_name || '',
    parent_relation: primaryRelation.value,
    parent_relation_other: primaryRelation.other,
    parent_phone: extractPhoneDigits(primaryPhone),
    parent2_name: prefill.parent2_name || '',
    parent2_phone: extractPhoneDigits(prefill.parent2_phone),
    parent2_relation: secondaryRelation.value,
    parent2_relation_other: secondaryRelation.other,
    notes: prefill.notes || '',
    interested_courses: prefill.interested_courses
      ? String(prefill.interested_courses)
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map((item) => item.replace(/^"+|"+$/g, '').trim())
          .filter(Boolean)
      : [],
    source: source.value,
    source_other: source.other,
    photo: prefill.photo || null,
  };
}

export default function CreateStudentModal({
  isOpen,
  onClose,
  onCreated,
  studentToEdit,
  prefill,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (createdStudentId?: number) => void;
  studentToEdit?: StudentRecord | null;
  prefill?: CreateStudentPrefill | null;
}) {
  const firstNameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [studentFormStep, setStudentFormStep] = useState<'profile' | 'contacts' | 'extra'>('profile');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropImageName, setCropImageName] = useState('');
  const [nameSuggestions, setNameSuggestions] = useState<AutocompleteStudent[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastNameSuggestions, setLastNameSuggestions] = useState<AutocompleteStudent[]>([]);
  const [showLastNameSuggestions, setShowLastNameSuggestions] = useState(false);
  const [schoolSuggestions, setSchoolSuggestions] = useState<string[]>([]);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [schools, setSchools] = useState<string[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (studentToEdit) {
      setForm(mapStudentToForm(studentToEdit));
    } else if (prefill) {
      setForm(mapPrefillToForm(prefill));
    } else {
      setForm(EMPTY_FORM);
    }
    setStudentFormStep('profile');
    setErrors({});
    setNameSuggestions([]);
    setLastNameSuggestions([]);
    setSchoolSuggestions([]);
    setShowSuggestions(false);
    setShowLastNameSuggestions(false);
    setShowSchoolSuggestions(false);
    setCoursesDropdownOpen(false);
    setPhotoFile(null);
    setCropModalOpen(false);
    setCropImageSrc(null);
    setCropImageName('');
    setTimeout(() => firstNameRef.current?.focus(), 0);

    const loadOptions = async () => {
      try {
        const [schoolsRes, coursesRes] = await Promise.all([
          fetch('/api/students?schoolOptions=true'),
          fetch('/api/courses'),
        ]);

        if (schoolsRes.ok) {
          const schoolsData = await schoolsRes.json();
          setSchools(schoolsData.schools || []);
        }

        if (coursesRes.ok) {
          const coursesData = await coursesRes.json();
          setCourses((coursesData.courses || []).filter((course: Course) => course.is_active !== false));
        }
      } catch (error) {
        console.error('Failed to load student modal options:', error);
      }
    };

    void loadOptions();
  }, [isOpen, studentToEdit, prefill]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.autocomplete-container')) {
        setShowSuggestions(false);
        setShowLastNameSuggestions(false);
        setShowSchoolSuggestions(false);
      }
      if (!target.closest('.courses-dropdown')) {
        setCoursesDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  const reset = () => {
    setForm(EMPTY_FORM);
    setStudentFormStep('profile');
    setErrors({});
    setNameSuggestions([]);
    setLastNameSuggestions([]);
    setSchoolSuggestions([]);
    setShowSuggestions(false);
    setShowLastNameSuggestions(false);
    setShowSchoolSuggestions(false);
    setCoursesDropdownOpen(false);
    setPhotoFile(null);
    setCropModalOpen(false);
    setCropImageSrc(null);
    setCropImageName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const close = () => {
    reset();
    onClose();
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.first_name.trim()) next.first_name = t('validation.required');
    if (!form.last_name.trim()) next.last_name = t('validation.required');
    if (form.parent_phone.length !== 9) next.parent_phone = t('validation.required');
    if (!form.parent_name.trim()) next.parent_name = t('validation.required');
    if (!form.parent_relation) next.parent_relation = t('validation.required');
    if (form.parent_relation === 'other' && !form.parent_relation_other.trim()) next.parent_relation_other = t('validation.required');
    if (form.parent2_relation === 'other' && !form.parent2_relation_other.trim()) next.parent2_relation_other = t('validation.required');
    if (form.source === 'other' && !form.source_other.trim()) next.source_other = t('validation.required');
    if (form.email.trim() && !isValidEmail(form.email)) next.email = t('validation.invalidEmail');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const searchStudentNames = async (query: string) => {
    if (query.trim().length < 3) {
      setNameSuggestions([]);
      return;
    }

    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      const uniqueFirstNames = new Map<string, AutocompleteStudent>();

      for (const student of data.students || []) {
        const firstName = String(student.full_name || '').trim().split(/\s+/)[0];
        if (firstName && !uniqueFirstNames.has(firstName.toLowerCase())) {
          uniqueFirstNames.set(firstName.toLowerCase(), {
            id: student.id,
            full_name: firstName,
            parent_name: null,
          });
        }
      }

      setNameSuggestions(Array.from(uniqueFirstNames.values()));
    } catch (error) {
      console.error('Failed to search student names:', error);
    }
  };

  const searchStudentLastNames = async (query: string) => {
    if (query.trim().length < 3) {
      setLastNameSuggestions([]);
      return;
    }

    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      const uniqueLastNames = new Map<string, AutocompleteStudent>();

      for (const student of data.students || []) {
        const parts = String(student.full_name || '').trim().split(/\s+/);
        const lastName = parts.slice(1).join(' ').trim();
        if (lastName && !uniqueLastNames.has(lastName)) {
          uniqueLastNames.set(lastName, {
            id: student.id,
            full_name: lastName,
            parent_name: null,
          });
        }
      }

      setLastNameSuggestions(Array.from(uniqueLastNames.values()));
    } catch (error) {
      console.error('Failed to search student last names:', error);
    }
  };

  const searchSchools = (query: string) => {
    if (query.trim().length < 3) {
      setSchoolSuggestions([]);
      return;
    }

    const normalizedQuery = query.toLowerCase();
    setSchoolSuggestions(schools.filter((school) => school.toLowerCase().includes(normalizedQuery)).slice(0, 10));
  };

  const handleFirstNameChange = async (value: string) => {
    const detected = detectGender(value);
    setForm((prev) => ({ ...prev, first_name: value, gender: detected || prev.gender }));
    await searchStudentNames(value);
    setShowSuggestions(value.trim().length >= 3);
  };

  const handleLastNameChange = async (value: string) => {
    setForm((prev) => ({ ...prev, last_name: value }));
    await searchStudentLastNames(value);
    setShowLastNameSuggestions(value.trim().length >= 3);
  };

  const handleSchoolChange = (value: string) => {
    setForm((prev) => ({ ...prev, school: value }));
    searchSchools(value);
    setShowSchoolSuggestions(value.trim().length >= 3);
  };

  const handleSelectSuggestion = (student: AutocompleteStudent) => {
    setForm((prev) => ({
      ...prev,
      first_name: student.full_name || prev.first_name,
    }));
    setShowSuggestions(false);
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setCropImageSrc(String(reader.result || ''));
      setCropImageName(file.name);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const resetPhotoPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropCancel = () => {
    setCropModalOpen(false);
    setCropImageSrc(null);
    setCropImageName('');
    resetPhotoPicker();
  };

  const handleCropApply = (croppedDataUrl: string, croppedFile: File | null) => {
    setForm((prev) => ({ ...prev, photo: croppedDataUrl }));
    setPhotoFile(croppedFile);
    setCropModalOpen(false);
    setCropImageSrc(null);
    setCropImageName('');
    resetPhotoPicker();
  };

  const removePhoto = () => {
    setForm((prev) => ({ ...prev, photo: null }));
    setPhotoFile(null);
    resetPhotoPicker();
  };

  const toggleCourse = (title: string) => {
    setForm((prev) => ({
      ...prev,
      interested_courses: prev.interested_courses.includes(title)
        ? prev.interested_courses.filter((course) => course !== title)
        : [...prev.interested_courses, title],
    }));
  };

  const save = async () => {
    if (!validate()) return;

    setSaving(true);
    const isEditing = Boolean(studentToEdit);
    try {
      let photoUrl = form.photo;
      if (photoFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', photoFile);
        uploadFormData.append('folder', 'students');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => ({ error: 'Не вдалося завантажити фото' }));
          alert(`Помилка завантаження фото: ${uploadData.error || uploadRes.statusText}`);
          return;
        }

        const uploadData = await uploadRes.json();
        photoUrl = uploadData.url || null;
      } else if (photoUrl && photoUrl.startsWith('data:')) {
        const uploadFormData = new FormData();
        const photoBlob = await fetch(photoUrl).then((response) => response.blob());
        uploadFormData.append('file', new File([photoBlob], 'student-photo.png', { type: photoBlob.type || 'image/png' }));
        uploadFormData.append('folder', 'students');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => ({ error: 'Не вдалося завантажити фото' }));
          alert(`Помилка завантаження фото: ${uploadData.error || uploadRes.statusText}`);
          return;
        }

        const uploadData = await uploadRes.json();
        photoUrl = uploadData.url || null;
      }

      const res = await fetch(isEditing ? `/api/students/${studentToEdit!.id}` : '/api/students', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
          email: form.email || null,
          parent_name: form.parent_name,
          parent_phone: form.parent_phone ? `+380${form.parent_phone}` : null,
          notes: form.notes,
          birth_date: form.birth_date || null,
          school: form.school || null,
          discount: form.discount || null,
          gender: form.gender || null,
          parent_relation: form.parent_relation === 'other' ? form.parent_relation_other.trim() : form.parent_relation,
          parent2_name: form.parent2_name || null,
          parent2_phone: form.parent2_phone ? `+380${form.parent2_phone}` : null,
          parent2_relation: form.parent2_relation === 'other' ? form.parent2_relation_other.trim() : (form.parent2_relation || null),
          interested_courses: form.interested_courses.join(', '),
          source: form.source === 'other' ? form.source_other.trim() : (form.source || ''),
          photo: photoUrl,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Помилка збереження: ${errorData.error || res.statusText}`);
        return;
      }

      let createdId: number | undefined;
      try {
        const resJson = await res.clone().json();
        if (typeof resJson?.id === 'number') createdId = resJson.id;
      } catch {
        // PUT responses may be empty or non-JSON — that's fine, we only surface IDs for creation.
      }

      close();
      onCreated?.(isEditing ? undefined : createdId);
    } catch (error) {
      console.error('Failed to save student:', error);
      alert('Помилка мережі. Спробуйте ще раз.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isEditing = Boolean(studentToEdit);

  return (
    <div className="modal-overlay" onClick={close}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '820px',
          maxHeight: '90vh',
          overflow: 'hidden',
          borderRadius: '24px',
          border: '1px solid #e2e8f0',
          backgroundColor: '#f7f9fc',
          boxShadow: '0 28px 70px rgba(15, 23, 42, 0.16)',
        }}
      >
        <div className="modal-header" style={{ alignItems: 'flex-start', padding: '1.4rem 1.5rem 1.2rem', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%)' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0.35rem 0.75rem', borderRadius: '999px', backgroundColor: '#eaf2ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.85rem' }}>
              {isEditing ? 'Редагування профілю' : 'Новий учень'}
            </div>
            <h3 className="modal-title" style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
              {isEditing ? t('modals.editStudent') : t('modals.newStudent')}
            </h3>
          </div>
          <button className="modal-close" onClick={close} style={{ fontSize: '1.75rem', lineHeight: 1, padding: '0.25rem', color: '#94a3b8' }}>
            ×
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: 'calc(92vh - 235px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {([
              { id: 'profile', index: '01', title: 'Профіль', description: 'Ім’я, дата, школа, фото' },
              { id: 'contacts', index: '02', title: 'Контакти', description: 'Основний і додатковий контакт' },
              { id: 'extra', index: '03', title: 'Додатково', description: 'Інтереси та нотатки' },
            ] as const).map((step) => {
              const isActive = studentFormStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setStudentFormStep(step.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.8rem',
                    width: '100%',
                    padding: '0.95rem 1rem',
                    borderRadius: '18px',
                    border: isActive ? '1px solid #93c5fd' : '1px solid #dbe4f0',
                    backgroundColor: isActive ? '#ffffff' : 'rgba(255,255,255,0.72)',
                    boxShadow: isActive ? '0 10px 24px rgba(37, 99, 235, 0.12)' : 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: '38px', height: '38px', flexShrink: 0, borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, backgroundColor: isActive ? '#2563eb' : '#eaf2ff', color: isActive ? '#ffffff' : '#2563eb' }}>
                    {step.index}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a' }}>{step.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.35 }}>{step.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {studentFormStep === 'profile' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
                <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', padding: '1.5rem', textAlign: 'center', position: 'sticky', top: 0 }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: '#0f172a', textAlign: 'left' }}>
                    {t('forms.photo')}
                  </div>
                  <div
                    style={{
                      width: '144px',
                      height: '144px',
                      borderRadius: '50%',
                      margin: '0 auto 1rem',
                      overflow: 'hidden',
                      background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '3px solid #e0e7ff',
                    }}
                  >
                    {form.photo ? (
                      <img src={form.photo} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '3rem', fontWeight: 700, color: '#4f46e5' }}>
                        {form.first_name ? getFirstLetter(form.first_name) : '?'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                      {form.photo ? t('forms.changePhoto') : t('forms.uploadPhoto')}
                    </button>
                    {form.photo && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={removePhoto}>
                        {t('forms.removePhoto')}
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                </div>

                <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', padding: '1.5rem' }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: '#0f172a' }}>Основна інформація</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div className="form-group autocomplete-container" style={{ margin: 0, position: 'relative' }}>
                      <label className="form-label">{t('forms.firstName')} *</label>
                      <input
                        ref={firstNameRef}
                        className={`form-input ${errors.first_name ? 'form-input-error' : ''}`}
                        value={form.first_name}
                        onChange={(e) => void handleFirstNameChange(e.target.value)}
                        onFocus={() => form.first_name.trim().length >= 3 && setShowSuggestions(true)}
                        autoComplete="off"
                      />
                      {errors.first_name && <span className="form-error">{errors.first_name}</span>}
                      {showSuggestions && nameSuggestions.length > 0 && (
                        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.375rem', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', listStyle: 'none', margin: '0.25rem 0 0', padding: 0, zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                          {nameSuggestions.map((student) => (
                            <li key={student.id} onClick={() => handleSelectSuggestion(student)} style={{ padding: '0.625rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                              {student.full_name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="form-group autocomplete-container" style={{ margin: 0, position: 'relative' }}>
                      <label className="form-label">{t('forms.lastName')} *</label>
                      <input
                        className={`form-input ${errors.last_name ? 'form-input-error' : ''}`}
                        value={form.last_name}
                        onChange={(e) => void handleLastNameChange(e.target.value)}
                        onFocus={() => form.last_name.trim().length >= 3 && setShowLastNameSuggestions(true)}
                        autoComplete="off"
                      />
                      {errors.last_name && <span className="form-error">{errors.last_name}</span>}
                      {showLastNameSuggestions && lastNameSuggestions.length > 0 && (
                        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.375rem', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', listStyle: 'none', margin: '0.25rem 0 0', padding: 0, zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                          {lastNameSuggestions.map((student) => (
                            <li
                              key={`${student.id}-${student.full_name}`}
                              onClick={() => {
                                setForm((prev) => ({ ...prev, last_name: student.full_name }));
                                setShowLastNameSuggestions(false);
                              }}
                              style={{ padding: '0.625rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                            >
                              {student.full_name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{t('forms.birthDate')}</label>
                      <input type="date" className="form-input" value={form.birth_date} onChange={(e) => setForm((prev) => ({ ...prev, birth_date: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Стать</label>
                      <select
                        className="form-select"
                        value={form.gender}
                        onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value as '' | 'male' | 'female' }))}
                      >
                        <option value="">Не вказано</option>
                        <option value="female">Жіноча</option>
                        <option value="male">Чоловіча</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className={`form-input ${errors.email ? 'form-input-error' : ''}`}
                        value={form.email}
                        placeholder="student@example.com"
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((prev) => ({ ...prev, email: value }));
                          setErrors((prev) => {
                            if (!prev.email) return prev;
                            const next = { ...prev };
                            delete next.email;
                            return next;
                          });
                        }}
                        onBlur={() => {
                          if (!form.email.trim() || isValidEmail(form.email)) return;
                          setErrors((prev) => ({ ...prev, email: t('validation.invalidEmail') }));
                        }}
                      />
                      {errors.email && <span className="form-error">{errors.email}</span>}
                    </div>

                    <div className="form-group autocomplete-container" style={{ margin: 0, position: 'relative' }}>
                      <label className="form-label">{t('forms.school')}</label>
                      <input
                        className="form-input"
                        value={form.school}
                        placeholder="Назва школи"
                        onChange={(e) => handleSchoolChange(e.target.value)}
                        onFocus={() => form.school.trim().length >= 3 && setShowSchoolSuggestions(true)}
                        autoComplete="off"
                                             />
                      {showSchoolSuggestions && schoolSuggestions.length > 0 && (
                        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.375rem', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', listStyle: 'none', margin: '0.25rem 0 0', padding: 0, zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                          {schoolSuggestions.map((school) => (
                            <li
                              key={school}
                              onClick={() => {
                                setForm((prev) => ({ ...prev, school }));
                                setShowSchoolSuggestions(false);
                              }}
                              style={{ padding: '0.625rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                            >
                              {school}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{t('forms.discount')}</label>
                      <div style={{ display: 'flex', alignItems: 'stretch' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="form-input"
                          value={form.discount}
                          onChange={(e) => setForm((prev) => ({ ...prev, discount: e.target.value.replace(/[^0-9]/g, '') }))}
                          style={{ width: '100%', borderRadius: '0.375rem 0 0 0.375rem', borderRight: 'none' }}
                          placeholder="10"
                        />
                        <span style={{ width: '40px', minWidth: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderLeft: 'none', borderRadius: '0 0.375rem 0.375rem 0', color: '#374151', fontSize: '0.875rem', fontWeight: 500, boxSizing: 'border-box' }}>
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {studentFormStep === 'contacts' && (
            <>
              <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', padding: '1.25rem 1.5rem', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#0f172a' }}>Основний контакт</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Номер телефону *</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: errors.parent_phone ? '1px solid #ef4444' : '1px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#fff', overflow: 'hidden' }}>
                      <span style={{ padding: '0.625rem 0.75rem', backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 500, fontSize: '0.875rem', borderRight: '1px solid #d1d5db' }}>+380</span>
                      <input className="form-input" value={form.parent_phone} onChange={(e) => setForm((prev) => ({ ...prev, parent_phone: formatPhoneNumber(e.target.value) }))} maxLength={9} style={{ flex: 1, border: 'none', outline: 'none', padding: '0.625rem 0.75rem' }} />
                    </div>
                    {errors.parent_phone && <span className="form-error">{errors.parent_phone}</span>}
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{"Ім'я контактної особи *"}</label>
                    <input className={`form-input ${errors.parent_name ? 'form-input-error' : ''}`} value={form.parent_name} onChange={(e) => setForm((prev) => ({ ...prev, parent_name: e.target.value }))} />
                    {errors.parent_name && <span className="form-error">{errors.parent_name}</span>}
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Хто це для дитини *</label>
                    <select className={`form-input ${errors.parent_relation ? 'form-input-error' : ''}`} value={form.parent_relation} onChange={(e) => setForm((prev) => ({ ...prev, parent_relation: e.target.value }))}>
                      <option value="">Оберіть...</option>
                      {RELATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {errors.parent_relation && <span className="form-error">{errors.parent_relation}</span>}
                  </div>
                </div>
                {form.parent_relation === 'other' && (
                  <div className="form-group" style={{ marginTop: '0.75rem' }}>
                    <label className="form-label">{t('forms.relationOther')}</label>
                    <input
                      className={`form-input ${errors.parent_relation_other ? 'form-input-error' : ''}`}
                      value={form.parent_relation_other}
                      placeholder={t('forms.relationOtherPlaceholder')}
                      onChange={(e) => setForm((prev) => ({ ...prev, parent_relation_other: e.target.value }))}
                    />
                    {errors.parent_relation_other && <span className="form-error">{errors.parent_relation_other}</span>}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', padding: '1.25rem 1.5rem' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#0f172a' }}>Додатковий контакт</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Номер телефону</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#fff', overflow: 'hidden' }}>
                      <span style={{ padding: '0.625rem 0.75rem', backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 500, fontSize: '0.875rem', borderRight: '1px solid #d1d5db' }}>+380</span>
                      <input className="form-input" value={form.parent2_phone} onChange={(e) => setForm((prev) => ({ ...prev, parent2_phone: formatPhoneNumber(e.target.value) }))} maxLength={9} style={{ flex: 1, border: 'none', outline: 'none', padding: '0.625rem 0.75rem' }} />
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{"Ім'я контактної особи"}</label>
                    <input className="form-input" value={form.parent2_name} onChange={(e) => setForm((prev) => ({ ...prev, parent2_name: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Хто це для дитини</label>
                    <select className="form-input" value={form.parent2_relation} onChange={(e) => setForm((prev) => ({ ...prev, parent2_relation: e.target.value }))}>
                      <option value="">Оберіть...</option>
                      {RELATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {form.parent2_relation === 'other' && (
                  <div className="form-group" style={{ marginTop: '0.75rem' }}>
                    <label className="form-label">{t('forms.relationOther')}</label>
                    <input
                      className={`form-input ${errors.parent2_relation_other ? 'form-input-error' : ''}`}
                      value={form.parent2_relation_other}
                      placeholder={t('forms.relationOtherPlaceholder')}
                      onChange={(e) => setForm((prev) => ({ ...prev, parent2_relation_other: e.target.value }))}
                    />
                    {errors.parent2_relation_other && <span className="form-error">{errors.parent2_relation_other}</span>}
                  </div>
                )}
              </div>
            </>
          )}

          {studentFormStep === 'extra' && (
            <>
              <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', padding: '1.5rem' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: '#0f172a' }}>Додаткова інформація</div>
                <div className="form-group courses-dropdown" style={{ position: 'relative' }}>
                  <label className="form-label">{t('forms.interestedCourses')}</label>
                  <div
                    onClick={() => setCoursesDropdownOpen((prev) => !prev)}
                    style={{ border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', backgroundColor: '#fff', cursor: 'pointer', minHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <span style={{ color: form.interested_courses.length > 0 ? '#111827' : '#9ca3af', fontSize: '0.875rem' }}>
                      {form.interested_courses.length > 0 ? `${form.interested_courses.length} обрано` : t('forms.interestedCoursesPlaceholder')}
                    </span>
                    <span style={{ color: '#64748b' }}>▾</span>
                  </div>
                  {coursesDropdownOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, border: '1px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#fff', maxHeight: '220px', overflowY: 'auto', zIndex: 10, marginTop: '0.25rem', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)' }}>
                      {courses.map((course) => (
                        <label key={course.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                          <input type="checkbox" checked={form.interested_courses.includes(course.title)} onChange={() => toggleCourse(course.title)} />
                          <span>{course.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {form.interested_courses.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
                      {form.interested_courses.map((courseName) => (
                        <span
                          key={courseName}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#dbeafe',
                            color: '#1d4ed8',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          {courseName}
                          <button
                            type="button"
                            onClick={() => toggleCourse(courseName)}
                            style={{ background: 'none', border: 'none', color: '#1d4ed8', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label className="form-label">{t('forms.source')}</label>
                  <select className="form-input" value={form.source} onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}>
                    <option value="">{t('forms.sourcePlaceholder')}</option>
                    {SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                {form.source === 'other' && (
                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label className="form-label">{t('forms.sourceOther')}</label>
                    <input
                      className={`form-input ${errors.source_other ? 'form-input-error' : ''}`}
                      value={form.source_other}
                      placeholder={t('forms.sourceOtherPlaceholder')}
                      onChange={(e) => setForm((prev) => ({ ...prev, source_other: e.target.value }))}
                    />
                    {errors.source_other && <span className="form-error">{errors.source_other}</span>}
                  </div>
                )}

                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label className="form-label">{t('forms.note')}</label>
                  <textarea className="form-input" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} style={{ resize: 'vertical', minHeight: '90px' }} />
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '1rem 1.5rem 1.25rem', borderTop: '1px solid #e2e8f0', backgroundColor: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {studentFormStep === 'profile' && 'Крок 1 з 3 · Основні дані'}
            {studentFormStep === 'contacts' && 'Крок 2 з 3 · Контакти для зв’язку'}
            {studentFormStep === 'extra' && 'Крок 3 з 3 · Завершення профілю'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={close}>{t('actions.cancel')}</button>
            {studentFormStep !== 'profile' && (
              <button type="button" className="btn btn-secondary" onClick={() => setStudentFormStep(studentFormStep === 'extra' ? 'contacts' : 'profile')}>
                Назад
              </button>
            )}
            {studentFormStep !== 'extra' ? (
              <button type="button" className="btn btn-primary" onClick={() => setStudentFormStep(studentFormStep === 'profile' ? 'contacts' : 'extra')}>
                Далі
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? t('common.saving') : t('actions.save')}
              </button>
            )}
          </div>
        </div>
      </div>

      <StudentAvatarCropModal
        isOpen={cropModalOpen}
        imageSrc={cropImageSrc}
        fileName={cropImageName}
        onCancel={handleCropCancel}
        onApply={handleCropApply}
      />
    </div>
  );
}
