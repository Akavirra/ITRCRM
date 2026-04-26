'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  FileText,
  KeyRound,
  Search,
  Check,
  X,
  Trash2,
  Pencil,
  Eye,
  XCircle,
  Loader2,
  QrCode,
  Download,
  Copy,
  Award,
} from 'lucide-react';
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Edit state for selected submission
  const [editData, setEditData] = useState<SubmissionEditData>(EMPTY_EDIT_DATA);
  const [editing, setEditing] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesOpen, setCoursesOpen] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const closeSubmissionModal = () => {
    setSelectedSubmission(null);
    setEditing(false);
    setCoursesOpen(false);
    setEditData(EMPTY_EDIT_DATA);
  };

  const fetchSubmissions = useCallback(async (targetPage = 1) => {
    if (targetPage === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(targetPage));
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/enrollment/submissions?${params.toString()}`);
      const data = await res.json();
      const items = data.items || [];
      setSubmissions((prev) => (targetPage === 1 ? items : [...prev, ...items]));
      setHasMore(items.length === data.limit);
      setPage(targetPage);
    } finally {
      if (targetPage === 1) setLoading(false);
      else setLoadingMore(false);
    }
  }, [statusFilter, searchQuery]);

  const fetchTokens = useCallback(async () => {
    const res = await fetch('/api/enrollment/tokens');
    const data = await res.json();
    setTokens(data);
  }, []);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setSubmissions([]);
    fetchSubmissions(1);
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSubmissions(1), fetchTokens()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (page === 1) return;
    fetchSubmissions(page);
  }, [page, fetchSubmissions]);

  useEffect(() => {
    if (!sentinelRef.current || loading || loadingMore || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore]);

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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

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

  const getStatusBadge = (status: Submission['status']) => {
    if (status === 'pending') return <span className="badge badge-warning">Очікує</span>;
    if (status === 'approved') return <span className="badge badge-success">Затверджено</span>;
    return <span className="badge badge-danger">Відхилено</span>;
  };

  const getTokenStatusBadge = (token: EnrollmentToken) => {
    const st = getTokenStatus(token);
    const isActive = isTokenActive(token);
    if (isActive) return <span className="badge badge-success">{st.label}</span>;
    if (token.used_at) return <span className="badge badge-gray">{st.label}</span>;
    if (token.manually_closed_at) return <span className="badge badge-warning">{st.label}</span>;
    return <span className="badge badge-danger">{st.label}</span>;
  };

  const qrLink = typeof window !== 'undefined' && qrToken
    ? `${window.location.origin}/enroll/${qrToken}`
    : '';

  const statusFilterOptions = [
    { value: 'pending', label: 'Очікує' },
    { value: 'approved', label: 'Затверджені' },
    { value: 'rejected', label: 'Відхилені' },
    { value: '', label: 'Всі' },
  ];

  const filteredSubmissions = submissions;

  return (
    <div className="card">
      {/* Tabs */}
      <div className="tabs" style={{ padding: '0 1.5rem' }}>
        <button
          type="button"
          className={`tab${tab === 'submissions' ? ' active' : ''}`}
          onClick={() => setTab('submissions')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', borderTop: '0', borderLeft: '0', borderRight: '0' }}
        >
          <FileText size={16} strokeWidth={1.75} />
          Анкети {submissions.length > 0 && `(${submissions.length})`}
        </button>
        <button
          type="button"
          className={`tab${tab === 'tokens' ? ' active' : ''}`}
          onClick={() => setTab('tokens')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', borderTop: '0', borderLeft: '0', borderRight: '0' }}
        >
          <KeyRound size={16} strokeWidth={1.75} />
          Токени
        </button>
      </div>

      {/* ── Submissions Tab ── */}
      {tab === 'submissions' && (
        <>
          {/* Section Header */}
          <div
            className="card-header"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: '16px',
            }}
          >
            {/* Top row: title + add button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <h3 className="card-title" style={{ margin: 0 }}>{t('enrollment.title')}</h3>
              </div>
              <button className="btn btn-primary" onClick={generateToken} disabled={generatingQr} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                <Plus size={16} strokeWidth={1.75} />
                {generatingQr ? 'Генерація...' : 'Створити QR-анкету'}
              </button>
            </div>

            {/* Controls row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative', maxWidth: '220px', width: '100%' }}>
                <Search size={16} strokeWidth={1.75} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
                <input
                  type="search"
                  className="form-input"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Пошук..."
                  style={{ paddingLeft: '36px', maxWidth: '220px' }}
                />
              </div>
              <select
                className="form-select"
                value={statusFilter}
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value);
                }}
                style={{ maxWidth: '200px' }}
              >
                <option value="">Усі статуси</option>
                <option value="pending">Очікує</option>
                <option value="approved">Затверджені</option>
                <option value="rejected">Відхилені</option>
              </select>

              <div
                style={{
                  display: 'inline-flex',
                  borderRadius: '8px',
                  border: '1px solid var(--gray-200)',
                  overflow: 'hidden',
                  marginLeft: 'auto',
                }}
              >
                {statusFilterOptions.map((f) => {
                  const isActive = statusFilter === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setStatusFilter(f.value)}
                      style={{
                        padding: '6px 16px',
                        fontSize: '13px',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? 'var(--primary)' : 'var(--gray-500)',
                        background: isActive ? 'var(--primary-light)' : 'white',
                        border: 'none',
                        borderLeft: statusFilterOptions.indexOf(f) > 0 ? '1px solid var(--gray-200)' : 'none',
                        cursor: 'pointer',
                        transition: 'background-color 150ms ease-out, color 150ms ease-out',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="table-container">
            {loading && filteredSubmissions.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gray-500)' }}>
                <Loader2 size={24} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                {t('common.loading')}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Award size={48} strokeWidth={1.5} />
                </div>
                <h3 className="empty-state-title">Анкет ще немає</h3>
                <p className="empty-state-text" style={{ maxWidth: '360px', margin: '0 auto 16px' }}>
                  Створіть QR-код і дайте відсканувати батькам
                </p>
                <button className="btn btn-primary" onClick={generateToken} disabled={generatingQr}>
                  <Plus size={16} strokeWidth={1.75} />
                  Створити QR-анкету
                </button>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Дитина</th>
                    <th>Батько</th>
                    <th>Телефон</th>
                    <th>Статус</th>
                    <th>Дата подання</th>
                    <th style={{ textAlign: 'right' }}>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((s) => (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => openSubmission(s)}>
                      <td style={{ fontWeight: 600 }}>
                        {s.child_last_name} {s.child_first_name}
                      </td>
                      <td style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                        {s.parent_name}
                      </td>
                      <td style={{ color: 'var(--gray-500)', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
                        {s.parent_phone}
                      </td>
                      <td>{getStatusBadge(s.status)}</td>
                      <td style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                        {formatDateTime(s.created_at)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => { e.stopPropagation(); openSubmission(s); }}
                            title="Переглянути"
                            style={{ padding: '6px 8px' }}
                          >
                            <Eye size={16} strokeWidth={1.75} />
                          </button>
                          {s.status === 'pending' && (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={(e) => { e.stopPropagation(); setSelectedSubmission(s); setEditData(mapSubmissionToEditData(s)); setEditing(true); setCoursesOpen(false); }}
                                title="Редагувати"
                                style={{ padding: '6px 8px' }}
                              >
                                <Pencil size={16} strokeWidth={1.75} />
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={(e) => { e.stopPropagation(); handleApprove(s); }}
                                title="Затвердити"
                                disabled={approving}
                                style={{ padding: '6px 8px', background: 'var(--success-soft, #dcfce7)', color: 'var(--success)', borderColor: 'var(--success)' }}
                              >
                                <Check size={16} strokeWidth={1.75} />
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={(e) => { e.stopPropagation(); handleReject(s); }}
                                title="Відхилити"
                                style={{ padding: '6px 8px' }}
                              >
                                <X size={16} strokeWidth={1.75} />
                              </button>
                            </>
                          )}
                          {s.status === 'rejected' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={(e) => { e.stopPropagation(); handleReject(s); }}
                              title="Видалити"
                              style={{ padding: '6px 8px' }}
                            >
                              <Trash2 size={16} strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {loadingMore && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--gray-500)', fontSize: '13px' }}>
              Завантажуємо ще…
            </div>
          )}
          <div ref={sentinelRef} style={{ height: '1px' }} />
        </>
      )}

      {/* ── Tokens Tab ── */}
      {tab === 'tokens' && (
        <>
          {/* Section Header */}
          <div
            className="card-header"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <h3 className="card-title" style={{ margin: 0 }}>Токени</h3>
              </div>
              <button className="btn btn-primary" onClick={generateToken} disabled={generatingQr} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                <Plus size={16} strokeWidth={1.75} />
                {generatingQr ? 'Генерація...' : 'Створити QR-анкету'}
              </button>
            </div>
          </div>

          <div className="table-container">
            {loading && tokens.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gray-500)' }}>
                <Loader2 size={24} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                {t('common.loading')}
              </div>
            ) : tokens.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <KeyRound size={48} strokeWidth={1.5} />
                </div>
                <h3 className="empty-state-title">Токенів ще немає</h3>
                <p className="empty-state-text" style={{ maxWidth: '360px', margin: '0 auto 16px' }}>
                  Створіть QR-токен, щоб батьки могли заповнити анкету
                </p>
                <button className="btn btn-primary" onClick={generateToken} disabled={generatingQr}>
                  <Plus size={16} strokeWidth={1.75} />
                  Створити QR-анкету
                </button>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Токен</th>
                    <th>Створено</th>
                    <th>Дійсний до</th>
                    <th>Статус</th>
                    <th style={{ textAlign: 'right' }}>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => {
                    const tokenIsActive = isTokenActive(token);
                    return (
                      <tr key={token.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                          {token.token.slice(0, 12)}...
                        </td>
                        <td style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                          {formatDateTime(token.created_at)}
                        </td>
                        <td style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                          {formatDateTime(token.expires_at)}
                        </td>
                        <td>{getTokenStatusBadge(token)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            {tokenIsActive && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={async () => {
                                  setGeneratingQr(true);
                                  try {
                                    await openQrModal(token.token);
                                  } catch (err) {
                                    console.error('QR generation error:', err);
                                  } finally {
                                    setGeneratingQr(false);
                                  }
                                }}
                                title="Відкрити QR-код"
                                style={{ padding: '6px 8px' }}
                              >
                                <QrCode size={16} strokeWidth={1.75} />
                              </button>
                            )}
                            {tokenIsActive && (
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => handleCloseToken(token)}
                                disabled={closingTokenId === token.id}
                                title="Закрити токен"
                                style={{ padding: '6px 8px', color: 'var(--danger)', borderColor: 'var(--gray-300)' }}
                              >
                                <X size={16} strokeWidth={1.75} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* QR Modal */}
      {qrDataUrl && (
        <div className="modal-overlay" onClick={() => { setQrDataUrl(null); setQrToken(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header" style={{ position: 'relative', justifyContent: 'center' }}>
              <h3 className="modal-title">QR-код для анкети</h3>
              <button
                className="modal-close"
                onClick={() => { setQrDataUrl(null); setQrToken(null); }}
                aria-label="Закрити"
                style={{ position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)' }}
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                Дійсний 60 хвилин. Одноразовий.
              </p>
              <a
                href={qrLink}
                target="_blank"
                rel="noreferrer"
                title="Відкрити анкету в новій вкладці"
                style={{ display: 'inline-block', borderRadius: '12px' }}
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
                  color: 'var(--gray-400)',
                  marginTop: '0.75rem',
                  wordBreak: 'break-all',
                  textDecoration: 'none',
                }}
              >
                {qrLink}
              </a>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => {
                const link = document.createElement('a');
                link.download = `enrollment-qr-${qrToken?.slice(0, 8)}.png`;
                link.href = qrDataUrl!;
                link.click();
              }}>
                <Download size={16} strokeWidth={1.75} />
                Завантажити
              </button>
              <button className="btn btn-secondary" onClick={() => {
                navigator.clipboard.writeText(qrLink);
              }}>
                <Copy size={16} strokeWidth={1.75} />
                Копіювати посилання
              </button>
              <button className="btn btn-outline" onClick={() => { setQrDataUrl(null); setQrToken(null); }}>
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div className="modal-overlay" onClick={closeSubmissionModal}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editing ? 'Редагування анкети' : 'Деталі анкети'}
              </h3>
              <button className="modal-close" onClick={closeSubmissionModal} aria-label="Закрити">
                <XCircle size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <DetailRow label="Прізвище" value={editing ? undefined : selectedSubmission.child_last_name}>
                  {editing && <input className="form-input" value={editData.child_last_name} onChange={(e) => setEditData({ ...editData, child_last_name: e.target.value })} />}
                </DetailRow>
                <DetailRow label="Ім'я" value={editing ? undefined : selectedSubmission.child_first_name}>
                  {editing && <input className="form-input" value={editData.child_first_name} onChange={(e) => setEditData({ ...editData, child_first_name: e.target.value })} />}
                </DetailRow>
                <DetailRow label="Дата народження" value={editing ? undefined : (selectedSubmission.birth_date ? formatDate(selectedSubmission.birth_date) : '—')}>
                  {editing && <input type="date" className="form-input" value={editData.birth_date} onChange={(e) => setEditData({ ...editData, birth_date: e.target.value })} />}
                </DetailRow>
                <DetailRow label="Школа" value={editing ? undefined : (selectedSubmission.school || '—')}>
                  {editing && <input className="form-input" value={editData.school} onChange={(e) => setEditData({ ...editData, school: e.target.value })} />}
                </DetailRow>
                <DetailRow label="Email" value={editing ? undefined : (selectedSubmission.email || '—')}>
                  {editing && <input type="email" className="form-input" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />}
                </DetailRow>

                <hr style={{ border: 'none', borderTop: '1px solid var(--gray-200)', margin: '0.5rem 0' }} />

                <DetailRow label="Контактна особа" value={editing ? undefined : selectedSubmission.parent_name}>
                  {editing && <input className="form-input" value={editData.parent_name} onChange={(e) => setEditData({ ...editData, parent_name: e.target.value })} />}
                </DetailRow>
                <DetailRow label="Телефон" value={editing ? undefined : selectedSubmission.parent_phone}>
                  {editing && <input className="form-input" value={editData.parent_phone} onChange={(e) => setEditData({ ...editData, parent_phone: e.target.value })} />}
                </DetailRow>
                <DetailRow label="Хто дитині" value={editing ? undefined : getOptionLabel(selectedSubmission.parent_relation, RELATION_OPTIONS)}>
                  {editing && (
                    <select className="form-input" value={editData.parent_relation} onChange={(e) => setEditData({ ...editData, parent_relation: e.target.value })}>
                      <option value="">—</option>
                      {RELATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  )}
                </DetailRow>
                {editing && editData.parent_relation === 'other' && (
                  <DetailRow label="Уточнення">
                    <input className="form-input" value={editData.parent_relation_other} onChange={(e) => setEditData({ ...editData, parent_relation_other: e.target.value })} />
                  </DetailRow>
                )}

                {(selectedSubmission.parent2_name || selectedSubmission.parent2_phone || selectedSubmission.parent2_relation || editing) && (
                  <>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--gray-200)', margin: '0.5rem 0' }} />
                    <DetailRow label="Дод. контакт" value={editing ? undefined : (selectedSubmission.parent2_name || '—')}>
                      {editing && <input className="form-input" value={editData.parent2_name} onChange={(e) => setEditData({ ...editData, parent2_name: e.target.value })} />}
                    </DetailRow>
                    <DetailRow label="Тел. дод. контакту" value={editing ? undefined : (selectedSubmission.parent2_phone || '—')}>
                      {editing && <input className="form-input" value={editData.parent2_phone} onChange={(e) => setEditData({ ...editData, parent2_phone: e.target.value })} />}
                    </DetailRow>
                    <DetailRow label="Хто дитині" value={editing ? undefined : getOptionLabel(selectedSubmission.parent2_relation, RELATION_OPTIONS)}>
                      {editing && (
                        <select className="form-input" value={editData.parent2_relation} onChange={(e) => setEditData({ ...editData, parent2_relation: e.target.value })}>
                          <option value="">—</option>
                          {RELATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      )}
                    </DetailRow>
                    {editing && editData.parent2_relation === 'other' && (
                      <DetailRow label="Уточнення">
                        <input className="form-input" value={editData.parent2_relation_other} onChange={(e) => setEditData({ ...editData, parent2_relation_other: e.target.value })} />
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
                      <select className="form-input" value={editData.source} onChange={(e) => setEditData({ ...editData, source: e.target.value })}>
                        <option value="">—</option>
                        {SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    )}
                  </DetailRow>
                )}
                {editing && editData.source === 'other' && (
                  <DetailRow label="Уточнення джерела">
                    <input className="form-input" value={editData.source_other} onChange={(e) => setEditData({ ...editData, source_other: e.target.value })} />
                  </DetailRow>
                )}

                {(selectedSubmission.notes || editing) && (
                  <DetailRow label="Примітки" value={editing ? undefined : (selectedSubmission.notes || '—')}>
                    {editing && <textarea className="form-input" value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />}
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
                        {approving ? 'Збереження...' : 'Затвердити → створити учня'}
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
                      <button className="btn btn-outline" style={{ color: 'var(--danger)' }} onClick={() => handleReject(selectedSubmission)}>Відхилити</button>
                    </>
                  )}
                </div>
              )}

              {selectedSubmission.status === 'approved' && selectedSubmission.student_id && (
                <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px', fontSize: '0.85rem', color: '#166534' }}>
                  Учня створено (ID: {selectedSubmission.student_id})
                  {selectedSubmission.reviewed_at && ` · ${formatDateTime(selectedSubmission.reviewed_at)}`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component
function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', alignItems: 'start' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', fontWeight: 500 }}>{label}</span>
      {children || <span style={{ fontSize: '0.9rem', color: 'var(--gray-900)' }}>{value}</span>}
    </div>
  );
}
