'use client';

import { useState, useEffect, useCallback } from 'react';
import { t } from '@/i18n/t';
import QRCode from 'qrcode';

interface EnrollmentToken {
  id: number;
  token: string;
  expires_at: string;
  used_at: string | null;
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

type Tab = 'submissions' | 'tokens';

const RELATIONS: Record<string, string> = {
  mother: 'Мама', father: 'Тато', grandmother: 'Бабуся',
  grandfather: 'Дідусь', other: 'Інше',
};

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
  const [editData, setEditData] = useState<Partial<Submission>>({});
  const [editing, setEditing] = useState(false);

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
    try {
      const res = await fetch(`/api/enrollment/submissions/${selectedSubmission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedSubmission(updated);
        setEditing(false);
        fetchSubmissions();
      }
    } catch { /* ignore */ }
  };

  const openSubmission = (s: Submission) => {
    setSelectedSubmission(s);
    setEditData({
      child_first_name: s.child_first_name,
      child_last_name: s.child_last_name,
      birth_date: s.birth_date,
      school: s.school,
      parent_name: s.parent_name,
      parent_phone: s.parent_phone,
      parent_relation: s.parent_relation,
      parent2_name: s.parent2_name,
      parent2_phone: s.parent2_phone,
      parent2_relation: s.parent2_relation,
      notes: s.notes,
      source: s.source,
    });
    setEditing(false);
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
    if (token.used_at) return { label: 'Використаний', color: '#64748b' };
    if (new Date(token.expires_at) < new Date()) return { label: 'Протермінований', color: '#ef4444' };
    return { label: 'Активний', color: '#16a34a' };
  };

  const isTokenActive = (token: EnrollmentToken) => !token.used_at && new Date(token.expires_at) >= new Date();

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
              onClick={() => setSelectedSubmission(null)}
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
                  <button onClick={() => setSelectedSubmission(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <DetailRow label="Прізвище" value={editing ? undefined : selectedSubmission.child_last_name}>
                    {editing && <input className="form-input" value={editData.child_last_name || ''} onChange={e => setEditData({ ...editData, child_last_name: e.target.value })} />}
                  </DetailRow>
                  <DetailRow label="Ім'я" value={editing ? undefined : selectedSubmission.child_first_name}>
                    {editing && <input className="form-input" value={editData.child_first_name || ''} onChange={e => setEditData({ ...editData, child_first_name: e.target.value })} />}
                  </DetailRow>
                  <DetailRow label="Дата народження" value={editing ? undefined : (selectedSubmission.birth_date ? formatDate(selectedSubmission.birth_date) : '—')}>
                    {editing && <input type="date" className="form-input" value={editData.birth_date || ''} onChange={e => setEditData({ ...editData, birth_date: e.target.value })} />}
                  </DetailRow>
                  <DetailRow label="Школа" value={editing ? undefined : (selectedSubmission.school || '—')}>
                    {editing && <input className="form-input" value={editData.school || ''} onChange={e => setEditData({ ...editData, school: e.target.value })} />}
                  </DetailRow>

                  <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

                  <DetailRow label="Контактна особа" value={editing ? undefined : selectedSubmission.parent_name}>
                    {editing && <input className="form-input" value={editData.parent_name || ''} onChange={e => setEditData({ ...editData, parent_name: e.target.value })} />}
                  </DetailRow>
                  <DetailRow label="Телефон" value={editing ? undefined : selectedSubmission.parent_phone}>
                    {editing && <input className="form-input" value={editData.parent_phone || ''} onChange={e => setEditData({ ...editData, parent_phone: e.target.value })} />}
                  </DetailRow>
                  <DetailRow label="Хто дитині" value={editing ? undefined : (RELATIONS[selectedSubmission.parent_relation || ''] || selectedSubmission.parent_relation || '—')}>
                    {editing && (
                      <select className="form-input" value={editData.parent_relation || ''} onChange={e => setEditData({ ...editData, parent_relation: e.target.value })}>
                        <option value="">—</option>
                        {Object.entries(RELATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    )}
                  </DetailRow>

                  {(selectedSubmission.parent2_name || editing) && (
                    <>
                      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />
                      <DetailRow label="Дод. контакт" value={editing ? undefined : (selectedSubmission.parent2_name || '—')}>
                        {editing && <input className="form-input" value={editData.parent2_name || ''} onChange={e => setEditData({ ...editData, parent2_name: e.target.value })} />}
                      </DetailRow>
                      <DetailRow label="Тел. дод. контакту" value={editing ? undefined : (selectedSubmission.parent2_phone || '—')}>
                        {editing && <input className="form-input" value={editData.parent2_phone || ''} onChange={e => setEditData({ ...editData, parent2_phone: e.target.value })} />}
                      </DetailRow>
                    </>
                  )}

                  {(selectedSubmission.source || editing) && (
                    <DetailRow label="Джерело" value={editing ? undefined : (selectedSubmission.source || '—')}>
                      {editing && <input className="form-input" value={editData.source || ''} onChange={e => setEditData({ ...editData, source: e.target.value })} />}
                    </DetailRow>
                  )}

                  {(selectedSubmission.notes || editing) && (
                    <DetailRow label="Примітки" value={editing ? undefined : (selectedSubmission.notes || '—')}>
                      {editing && <textarea className="form-input" value={editData.notes || ''} onChange={e => setEditData({ ...editData, notes: e.target.value })} />}
                    </DetailRow>
                  )}
                </div>

                {/* Actions */}
                {selectedSubmission.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                    {editing ? (
                      <>
                        <button className="btn btn-primary" onClick={handleSaveEdit}>Зберегти</button>
                        <button className="btn btn-outline" onClick={() => setEditing(false)}>Скасувати</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-primary" onClick={() => handleApprove(selectedSubmission)} disabled={approving}>
                          {approving ? 'Збереження...' : '✓ Затвердити → створити учня'}
                        </button>
                        <button className="btn btn-secondary" onClick={() => setEditing(true)}>Редагувати</button>
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
