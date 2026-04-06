'use client';

import { useState, useEffect } from 'react';
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
  { value: 'friends', label: 'Знайомі/Рекомендації' },
  { value: 'search', label: 'Пошук в інтернеті' },
  { value: 'other', label: 'Інше' },
];

type FormState = 'loading' | 'form' | 'submitting' | 'success' | 'error';

interface FormData {
  child_first_name: string;
  child_last_name: string;
  birth_date: string;
  school: string;
  parent_name: string;
  parent_phone: string;
  parent_relation: string;
  parent_relation_other: string;
  parent2_name: string;
  parent2_relation: string;
  parent2_relation_other: string;
  notes: string;
  source: string;
  source_other: string;
}

const initialFormData: FormData = {
  child_first_name: '',
  child_last_name: '',
  birth_date: '',
  school: '',
  parent_name: '',
  parent_phone: '+380',
  parent_relation: '',
  parent_relation_other: '',
  parent2_name: '',
  parent2_relation: '',
  parent2_relation_other: '',
  notes: '',
  source: '',
  source_other: '',
};

// Format phone: +380XXXXXXXXX → +380 XX XXX XX XX
function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 3) return '+' + digits;
  if (digits.length <= 5) return '+' + digits.slice(0, 3) + ' ' + digits.slice(3);
  if (digits.length <= 8) return '+' + digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5);
  if (digits.length <= 10) return '+' + digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8);
  return '+' + digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8, 10) + ' ' + digits.slice(10, 12);
}

export default function EnrollPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<FormState>('loading');
  const [errorReason, setErrorReason] = useState('');
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/enroll/${token}`)
      .then(res => res.json())
      .then(data => {
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

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationErrors([]);
  };

  const handlePhoneChange = (value: string) => {
    // Extract only digits
    let digits = value.replace(/\D/g, '');
    // Ensure starts with 380
    if (!digits.startsWith('380')) {
      if (digits.startsWith('0')) {
        digits = '38' + digits;
      } else if (digits.startsWith('80')) {
        digits = '3' + digits;
      } else if (!digits.startsWith('3')) {
        digits = '380' + digits;
      }
    }
    // Max 12 digits (380 + 9 digits)
    digits = digits.slice(0, 12);
    handleChange('parent_phone', '+' + digits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    const errors: string[] = [];
    if (!formData.child_first_name.trim()) errors.push("Ім'я дитини обов'язкове");
    if (!formData.child_last_name.trim()) errors.push("Прізвище дитини обов'язкове");
    if (!formData.parent_name.trim()) errors.push("Ім'я контактної особи обов'язкове");
    const phoneDigits = formData.parent_phone.replace(/\D/g, '');
    if (phoneDigits.length < 12) errors.push('Введіть повний номер телефону (12 цифр)');
    if (formData.parent_relation === 'other' && !formData.parent_relation_other.trim())
      errors.push("Вкажіть ким ви доводитесь дитині");

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setState('submitting');

    // Resolve "other" values
    const submitData = {
      ...formData,
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
        setValidationErrors(data.errors || [data.error || 'Помилка при відправці']);
      }
    } catch {
      setState('form');
      setValidationErrors(['Помилка мережі. Спробуйте ще раз.']);
    }
  };

  // ── Render states ──

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
      network: { title: 'Помилка мережі', desc: 'Не вдалося підключитися. Перевірте інтернет-з\'єднання.' },
      unknown: { title: 'Помилка', desc: 'Щось пішло не так. Зверніться до адміністратора школи.' },
    };
    const msg = messages[errorReason] || messages.unknown;

    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>✕</div>
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

  // ── Form ──

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light.svg" alt="ITRobotics" style={styles.logo} />
          <h1 style={styles.title}>Анкета нового учня</h1>
          <p style={styles.subtitle}>Будь ласка, заповніть інформацію про дитину</p>
        </div>

        {validationErrors.length > 0 && (
          <div style={styles.errorBox}>
            {validationErrors.map((err, i) => (
              <p key={i} style={styles.errorItem}>{err}</p>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Child info */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Інформація про дитину</legend>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Прізвище *</label>
                <input
                  style={styles.input}
                  value={formData.child_last_name}
                  onChange={e => handleChange('child_last_name', e.target.value)}
                  placeholder="Прізвище дитини"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Ім&apos;я *</label>
                <input
                  style={styles.input}
                  value={formData.child_first_name}
                  onChange={e => handleChange('child_first_name', e.target.value)}
                  placeholder="Ім'я дитини"
                  required
                />
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Дата народження</label>
                <input
                  type="date"
                  style={styles.input}
                  value={formData.birth_date}
                  onChange={e => handleChange('birth_date', e.target.value)}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Навчальний заклад</label>
                <input
                  style={styles.input}
                  value={formData.school}
                  onChange={e => handleChange('school', e.target.value)}
                  placeholder="Школа, клас"
                />
              </div>
            </div>
          </fieldset>

          {/* Parent 1 */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Контактна особа</legend>

            <div style={styles.field}>
              <label style={styles.label}>Ім&apos;я контактної особи *</label>
              <input
                style={styles.input}
                value={formData.parent_name}
                onChange={e => handleChange('parent_name', e.target.value)}
                placeholder="Ім'я та прізвище"
                required
              />
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Телефон *</label>
                <input
                  type="tel"
                  style={styles.input}
                  value={formatPhoneDisplay(formData.parent_phone)}
                  onChange={e => handlePhoneChange(e.target.value)}
                  placeholder="+380 XX XXX XX XX"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Хто дитині *</label>
                <select
                  style={styles.input}
                  value={formData.parent_relation}
                  onChange={e => handleChange('parent_relation', e.target.value)}
                >
                  <option value="">Оберіть</option>
                  {RELATIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {formData.parent_relation === 'other' && (
              <div style={styles.field}>
                <label style={styles.label}>Вкажіть ким ви доводитесь дитині *</label>
                <input
                  style={styles.input}
                  value={formData.parent_relation_other}
                  onChange={e => handleChange('parent_relation_other', e.target.value)}
                  placeholder="Наприклад: тітка, опікун..."
                  required
                />
              </div>
            )}
          </fieldset>

          {/* Parent 2 (optional) */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Додатковий контакт (за бажанням)</legend>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Ім&apos;я</label>
                <input
                  style={styles.input}
                  value={formData.parent2_name}
                  onChange={e => handleChange('parent2_name', e.target.value)}
                  placeholder="Ім'я та прізвище"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Хто дитині</label>
                <select
                  style={styles.input}
                  value={formData.parent2_relation}
                  onChange={e => handleChange('parent2_relation', e.target.value)}
                >
                  <option value="">Оберіть</option>
                  {RELATIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {formData.parent2_relation === 'other' && (
              <div style={styles.field}>
                <label style={styles.label}>Вкажіть</label>
                <input
                  style={styles.input}
                  value={formData.parent2_relation_other}
                  onChange={e => handleChange('parent2_relation_other', e.target.value)}
                  placeholder="Наприклад: тітка, опікун..."
                />
              </div>
            )}
          </fieldset>

          {/* Additional */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Додатково</legend>

            <div style={styles.field}>
              <label style={styles.label}>Звідки дізнались про школу</label>
              <select
                style={styles.input}
                value={formData.source}
                onChange={e => handleChange('source', e.target.value)}
              >
                <option value="">Оберіть</option>
                {SOURCE_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            {formData.source === 'other' && (
              <div style={styles.field}>
                <label style={styles.label}>Вкажіть</label>
                <input
                  style={styles.input}
                  value={formData.source_other}
                  onChange={e => handleChange('source_other', e.target.value)}
                  placeholder="Звідки саме..."
                />
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Побажання / коментарі</label>
              <textarea
                style={{ ...styles.input, minHeight: '80px', resize: 'vertical' } as React.CSSProperties}
                value={formData.notes}
                onChange={e => handleChange('notes', e.target.value)}
                placeholder="Будь-які додаткові побажання"
              />
            </div>
          </fieldset>

          <button
            type="submit"
            style={styles.submitBtn}
            disabled={state === 'submitting'}
          >
            {state === 'submitting' ? 'Надсилання...' : 'Надіслати анкету'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Inline styles (standalone page, no admin CSS) ──

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '2rem',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  logo: {
    height: '48px',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 0.25rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748b',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  fieldset: {
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '1rem 1.25rem',
    margin: 0,
  },
  legend: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0 0.5rem',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    marginTop: '0.75rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: '#475569',
  },
  input: {
    padding: '0.625rem 0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '0.875rem',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    marginBottom: '0.5rem',
  },
  errorItem: {
    color: '#dc2626',
    fontSize: '0.85rem',
    margin: '0.125rem 0',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#6366f1',
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
    background: '#fef2f2',
    color: '#dc2626',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: '700',
    margin: '1rem auto',
  },
  errorTitle: {
    textAlign: 'center',
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0.5rem 0',
  },
  errorDesc: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: '0.9rem',
  },
  successIcon: {
    width: '64px',
    height: '64px',
    background: '#f0fdf4',
    color: '#16a34a',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: '700',
    margin: '1rem auto',
  },
  successTitle: {
    textAlign: 'center',
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#16a34a',
    margin: '0.5rem 0',
  },
  successDesc: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: '0.95rem',
    lineHeight: '1.5',
  },
};
