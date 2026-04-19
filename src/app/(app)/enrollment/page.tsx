'use client';

import { useState, useEffect, useCallback } from 'react';
import { t } from '@/i18n/t';
import QRCode from 'qrcode';

interface EnrollmentToken {
  id: number;
  token: string;
  expires_at: string;
  used_at: string | null;
  manually_closed_at?: string | null;
  has_submission?: boolean;
  created_by: number;
  created_at: string;
}

interface Submission {
  id: number;
  token_id: number;
  child_first_name: string;
  child_last_name: string;
  birth_date: string | null;
  school: string | null;
  email: string | null;
  parent_name: string;
  parent_phone: string;
  parent_relation: string | null;
  parent2_name: string | null;
  parent2_phone: string | null;
  parent2_relation: string | null;
  notes: string | null;
  interested_courses: string | null;
  source: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: number | null;
  reviewed_at: string | null;
  student_id: number | null;
  created_at: string;
}

interface CourseOption {
  id: number;
  title: string;
  public_id: string;
}

interface SubmissionEditData {
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
  notes: string;
  interested_courses: string[];
  source: string;
  source_other: string;
}

type Tab = 'submissions' | 'tokens';

const RELATION_OPTIONS = [
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

const EMPTY_EDIT_DATA: SubmissionEditData = {
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
  notes: '',
  interested_courses: [],
  source: '',
  source_other: '',
};

function normalizeDate(value?: string | null) {
  return value ? value.slice(0, 10) : '';
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

function getOptionLabel(
  value: string | null | undefined,
  options: Array<{ value: string; label: string }>
) {
  if (!value) return '—';
  const option = options.find((item) => item.value === value);
  return option ? option.label : value;
}

function parseInterestedCourses(value: string | null | undefined) {
  if (!value) return [];

  return value
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((item) => item.replace(/^"+|"+$/g, '').trim())
    .filter(Boolean);
}

export default function EnrollmentPage() {
  const [tab, setTab] = useState<Tab>('submissions');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tokens, setTokens] = useState<EnrollmentToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [approving, setApproving] = useState(false);
  const [closingTokenId, setClosingTokenId] = useState<number | null>(null);

  // Edit state for selected submission
  const [editData, setEditData] = useState<SubmissionEditData>(EMPTY_EDIT_DATA);
  const [editing, setEditing] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesOpen, setCoursesOpen] = useState(false);

  const closeSubmissionModal = () => {
    setSelectedSubmission(null);
    setEditing(false);
    setCoursesOpen(false);
    setEditData(EMPTY_EDIT_DATA);
  };

  const fetchSubmissions = useCallback(async () => {
    const url = statusFilter ? `/api/enrollment/submissions?status=${statusFilter}` : '/api/enrollment/submissions';
    const res = await fetch(url);
    const data = await res.json();
    setSubmissions(data);
  }, [statusFilter]);

  const fetchTokens = useCallback(async () => {
    const res = await fetch('/api/enrollment/tokens');
    const data = await res.json();
    setTokens(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSubmissions(), fetchTokens()])
      .finally(() => setLoading(false));
  }, [fetchSubmissions, fetchTokens]);

  useEffect(() => {
    fetch('/api/public/courses')
      .then((res) => (res.ok ? res.json() : { courses: [] }))
      .then((data) => setCourses(Array.isArray(data.courses) ? data.courses : []))
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-enrollment-courses-dropdown="true"]')) {
        setCoursesOpen(false);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const openQrModal = async (tokenValue: string) => {
    const enrollUrl = `${window.location.origin}/enroll/${tokenValue}`;
    const dataUrl = await QRCode.toDataURL(enrollUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    });

    setQrDataUrl(dataUrl);
    setQrToken(tokenValue);
  };

  // Generate new QR token
  const generateToken = async () => {
    setGeneratingQr(true);
    try {
      const res = await fetch('/api/enrollment/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_in_minutes: 60 }),
      });
      const token: EnrollmentToken = await res.json();
      await openQrModal(token.token);
      fetchTokens();
    } catch (err) {
      console.error('QR generation error:', err);
    } finally {
      setGeneratingQr(false);
    }
  };

  // Approve submission
  const handleApprove = async (submission: Submission) => {
    if (!confirm(`Затвердити анкету ${submission.child_last_name} ${submission.child_first_name}?`)) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/enrollment/submissions/${submission.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setSelectedSubmission(null);
        fetchSubmissions();
      }
    } finally {
      setApproving(false);
    }
  };

  // Reject submission
  const handleReject = async (submission: Submission) => {
    if (!confirm(`Відхилити анкету ${submission.child_last_name} ${submission.child_first_name}?`)) return;
    try {
      await fetch(`/api/enrollment/submissions/${submission.id}`, { method: 'DELETE' });
      setSelectedSubmission(null);
      fetchSubmissions();
    } catch { /* ignore */ }
  };

  // Save edits
  const handleSaveEdit = async () => {
    if (!selectedSubmission) return;

    const payload = {
      child_first_name: editData.child_first_name.trim(),
      child_last_name: editData.child_last_name.trim(),
      birth_date: editData.birth_date || null,
      school: editData.school.trim(),
      email: editData.email.trim(),
      parent_name: editData.parent_name.trim(),
      parent_phone: editData.parent_phone.trim(),
      parent_relation: editData.parent_relation === 'other'
        ? editData.parent_relation_other.trim()
        : editData.parent_relation,
      parent2_name: editData.parent2_name.trim(),
      parent2_phone: editData.parent2_phone.trim(),
      parent2_relation: editData.parent2_relation === 'other'
        ? editData.parent2_relation_other.trim()
        : editData.parent2_relation,
      notes: editData.notes.trim(),
      interested_courses: editData.interested_courses,
      source: editData.source === 'other'
        ? editData.source_other.trim()
        : editData.source,
    };

    try {
      const res = await fetch(`/api/enrollment/submissions/${selectedSubmission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedSubmission(updated);
        setEditData(mapSubmissionToEditData(updated));
        setEditing(false);
        setCoursesOpen(false);
        fetchSubmissions();
      }
    } catch { /* ignore */ }
  };

  const mapSubmissionToEditData = (submission: Submission): SubmissionEditData => {
    const parentRelation = normalizeOptionValue(submission.parent_relation, RELATION_OPTIONS);
    const parent2Relation = normalizeOptionValue(submission.parent2_relation, RELATION_OPTIONS);
    const source = normalizeOptionValue(submission.source, SOURCE_OPTIONS);

    return {
      child_first_name: submission.child_first_name || '',
      child_last_name: submission.child_last_name || '',
      birth_date: normalizeDate(submission.birth_date),
      school: submission.school || '',
      email: submission.email || '',
      parent_name: submission.parent_name || '',
      parent_phone: submission.parent_phone || '',
      parent_relation: parentRelation.value,
      parent_relation_other: parentRelation.other,
      parent2_name: submission.parent2_name || '',
      parent2_phone: submission.parent2_phone || '',
      parent2_relation: parent2Relation.value,
      parent2_relation_other: parent2Relation.other,
      notes: submission.notes || '',
      interested_courses: parseInterestedCourses(submission.interested_courses),
      source: source.value,
      source_other: source.other,
    };
  };

  const openSubmission = (s: Submission) => {
    setSelectedSubmission(s);
    setEditData(mapSubmissionToEditData(s));
    setEditing(false);
    setCoursesOpen(false);
  };

  const handleCloseToken = async (token: EnrollmentToken) => {
    if (!confirm(`Закрити активний токен ${token.token.slice(0, 8)}...?`)) return;

    setClosingTokenId(token.id);
    try {
      const res = await fetch(`/api/enrollment/tokens/${token.id}/close`, {
        method: 'PATCH',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Не вдалося закрити токен');
      }

      if (qrToken === token.token) {
        setQrDataUrl(null);
        setQrToken(null);
      }

      await fetchTokens();
    } catch (err) {
      console.error('Token close error:', err);
      alert(err instanceof Error ? err.message : 'Не вдалося закрити токен');
    } finally {
      setClosingTokenId(null);
    }
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('uk-UA'); } catch { return d; }
  };

  const formatDateTime = (d: string) => {
    try {
      return new Date(d).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return d; }
  };

  const getTokenStatus = (token: EnrollmentToken) => {
    if (token.manually_closed_at || (token.used_at && !token.has_submission)) {
      return { label: 'Закритий вручну', color: '#b45309' };
    }
    if (token.used_at) return { label: 'Використаний', color: '#64748b' };
    if (new Date(token.expires_at) < new Date()) return { label: 'Протермінований', color: '#ef4444' };
    return { label: 'Активний', color: '#16a34a' };
  };

  const isTokenActive = (token: EnrollmentToken) => !token.used_at && new Date(token.expires_at) >= new Date();

  const toggleInterestedCourse = (title: string) => {
    setEditData((prev) => ({
      ...prev,
      interested_courses: prev.interested_courses.includes(title)
        ? prev.interested_courses.filter((course) => course !== title)
        : [...prev.interested_courses, title],
    }));
  };

  const qrLink = typeof window !== 'undefined' && qrToken
    ? `${window.location.origin}/enroll/${qrToken}`
    : '';

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 className="page-title">{t('enrollment.title')}</h1>
        <button className="btn btn-primary" onClick={generateToken} disabled={generatingQr}>
          {generatingQr ? 'Генерація...' : '+ Створити QR-анкету'}
        </button>
      </div>

      {/* QR Modal */}
      {qrDataUrl && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999,
        }}
          onClick={() => { setQrDataUrl(null); setQrToken(null); }}
        >
          <div
            style={{
              background: '#fff', borderRadius: '16px', padding: '2rem',
              maxWidth: '420px', width: '90%', textAlign: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              QR-код для анкети
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Дійсний 60 хвилин. Одноразовий.
            </p>
            <a
              href={qrLink}
              target="_blank"
              rel="noreferrer"
              title="Відкрити анкету в новій вкладці"
              style={{
                display: 'inline-block',
                borderRadius: '12px',
                transition: 'transform 160ms ease-out, opacity 160ms ease-out',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR Code"
                style={{ width: '280px', height: '280px', margin: '0 auto', cursor: 'pointer' }}
              />
            </a>
            <a
              href={qrLink}
              target="_blank"
              rel="noreferrer"
              title="Відкрити анкету в новій вкладці"
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginTop: '0.75rem',
                wordBreak: 'break-all',
                textDecoration: 'none',
                transition: 'color 160ms ease-out, opacity 160ms ease-out',
              }}
            >
              {qrLink}
            </a>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => {
                const link = document.createElement('a');
                link.download = `enrollment-qr-${qrToken?.slice(0, 8)}.png`;
                link.href = qrDataUrl!;
                link.click();
              }}>
                Завантажити
              </button>
              <button className="btn btn-secondary" onClick={() => {
                navigator.clipboard.writeText(qrLink);
              }}>
                Копіювати посилання
              </button>
              <button className="btn btn-outline" onClick={() => { setQrDataUrl(null); setQrToken(null); }}>
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0' }}>
        <button
          onClick={() => setTab('submissions')}
          style={{
            padding: '0.625rem 1.25rem', fontWeight: '500', fontSize: '0.875rem',
            border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
            background: tab === 'submissions' ? '#6366f1' : 'transparent',
            color: tab === 'submissions' ? '#fff' : '#64748b',
          }}
        >
          Анкети {submissions.length > 0 && `(${submissions.length})`}
        </button>
        <button
          onClick={() => setTab('tokens')}
          style={{
            padding: '0.625rem 1.25rem', fontWeight: '500', fontSize: '0.875rem',
            border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
            background: tab === 'tokens' ? '#6366f1' : 'transparent',
            color: tab === 'tokens' ? '#fff' : '#64748b',
          }}
        >
          Токени
        </button>
      </div>

      {loading && <p style={{ color: '#64748b' }}>{t('common.loading')}</p>}

      {/* ── Submissions Tab ── */}
      {!loading && tab === 'submissions' && (
        <>
          {/* Status filter */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[
              { value: 'pending', label: 'Очікує' },
              { value: 'approved', label: 'Затверджені' },
              { value: 'rejected', label: 'Відхилені' },
              { value: '', label: 'Всі' },
            ].map(f => (
              <button
                key={f.value}
                className={`btn ${statusFilter === f.value ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <p style={{ fontSize: '1rem' }}>Анкет ще немає</p>
              <p style={{ fontSize: '0.85rem' }}>Створіть QR-код і дайте відсканувати батькам</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {submissions.map(s => (
                <div
                  key={s.id}
                  onClick={() => openSubmission(s)}
                  style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
                    padding: '1rem 1.25rem', cursor: 'pointer',
                    transition: 'box-shadow 0.2s',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                      {s.child_last_name} {s.child_first_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                      {s.parent_name} · {s.parent_phone}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      {formatDateTime(s.created_at)}
                    </div>
                  </div>
                  <span style={{
                    padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem',
                    fontWeight: '600', whiteSpace: 'nowrap',
                    background: s.status === 'pending' ? '#fef3c7' : s.status === 'approved' ? '#dcfce7' : '#fee2e2',
                    color: s.status === 'pending' ? '#92400e' : s.status === 'approved' ? '#166534' : '#991b1b',
                  }}>
                    {s.status === 'pending' ? 'Очікує' : s.status === 'approved' ? 'Затверджено' : 'Відхилено'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Submission Detail Modal ── */}
          {selectedSubmission && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 9999, padding: '1rem',
            }}
              onClick={closeSubmissionModal}
            >
              <div
                style={{
                  background: '#fff', borderRadius: '16px', padding: '2rem',
                  maxWidth: '550px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                    {editing ? 'Редагування анкети' : 'Деталі анкети'}
                  </h2>
                  <button onClick={closeSubmissionModal} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <DetailRow label="Прізвище" value={editing ? undefined : selectedSubmission.child_last_name}>
                    {editing && <input className="form-input" value={editData.child_last_name} onChange={e => setEditData({ ...editData, child_last_name: e.target.value })} />}
                  </DetailRow>
                  <DetailRow label="Ім'я" value={editing ? undefined : selectedSubmission.child_first_name}>
                    {editing && <input className="form-input" value={editData.child_first_name} onChange={e => setEditData({ ...editData, child_first_name: e.target.value })} />}
                  </DetailRow>
                  <DetailRow label="Дата народження" value={editing ? undefined : (selectedSubmission.birth_date ? formatDate(selectedSubmission.birth_date) : '—')}>
                    {editing && <input type="date" className="form-input" value={editData.birth_date} onChange={e => setEditData({ ...editData, birth_date: e.target.value })} />}
                  </DetailRow>
                  <DetailRow label="Школа" value={editing ? undefined : (selectedSubmission.school || '—')}>
                    {editing && <input className="form-input" value={editData.school} onChange={e => setEditData({ ...editData, school: e.target.value })} />}
                  </DetailRow>
                  <DetailRow label="Email" value={editing ? undefined : (selectedSubmission.email || '—')}>
                    {editing && <input type="email" className="form-input" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} />}
                  </DetailRow>

                  <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

                  <DetailRow label="Контактна особа" value={editing ? undefined : selectedSubmission.parent_name}>
                    {editing && <input className="form-input" value={editData.parent_name} onChange={e => setEditData({ ...editData, parent_name: e.target.value })} />}
                  </DetailRow>
                  <DetailRow label="Телефон" value={editing ? undefined : selectedSubmission.parent_phone}>
                    {editing && <input className="form-input" value={editData.parent_phone} onChange={e => setEditData({ ...editData, parent_phone: e.target.value })} />}
                  </DetailRow>
                  <DetailRow label="Хто дитині" value={editing ? undefined : getOptionLabel(selectedSubmission.parent_relation, RELATION_OPTIONS)}>
                    {editing && (
                      <select className="form-input" value={editData.parent_relation} onChange={e => setEditData({ ...editData, parent_relation: e.target.value })}>
                        <option value="">—</option>
                        {RELATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    )}
                  </DetailRow>
                  {editing && editData.parent_relation === 'other' && (
                    <DetailRow label="Уточнення">
                      <input className="form-input" value={editData.parent_relation_other} onChange={e => setEditData({ ...editData, parent_relation_other: e.target.value })} />
                    </DetailRow>
                  )}

                  {(selectedSubmission.parent2_name || selectedSubmission.parent2_phone || selectedSubmission.parent2_relation || editing) && (
                    <>
                      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />
                      <DetailRow label="Дод. контакт" value={editing ? undefined : (selectedSubmission.parent2_name || '—')}>
                        {editing && <input className="form-input" value={editData.parent2_name} onChange={e => setEditData({ ...editData, parent2_name: e.target.value })} />}
                      </DetailRow>
                      <DetailRow label="Тел. дод. контакту" value={editing ? undefined : (selectedSubmission.parent2_phone || '—')}>
                        {editing && <input className="form-input" value={editData.parent2_phone} onChange={e => setEditData({ ...editData, parent2_phone: e.target.value })} />}
                      </DetailRow>
                      <DetailRow label="Хто дитині" value={editing ? undefined : getOptionLabel(selectedSubmission.parent2_relation, RELATION_OPTIONS)}>
                        {editing && (
                          <select className="form-input" value={editData.parent2_relation} onChange={e => setEditData({ ...editData, parent2_relation: e.target.value })}>
                            <option value="">—</option>
                            {RELATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        )}
                      </DetailRow>
                      {editing && editData.parent2_relation === 'other' && (
                        <DetailRow label="Уточнення">
                          <input className="form-input" value={editData.parent2_relation_other} onChange={e => setEditData({ ...editData, parent2_relation_other: e.target.value })} />
                        </DetailRow>
                      )}
                    </>
                  )}

                  {(selectedSubmission.interested_courses || editing) && (
                    <DetailRow label="Курси, які цікавлять" value={editing ? undefined : (selectedSubmission.interested_courses || '—')}>
                      {editing && (
                        <div data-enrollment-courses-dropdown="true" style={{ display: 'grid', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="form-input"
                            onClick={() => setCoursesOpen((prev) => !prev)}
                            style={{
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              background: '#fff',
                            }}
                          >
                            <span style={{ color: editData.interested_courses.length > 0 ? '#0f172a' : '#94a3b8' }}>
                              {editData.interested_courses.length > 0
                                ? `${editData.interested_courses.length} обрано`
                                : 'Оберіть курси'}
                            </span>
                            <span style={{ color: '#64748b' }}>{coursesOpen ? '▴' : '▾'}</span>
                          </button>
                          {coursesOpen && (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', maxHeight: '220px', overflowY: 'auto' }}>
                              {courses.length > 0 ? (
                                courses.map((course) => (
                                  <label key={course.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem 0.9rem', borderBottom: '1px solid #eef2f7', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={editData.interested_courses.includes(course.title)}
                                      onChange={() => toggleInterestedCourse(course.title)}
                                    />
                                    <span>{course.title}</span>
                                  </label>
                                ))
                              ) : (
                                <div style={{ padding: '0.9rem', color: '#64748b' }}>Активні курси зараз не знайдено</div>
                              )}
                            </div>
                          )}
                          {editData.interested_courses.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                              {editData.interested_courses.map((course) => (
                                <span key={course} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', borderRadius: '999px', background: '#e0ecff', color: '#1d4ed8', fontSize: '0.8rem', fontWeight: 600 }}>
                                  {course}
                                  <button type="button" onClick={() => toggleInterestedCourse(course)} style={{ border: 'none', background: 'transparent', color: '#1d4ed8', padding: 0, cursor: 'pointer', lineHeight: 1 }}>
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </DetailRow>
                  )}

                  {(selectedSubmission.source || editing) && (
                    <DetailRow label="Джерело" value={editing ? undefined : getOptionLabel(selectedSubmission.source, SOURCE_OPTIONS)}>
                      {editing && (
                        <select className="form-input" value={editData.source} onChange={e => setEditData({ ...editData, source: e.target.value })}>
                          <option value="">—</option>
                          {SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      )}
                    </DetailRow>
                  )}
                  {editing && editData.source === 'other' && (
                    <DetailRow label="Уточнення джерела">
                      <input className="form-input" value={editData.source_other} onChange={e => setEditData({ ...editData, source_other: e.target.value })} />
                    </DetailRow>
                  )}

                  {(selectedSubmission.notes || editing) && (
                    <DetailRow label="Примітки" value={editing ? undefined : (selectedSubmission.notes || '—')}>
                      {editing && <textarea className="form-input" value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })} />}
                    </DetailRow>
                  )}
                </div>

                {/* Actions */}
                {selectedSubmission.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                    {editing ? (
                      <>
                        <button className="btn btn-primary" onClick={handleSaveEdit}>Зберегти</button>
                        <button
                          className="btn btn-outline"
                          onClick={() => {
                            setEditData(mapSubmissionToEditData(selectedSubmission));
                            setEditing(false);
                            setCoursesOpen(false);
                          }}
                        >
                          Скасувати
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-primary" onClick={() => handleApprove(selectedSubmission)} disabled={approving}>
                          {approving ? 'Збереження...' : '✓ Затвердити → створити учня'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditData(mapSubmissionToEditData(selectedSubmission));
                            setEditing(true);
                          }}
                        >
                          Редагувати
                        </button>
                        <button className="btn btn-outline" style={{ color: '#ef4444' }} onClick={() => handleReject(selectedSubmission)}>Відхилити</button>
                      </>
                    )}
                  </div>
                )}

                {selectedSubmission.status === 'approved' && selectedSubmission.student_id && (
                  <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px', fontSize: '0.85rem', color: '#166534' }}>
                    ✓ Учня створено (ID: {selectedSubmission.student_id})
                    {selectedSubmission.reviewed_at && ` · ${formatDateTime(selectedSubmission.reviewed_at)}`}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tokens Tab ── */}
      {!loading && tab === 'tokens' && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {tokens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              Токенів ще немає
            </div>
          ) : (
            tokens.map(token => {
              const st = getTokenStatus(token);
              const tokenIsActive = isTokenActive(token);
              return (
                <div
                  key={token.id}
                  onClick={async () => {
                    if (tokenIsActive) {
                      setGeneratingQr(true);
                      try {
                        await openQrModal(token.token);
                      } catch (err) {
                        console.error('QR generation error:', err);
                      } finally {
                        setGeneratingQr(false);
                      }
                    }
                  }}
                  title={tokenIsActive ? 'Відкрити QR-код' : undefined}
                  style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
                    padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', gap: '1rem',
                    cursor: tokenIsActive ? 'pointer' : 'default',
                    transition: 'transform 160ms ease-out, box-shadow 160ms ease-out, border-color 160ms ease-out',
                    boxShadow: tokenIsActive ? '0 6px 18px rgba(15, 23, 42, 0.04)' : 'none',
                    borderColor: tokenIsActive ? '#cbd5e1' : '#e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#475569' }}>
                      {token.token.slice(0, 8)}...
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.125rem' }}>
                      Створено: {formatDateTime(token.created_at)} · Дійсний до: {formatDateTime(token.expires_at)}
                    </div>
                    {tokenIsActive && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Натисніть, щоб відкрити QR-код
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {tokenIsActive && (
                      <button
                        className="btn btn-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCloseToken(token);
                        }}
                        disabled={closingTokenId === token.id}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.75rem',
                          color: '#b91c1c',
                          borderColor: '#fecaca',
                          background: '#fff',
                        }}
                        title="Закрити токен вручну"
                      >
                        {closingTokenId === token.id ? 'Закриття...' : 'Закрити'}
                      </button>
                    )}
                    <span style={{
                      padding: '0.2rem 0.625rem', borderRadius: '9999px', fontSize: '0.7rem',
                      fontWeight: '600', color: st.color, border: `1px solid ${st.color}`,
                    }}>
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// Helper component
function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', alignItems: 'start' }}>
      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>{label}</span>
      {children || <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>{value}</span>}
    </div>
  );
}
