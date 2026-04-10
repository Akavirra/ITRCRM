'use client';

import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n/t';

export type StudentRecord = {
  id: number;
  full_name: string;
  phone: string | null;
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
};

type FormState = {
  first_name: string;
  last_name: string;
  birth_date: string;
  email: string;
  school: string;
  discount: string;
  phone: string;
  parent_name: string;
  parent_relation: string;
  parent_phone: string;
  parent2_name: string;
  parent2_phone: string;
  parent2_relation: string;
  notes: string;
  interested_courses: string[];
  source: string;
  photo: string | null;
};

const EMPTY_FORM: FormState = {
  first_name: '',
  last_name: '',
  birth_date: '',
  email: '',
  school: '',
  discount: '',
  phone: '',
  parent_name: '',
  parent_relation: '',
  parent_phone: '',
  parent2_name: '',
  parent2_phone: '',
  parent2_relation: '',
  notes: '',
  interested_courses: [],
  source: '',
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

function extractPhoneDigits(value?: string | null) {
  return value ? value.replace(/\D/g, '').slice(-9) : '';
}

function normalizeDate(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function mapStudentToForm(student: StudentRecord): FormState {
  const nameParts = student.full_name.trim().split(/\s+/);

  return {
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' '),
    birth_date: normalizeDate(student.birth_date),
    email: student.email || '',
    school: student.school || '',
    discount: student.discount != null ? String(student.discount) : '',
    phone: extractPhoneDigits(student.phone),
    parent_name: student.parent_name || '',
    parent_relation: student.parent_relation || '',
    parent_phone: extractPhoneDigits(student.parent_phone),
    parent2_name: student.parent2_name || '',
    parent2_phone: extractPhoneDigits(student.parent2_phone),
    parent2_relation: student.parent2_relation || '',
    notes: student.notes || '',
    interested_courses: student.interested_courses
      ? student.interested_courses
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map((item) => item.replace(/^"+|"+$/g, '').trim())
          .filter(Boolean)
      : [],
    source: student.source || '',
    photo: student.photo || null,
  };
}

export default function CreateStudentModal({
  isOpen,
  onClose,
  onCreated,
  studentToEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  studentToEdit?: StudentRecord | null;
}) {
  const firstNameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [studentFormStep, setStudentFormStep] = useState<'profile' | 'contacts' | 'extra'>('profile');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setForm(studentToEdit ? mapStudentToForm(studentToEdit) : EMPTY_FORM);
    setStudentFormStep('profile');
    setErrors({});
    setTimeout(() => firstNameRef.current?.focus(), 0);
  }, [isOpen, studentToEdit]);

  const reset = () => {
    setForm(EMPTY_FORM);
    setStudentFormStep('profile');
    setErrors({});
  };

  const close = () => {
    reset();
    onClose();
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.first_name.trim()) next.first_name = t('validation.required');
    if (!form.last_name.trim()) next.last_name = t('validation.required');
    if (form.phone.length !== 9) next.phone = t('validation.required');
    if (!form.parent_name.trim()) next.parent_name = t('validation.required');
    if (!form.parent_relation) next.parent_relation = t('validation.required');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;

    setSaving(true);
    const isEditing = Boolean(studentToEdit);
    try {
      const res = await fetch(isEditing ? `/api/students/${studentToEdit!.id}` : '/api/students', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
          phone: `+380${form.phone}`,
          email: form.email || null,
          parent_name: form.parent_name,
          parent_phone: form.parent_phone ? `+380${form.parent_phone}` : null,
          notes: form.notes,
          birth_date: form.birth_date || null,
          school: form.school || null,
          discount: form.discount || null,
          parent_relation: form.parent_relation,
          parent2_name: form.parent2_name || null,
          parent2_phone: form.parent2_phone ? `+380${form.parent2_phone}` : null,
          parent2_relation: form.parent2_relation || null,
          interested_courses: isEditing ? form.interested_courses.join(', ') : form.interested_courses,
          source: form.source || '',
          photo: form.photo,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Помилка збереження: ${errorData.error || res.statusText}`);
        return;
      }

      close();
      onCreated?.();
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
          maxWidth: '720px',
          maxHeight: '90vh',
          overflow: 'hidden',
          borderRadius: '24px',
          border: '1px solid #e2e8f0',
          backgroundColor: '#f7f9fc',
          boxShadow: '0 28px 70px rgba(15, 23, 42, 0.16)',
        }}
      >
        <div className="modal-header" style={{ padding: '1.4rem 1.5rem 1.2rem', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0.35rem 0.75rem', borderRadius: '999px', backgroundColor: '#eaf2ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.85rem' }}>
                {isEditing ? 'Редагування профілю' : 'Новий учень'}
              </div>
              <h3 className="modal-title" style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                {isEditing ? t('modals.editStudent') : t('modals.newStudent')}
              </h3>
            </div>
            <button className="modal-close" onClick={close} style={{ fontSize: '1.5rem', lineHeight: 1, padding: '0.25rem' }}>
              ×
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: 'calc(92vh - 235px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {([
              { id: 'profile', index: '01', title: 'Профіль', description: 'Ім’я, школа, фото' },
              { id: 'contacts', index: '02', title: 'Контакти', description: 'Телефони й родина' },
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

          <div style={{ display: studentFormStep === 'profile' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t('forms.firstName')} *</label>
              <input ref={firstNameRef} className={`form-input ${errors.first_name ? 'form-input-error' : ''}`} value={form.first_name} onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))} />
              {errors.first_name && <span className="form-error">{errors.first_name}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">{t('forms.lastName')} *</label>
              <input className={`form-input ${errors.last_name ? 'form-input-error' : ''}`} value={form.last_name} onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))} />
              {errors.last_name && <span className="form-error">{errors.last_name}</span>}
            </div>
          </div>

          <div style={{ display: studentFormStep === 'contacts' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t('forms.additionalPhone')}</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#fff', overflow: 'hidden' }}>
                <span style={{ padding: '0.625rem 0.75rem', backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 500, fontSize: '0.875rem', borderRight: '1px solid #d1d5db' }}>+380</span>
                <input className="form-input" value={form.parent_phone} onChange={(e) => setForm((prev) => ({ ...prev, parent_phone: formatPhoneNumber(e.target.value) }))} maxLength={9} style={{ flex: 1, border: 'none', outline: 'none', padding: '0.625rem 0.75rem' }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('forms.contactName')}</label>
              <input className="form-input" value={form.parent2_name} onChange={(e) => setForm((prev) => ({ ...prev, parent2_name: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: studentFormStep === 'contacts' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t('forms.additionalPhone')}</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#fff', overflow: 'hidden' }}>
                <span style={{ padding: '0.625rem 0.75rem', backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 500, fontSize: '0.875rem', borderRight: '1px solid #d1d5db' }}>+380</span>
                <input className="form-input" value={form.parent2_phone} onChange={(e) => setForm((prev) => ({ ...prev, parent2_phone: formatPhoneNumber(e.target.value) }))} maxLength={9} style={{ flex: 1, border: 'none', outline: 'none', padding: '0.625rem 0.75rem' }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('forms.whoIsThis')}</label>
              <select className="form-input" value={form.parent2_relation} onChange={(e) => setForm((prev) => ({ ...prev, parent2_relation: e.target.value }))}>
                <option value="">{t('forms.whoIsThisPlaceholder')}</option>
                {RELATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: studentFormStep === 'contacts' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t('forms.mainPhone')} *</label>
              <div style={{ display: 'flex', alignItems: 'center', border: errors.phone ? '1px solid #ef4444' : '1px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#fff', overflow: 'hidden' }}>
                <span style={{ padding: '0.625rem 0.75rem', backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 500, fontSize: '0.875rem', borderRight: '1px solid #d1d5db' }}>+380</span>
                <input className="form-input" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))} maxLength={9} style={{ flex: 1, border: 'none', outline: 'none', padding: '0.625rem 0.75rem' }} />
              </div>
              {errors.phone && <span className="form-error">{errors.phone}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">{t('forms.birthDate')}</label>
              <input type="date" className="form-input" value={form.birth_date} onChange={(e) => setForm((prev) => ({ ...prev, birth_date: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: studentFormStep === 'contacts' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t('forms.contactName')} *</label>
              <input className={`form-input ${errors.parent_name ? 'form-input-error' : ''}`} value={form.parent_name} onChange={(e) => setForm((prev) => ({ ...prev, parent_name: e.target.value }))} />
              {errors.parent_name && <span className="form-error">{errors.parent_name}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">{t('forms.whoIsThis')} *</label>
              <select className={`form-input ${errors.parent_relation ? 'form-input-error' : ''}`} value={form.parent_relation} onChange={(e) => setForm((prev) => ({ ...prev, parent_relation: e.target.value }))}>
                <option value="">{t('forms.whoIsThisPlaceholder')}</option>
                {RELATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errors.parent_relation && <span className="form-error">{errors.parent_relation}</span>}
            </div>
          </div>

          <div style={{ display: studentFormStep === 'profile' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('forms.school')}</label>
              <input className="form-input" value={form.school} onChange={(e) => setForm((prev) => ({ ...prev, school: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: studentFormStep === 'extra' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t('forms.discount')}</label>
              <input type="number" min="0" max="100" className="form-input" value={form.discount} onChange={(e) => setForm((prev) => ({ ...prev, discount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('forms.note')}</label>
              <input className="form-input" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: studentFormStep === 'extra' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t('forms.interestedCourses')}</label>
              <input className="form-input" value={form.interested_courses.join(', ')} onChange={(e) => setForm((prev) => ({ ...prev, interested_courses: e.target.value ? e.target.value.split(',').map((v) => v.trim()).filter(Boolean) : [] }))} placeholder={t('forms.interestedCoursesPlaceholder')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('forms.source')}</label>
              <select className="form-input" value={form.source} onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}>
                <option value="">{t('forms.sourcePlaceholder')}</option>
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
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
    </div>
  );
}

