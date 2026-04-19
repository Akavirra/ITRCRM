'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

const RELATIONS = [
  { value: 'mother', label: 'Мама' },
  { value: 'father', label: 'Тато' },
  { value: 'grandmother', label: 'Бабуся' },
  { value: 'grandfather', label: 'Дідусь' },
  { value: 'other', label: 'Інше' },
];

const SOURCE_OPTIONS = [
  { value: 'social', label: 'Соціальні мережі' },
  { value: 'friends', label: 'Знайомі / рекомендації' },
  { value: 'search', label: 'Пошук в інтернеті' },
  { value: 'other', label: 'Інше' },
];

type FormState = 'loading' | 'form' | 'submitting' | 'success' | 'error';
type ContactKey = 'parent' | 'parent2';

type CourseOption = {
  id: number;
  title: string;
  public_id: string;
};

interface FormData {
  child_first_name: string;
  child_last_name: string;
  birth_date: string;
  school: string;
  email: string;
  parent_name: string;
  parent_phone: string;
  parent_relation: string;
  parent_relation_other: string;
  parent2_name: string;
  parent2_phone: string;
  parent2_relation: string;
  parent2_relation_other: string;
  interested_courses: string[];
  notes: string;
  source: string;
  source_other: string;
}

const initialFormData: FormData = {
  child_first_name: '',
  child_last_name: '',
  birth_date: '',
  school: '',
  email: '',
  parent_name: '',
  parent_phone: '',
  parent_relation: '',
  parent_relation_other: '',
  parent2_name: '',
  parent2_phone: '',
  parent2_relation: '',
  parent2_relation_other: '',
  interested_courses: [],
  notes: '',
  source: '',
  source_other: '',
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 3) return `+${digits}`;
  if (digits.length <= 5) return `+${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 8) return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  if (digits.length <= 10) return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
}

function normalizePhoneInput(value: string, allowEmpty = false) {
  let digits = value.replace(/\D/g, '');

  if (!digits) {
    return allowEmpty ? '' : '+380';
  }

  if (!digits.startsWith('380')) {
    if (digits.startsWith('0')) {
      digits = `38${digits}`;
    } else if (digits.startsWith('80')) {
      digits = `3${digits}`;
    } else if (!digits.startsWith('3')) {
      digits = `380${digits}`;
    }
  }

  digits = digits.slice(0, 12);
  return `+${digits}`;
}

function getRelationValue(formData: FormData, key: ContactKey) {
  return key === 'parent' ? formData.parent_relation : formData.parent2_relation;
}

function getRelationOtherValue(formData: FormData, key: ContactKey) {
  return key === 'parent' ? formData.parent_relation_other : formData.parent2_relation_other;
}

function getContactNameValue(formData: FormData, key: ContactKey) {
  return key === 'parent' ? formData.parent_name : formData.parent2_name;
}

function getContactPhoneValue(formData: FormData, key: ContactKey) {
  return key === 'parent' ? formData.parent_phone : formData.parent2_phone;
}

export default function EnrollPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<FormState>('loading');
  const [errorReason, setErrorReason] = useState('');
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesOpen, setCoursesOpen] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/enroll/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setState('form');
        } else {
          setState('error');
          setErrorReason(data.reason || 'unknown');
        }
      })
      .catch(() => {
        setState('error');
        setErrorReason('network');
      });
  }, [token]);

  useEffect(() => {
    fetch('/api/public/courses')
      .then((res) => (res.ok ? res.json() : { courses: [] }))
      .then((data) => setCourses(Array.isArray(data.courses) ? data.courses : []))
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-courses-dropdown="true"]')) {
        setCoursesOpen(false);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const selectedCoursesLabel = useMemo(() => {
    if (formData.interested_courses.length === 0) return 'Оберіть курси, які зацікавили';
    if (formData.interested_courses.length === 1) return formData.interested_courses[0];
    return `Обрано курсів: ${formData.interested_courses.length}`;
  }, [formData.interested_courses]);

  const handleChange = (field: keyof FormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setValidationErrors([]);
  };

  const handlePhoneChange = (key: ContactKey, value: string) => {
    const normalized = normalizePhoneInput(value, key === 'parent2');
    if (key === 'parent') {
      handleChange('parent_phone', normalized);
      return;
    }
    handleChange('parent2_phone', normalized);
  };

  const toggleCourse = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      interested_courses: prev.interested_courses.includes(title)
        ? prev.interested_courses.filter((course) => course !== title)
        : [...prev.interested_courses, title],
    }));
    setValidationErrors([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    const errors: string[] = [];
    if (!formData.child_first_name.trim()) errors.push("Ім'я дитини обов'язкове");
    if (!formData.child_last_name.trim()) errors.push("Прізвище дитини обов'язкове");
    if (!formData.birth_date) errors.push("Дата народження обов'язкова");
    if (!formData.email.trim()) errors.push("Email обов'язковий");
    if (formData.email.trim() && !isValidEmail(formData.email)) errors.push('Вкажіть коректний email');
    if (!formData.parent_name.trim()) errors.push("Ім'я основного контакту обов'язкове");

    const primaryPhoneDigits = formData.parent_phone.replace(/\D/g, '');
    if (primaryPhoneDigits.length < 12) errors.push('Введіть повний номер основного контакту');

    if (!formData.parent_relation) errors.push('Оберіть, ким є основний контакт для дитини');
    if (formData.parent_relation === 'other' && !formData.parent_relation_other.trim()) {
      errors.push('Вкажіть, ким є основний контакт для дитини');
    }

    const hasSecondContactData = Boolean(
      formData.parent2_name.trim() ||
      formData.parent2_phone.trim() ||
      formData.parent2_relation ||
      formData.parent2_relation_other.trim()
    );

    if (hasSecondContactData) {
      const secondaryPhoneDigits = formData.parent2_phone.replace(/\D/g, '');
      if (!formData.parent2_name.trim()) errors.push("Ім'я додаткового контакту обов'язкове, якщо ви почали його заповнювати");
      if (secondaryPhoneDigits.length > 0 && secondaryPhoneDigits.length < 12) errors.push('Введіть повний номер додаткового контакту');
      if (!formData.parent2_relation) errors.push('Оберіть, ким є додатковий контакт для дитини');
      if (formData.parent2_relation === 'other' && !formData.parent2_relation_other.trim()) {
        errors.push('Вкажіть, ким є додатковий контакт для дитини');
      }
    }

    if (formData.source === 'other' && !formData.source_other.trim()) {
      errors.push('Уточніть, звідки ви дізналися про школу');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setState('submitting');

    const submitData = {
      ...formData,
      email: formData.email.trim(),
      parent_relation: formData.parent_relation === 'other'
        ? formData.parent_relation_other.trim()
        : formData.parent_relation,
      parent2_relation: formData.parent2_relation === 'other'
        ? formData.parent2_relation_other.trim()
        : formData.parent2_relation,
      source: formData.source === 'other'
        ? formData.source_other.trim()
        : formData.source,
      parent_phone: formData.parent_phone.replace(/\s/g, ''),
      parent2_phone: formData.parent2_phone ? formData.parent2_phone.replace(/\s/g, '') : '',
      interested_courses: formData.interested_courses,
    };

    try {
      const res = await fetch(`/api/enroll/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });
      const data = await res.json();

      if (res.ok) {
        setState('success');
      } else {
        setState('form');
        setValidationErrors(data.errors || [data.error || 'Помилка при відправці анкети']);
      }
    } catch {
      setState('form');
      setValidationErrors(['Помилка мережі. Спробуйте ще раз.']);
    }
  };

  const renderContactSection = (key: ContactKey, title: string, required = false) => {
    const relation = getRelationValue(formData, key);
    const relationOther = getRelationOtherValue(formData, key);
    const name = getContactNameValue(formData, key);
    const phone = getContactPhoneValue(formData, key);
    const phoneDisplayValue = phone && phone !== '+380' ? formatPhoneDisplay(phone) : '';
    const nameLabel = key === 'parent' ? "Ім'я контакту *" : "Ім'я контакту";
    const phoneLabel = key === 'parent' ? 'Телефон *' : 'Телефон';
    const relationLabel = key === 'parent' ? 'Ким є для дитини *' : 'Ким є для дитини';
    const relationOtherLabel = key === 'parent' ? 'Уточніть роль *' : 'Уточніть роль';

    return (
      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>{title}</legend>

        <div style={styles.contactGrid}>
          <div style={styles.field}>
            <label style={styles.label}>{nameLabel}</label>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => handleChange(key === 'parent' ? 'parent_name' : 'parent2_name', e.target.value)}
              placeholder="Ім'я та прізвище"
              required={required}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{phoneLabel}</label>
            <input
              type="tel"
              style={styles.input}
              value={phoneDisplayValue}
              onChange={(e) => handlePhoneChange(key, e.target.value)}
              placeholder="+380 XX XXX XX XX"
              required={required}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{relationLabel}</label>
            <select
              style={styles.input}
              value={relation}
              onChange={(e) => handleChange(key === 'parent' ? 'parent_relation' : 'parent2_relation', e.target.value)}
              required={required}
            >
              <option value="">Оберіть</option>
              {RELATIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {relation === 'other' && (
          <div style={styles.field}>
            <label style={styles.label}>{relationOtherLabel}</label>
            <input
              style={styles.input}
              value={relationOther}
              onChange={(e) => handleChange(key === 'parent' ? 'parent_relation_other' : 'parent2_relation_other', e.target.value)}
              placeholder="Наприклад: тітка, опікун"
              required={required}
            />
          </div>
        )}
      </fieldset>
    );
  };

  if (state === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loadingSpinner} />
          <p style={styles.loadingText}>Завантаження...</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    const messages: Record<string, { title: string; desc: string }> = {
      not_found: { title: 'Посилання не знайдено', desc: 'Це посилання недійсне або було видалене.' },
      already_used: { title: 'Анкету вже заповнено', desc: 'Це посилання вже було використано. Дякуємо!' },
      expired: { title: 'Посилання застаріло', desc: 'Термін дії цього посилання вичерпано. Зверніться до адміністратора школи.' },
      network: { title: 'Помилка мережі', desc: "Не вдалося підключитися. Перевірте інтернет-з'єднання." },
      unknown: { title: 'Помилка', desc: "Щось пішло не так. Зверніться до адміністратора школи." },
    };
    const msg = messages[errorReason] || messages.unknown;

    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>×</div>
          <h1 style={styles.errorTitle}>{msg.title}</h1>
          <p style={styles.errorDesc}>{msg.desc}</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.successTitle}>Дякуємо!</h1>
          <p style={styles.successDesc}>
            Анкету успішно надіслано. Адміністратор школи зв&apos;яжеться з вами найближчим часом.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light.svg" alt="ITRobotics" style={styles.logo} />
          <h1 style={styles.title}>Анкета нового учня</h1>
          <p style={styles.subtitle}>Заповніть, будь ласка, дані про дитину та контакти для зв&apos;язку</p>
        </div>

        {validationErrors.length > 0 && (
          <div style={styles.errorBox}>
            {validationErrors.map((err, index) => (
              <p key={index} style={styles.errorItem}>{err}</p>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Інформація про дитину</legend>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Прізвище *</label>
                <input
                  style={styles.input}
                  value={formData.child_last_name}
                  onChange={(e) => handleChange('child_last_name', e.target.value)}
                  placeholder="Прізвище дитини"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Ім&apos;я *</label>
                <input
                  style={styles.input}
                  value={formData.child_first_name}
                  onChange={(e) => handleChange('child_first_name', e.target.value)}
                  placeholder="Ім'я дитини"
                  required
                />
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Дата народження *</label>
                <input
                  type="date"
                  style={styles.input}
                  value={formData.birth_date}
                  onChange={(e) => handleChange('birth_date', e.target.value)}
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Навчальний заклад</label>
                <input
                  style={styles.input}
                  value={formData.school}
                  onChange={(e) => handleChange('school', e.target.value)}
                  placeholder="Школа, клас"
                />
              </div>
            </div>
          </fieldset>

          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Email</legend>
            <div style={styles.field}>
              <label style={styles.label}>Email *</label>
              <input
                type="email"
                style={styles.input}
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="name@example.com"
                required
              />
            </div>
          </fieldset>

          {renderContactSection('parent', 'Основний контакт', true)}

          {renderContactSection('parent2', 'Додатковий контакт')}

          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Курси, які зацікавили</legend>
            <p style={styles.sectionHint}>Оберіть один або кілька напрямів, які вам найбільш цікаві зараз.</p>

            <div style={styles.field} data-courses-dropdown="true">
              <label style={styles.label}>Оберіть курси</label>
              <button
                type="button"
                style={styles.dropdownTrigger}
                onClick={() => setCoursesOpen((prev) => !prev)}
              >
                <span style={formData.interested_courses.length > 0 ? styles.dropdownValue : styles.dropdownPlaceholder}>
                  {selectedCoursesLabel}
                </span>
                <span style={styles.dropdownArrow}>{coursesOpen ? '▴' : '▾'}</span>
              </button>

              {coursesOpen && (
                <div style={styles.dropdownPanel}>
                  {courses.length > 0 ? (
                    courses.map((course) => (
                      <label key={course.id} style={styles.dropdownOption}>
                        <input
                          type="checkbox"
                          checked={formData.interested_courses.includes(course.title)}
                          onChange={() => toggleCourse(course.title)}
                        />
                        <span>{course.title}</span>
                      </label>
                    ))
                  ) : (
                    <div style={styles.emptyCourses}>Активні курси зараз не знайдено</div>
                  )}
                </div>
              )}

              {formData.interested_courses.length > 0 && (
                <div style={styles.tags}>
                  {formData.interested_courses.map((course) => (
                    <span key={course} style={styles.tag}>
                      {course}
                      <button type="button" style={styles.tagRemove} onClick={() => toggleCourse(course)}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </fieldset>

          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Додатково</legend>

            <div style={styles.field}>
              <label style={styles.label}>Звідки дізналися про школу</label>
              <select
                style={styles.input}
                value={formData.source}
                onChange={(e) => handleChange('source', e.target.value)}
              >
                <option value="">Оберіть</option>
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {formData.source === 'other' && (
              <div style={styles.field}>
                <label style={styles.label}>Уточніть джерело</label>
                <input
                  style={styles.input}
                  value={formData.source_other}
                  onChange={(e) => handleChange('source_other', e.target.value)}
                  placeholder="Напишіть, звідки саме"
                />
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Побажання / коментарі</label>
              <textarea
                style={{ ...styles.input, minHeight: '96px', resize: 'vertical' } as React.CSSProperties}
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Будь-які деталі, які варто врахувати"
              />
            </div>
          </fieldset>

          <button type="submit" style={styles.submitBtn} disabled={state === 'submitting'}>
            {state === 'submitting' ? 'Надсилання...' : 'Надіслати анкету'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #fff7ed 0%, #eff6ff 52%, #eef2ff 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.25rem',
    fontFamily: '"Segoe UI", Arial, sans-serif',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(16px)',
    borderRadius: '24px',
    padding: '2rem',
    maxWidth: '840px',
    width: '100%',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    boxShadow: '0 28px 80px rgba(15, 23, 42, 0.12)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.75rem',
  },
  logo: {
    height: '48px',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 0.35rem',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: '#475569',
    margin: 0,
    lineHeight: 1.55,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  fieldset: {
    border: '1px solid #dbe4f0',
    borderRadius: '18px',
    padding: '1.15rem 1.25rem 1.25rem',
    margin: 0,
    background: '#ffffff',
  },
  legend: {
    fontSize: '0.82rem',
    fontWeight: '700',
    color: '#1d4ed8',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '0 0.5rem',
  },
  sectionHint: {
    margin: '0 0 0.75rem',
    color: '#64748b',
    fontSize: '0.85rem',
    lineHeight: 1.5,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.9rem',
  },
  contactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.9rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    marginTop: '0.6rem',
  },
  label: {
    fontSize: '0.82rem',
    fontWeight: '600',
    color: '#334155',
  },
  input: {
    padding: '0.75rem 0.9rem',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    fontSize: '0.95rem',
    lineHeight: 1.4,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 160ms ease-out, box-shadow 160ms ease-out',
    background: '#fff',
  },
  dropdownTrigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    width: '100%',
    padding: '0.75rem 0.9rem',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    fontSize: '0.95rem',
    background: '#fff',
    cursor: 'pointer',
    transition: 'border-color 160ms ease-out, box-shadow 160ms ease-out, transform 120ms ease-out',
  },
  dropdownValue: {
    color: '#0f172a',
    textAlign: 'left',
  },
  dropdownPlaceholder: {
    color: '#94a3b8',
    textAlign: 'left',
  },
  dropdownArrow: {
    color: '#64748b',
    flexShrink: 0,
  },
  dropdownPanel: {
    marginTop: '0.45rem',
    border: '1px solid #dbe4f0',
    borderRadius: '14px',
    background: '#fff',
    maxHeight: '240px',
    overflowY: 'auto',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
  },
  dropdownOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.8rem 0.9rem',
    cursor: 'pointer',
    borderBottom: '1px solid #eef2f7',
    fontSize: '0.92rem',
    color: '#0f172a',
  },
  emptyCourses: {
    padding: '0.95rem',
    color: '#64748b',
    fontSize: '0.9rem',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    marginTop: '0.7rem',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.35rem 0.65rem',
    borderRadius: '999px',
    background: '#e0ecff',
    color: '#1d4ed8',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  tagRemove: {
    border: 'none',
    background: 'transparent',
    color: '#1d4ed8',
    cursor: 'pointer',
    padding: 0,
    fontSize: '0.9rem',
    lineHeight: 1,
  },
  submitBtn: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    padding: '0.95rem 1.1rem',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '0.35rem',
    transition: 'transform 140ms ease-out, box-shadow 160ms ease-out, opacity 160ms ease-out',
    boxShadow: '0 16px 32px rgba(37, 99, 235, 0.22)',
  },
  errorBox: {
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    borderRadius: '14px',
    padding: '0.85rem 1rem',
    marginBottom: '0.25rem',
  },
  errorItem: {
    color: '#be123c',
    fontSize: '0.88rem',
    margin: '0.18rem 0',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '2rem auto',
  },
  loadingText: {
    textAlign: 'center',
    color: '#64748b',
  },
  errorIcon: {
    width: '64px',
    height: '64px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.75rem',
    fontWeight: '700',
    margin: '1rem auto',
  },
  errorTitle: {
    textAlign: 'center',
    fontSize: '1.35rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0.5rem 0',
  },
  errorDesc: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: '0.95rem',
    lineHeight: 1.55,
  },
  successIcon: {
    width: '64px',
    height: '64px',
    background: '#ecfdf3',
    color: '#16a34a',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.75rem',
    fontWeight: '700',
    margin: '1rem auto',
  },
  successTitle: {
    textAlign: 'center',
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#15803d',
    margin: '0.5rem 0',
  },
  successDesc: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: '0.95rem',
    lineHeight: 1.6,
  },
};
