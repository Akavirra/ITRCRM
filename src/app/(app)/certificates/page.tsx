'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import PageLoading from '@/components/PageLoading';
import { useUser } from '@/components/UserContext';
import { Download, Plus, CheckCircle, XCircle, AlertCircle, Image as ImageIcon, Upload, Printer, Trash2 } from 'lucide-react';

interface CertificateData {
  id: number;
  public_id: string;
  amount: number;
  status: 'active' | 'used' | 'expired' | 'canceled';
  issued_at: string;
  used_at: string | null;
  printed_at: string | null;
  notes: string | null;
  creator_name: string | null;
  created_at: string;
}

export default function CertificatesPage() {
  const router = useRouter();
  const { user } = useUser();
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'design'>('create');
  const [formData, setFormData] = useState({ amount: 1000, notes: '', count: 1 });
  const [saving, setSaving] = useState(false);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState<'id' | 'amount' | null>(null);
  const [idSettings, setIdSettings] = useState({
    fontSize: 36,
    xPercent: 50,
    yPercent: 12,
    color: '#000000',
    idLetterSpacing: 1.5,
    amountFontSize: 48,
    amountXPercent: 78,
    amountYPercent: 28,
    amountColor: '#FFFFFF',
    amountRotation: -28
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 842, height: 595 });
  const [nextPublicId, setNextPublicId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const presetAmounts = [500, 1000, 2000];
  const isCustomAmount = !presetAmounts.includes(formData.amount);
  const canCreate = !saving && formData.amount > 0 && formData.count > 0;
  const modalMaxWidth = activeTab === 'design' ? '1200px' : '600px';
  const totalAmount = Math.max(formData.amount, 0) * Math.max(formData.count, 0);
  const selectedTemplateName = selectedFile?.name || 'Файл не вибрано';

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        if (!user || user.role !== 'admin') {
          router.push('/dashboard');
          return;
        }

        const res = await fetch('/api/admin-app/certificates');
        const data = await res.json();
        setCertificates(Array.isArray(data) ? data : []);

        const templateRes = await fetch('/api/admin-app/certificates/template');
        const templateData = await templateRes.json();
        if (templateData.url) setTemplateUrl(templateData.url);

        const settingsRes = await fetch('/api/admin-app/certificates/settings');
        const settingsData = await settingsRes.json();
        if (settingsData && !settingsData.error) setIdSettings(settingsData);

        const nextRes = await fetch('/api/admin-app/certificates/next-id');
        const nextData = await nextRes.json();
        if (nextData && nextData.nextId) setNextPublicId(nextData.nextId);
      } catch (error) {
        console.error('Failed to fetch certificates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCertificates();
  }, [router, user]);

  const handleCreate = () => {
    setFormData({ amount: 1000, notes: '', count: 1 });
    setActiveTab('create');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (formData.amount <= 0 || formData.count <= 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin-app/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || t('toasts.error'));
        return;
      }

      setShowModal(false);
      const refreshRes = await fetch('/api/admin-app/certificates');
      const refreshData = await refreshRes.json();
      setCertificates(Array.isArray(refreshData) ? refreshData : []);
    } catch (error) {
      console.error('Failed to save certificate:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = (id: number, publicId: string) => {
    window.open(`/api/admin-app/certificates/${id}/pdf`, '_blank');
  };

  const handleUploadTemplate = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);

      const res = await fetch('/api/admin-app/certificates/template', {
        method: 'POST',
        body: fd
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Помилка завантаження');
        return;
      }

      const data = await res.json();
      setTemplateUrl(data.url);
      setSelectedFile(null);
      alert('Дизайн успішно оновлено!');
    } catch (e) {
      console.error(e);
      alert('Помилка завантаження');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin-app/certificates/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(idSettings)
      });
      if (res.ok) alert('Налаштування збережено');
    } catch (e) {
      console.error(e);
      alert('Помилка збереження');
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePrintToggle = async (id: number, isPrinted: boolean) => {
    try {
      const res = await fetch(`/api/admin-app/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isPrinted ? 'unprint' : 'print' })
      });
      if (!res.ok) throw new Error('Failed');
      setCertificates(prev => prev.map(c => c.id === id ? { ...c, printed_at: isPrinted ? null : new Date().toISOString() } : c));
    } catch (e) {
      console.error(e);
      alert('Помилка оновлення статусу друку');
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin-app/certificates/${deleteConfirmId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setCertificates(prev => prev.filter(c => c.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (e) {
      console.error(e);
      alert('Помилка видалення');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;

    const container = e.currentTarget.getBoundingClientRect();

    // Calculate percentages relative to the container
    let x = ((e.clientX - container.left) / container.width) * 100;
    let y = 100 - (((e.clientY - container.top) / container.height) * 100);

    // Constrain to 0-100
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    if (dragging === 'id') {
      setIdSettings(prev => ({ ...prev, xPercent: parseFloat(x.toFixed(2)), yPercent: parseFloat(y.toFixed(2)) }));
    } else if (dragging === 'amount') {
      setIdSettings(prev => ({ ...prev, amountXPercent: parseFloat(x.toFixed(2)), amountYPercent: parseFloat(y.toFixed(2)) }));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const getStatusBadge = (cert: CertificateData) => {
    if (cert.status === 'used') return <span className="badge badge-info">Використано</span>;
    if (cert.status === 'expired') return <span className="badge badge-gray">Протерміновано</span>;
    if (cert.status === 'canceled') return <span className="badge badge-danger">Скасовано</span>;
    if (cert.printed_at) return <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>Надруковано</span>;
    return <span className="badge badge-success">{t('status.active')}</span>;
  };

  if (loading) return <PageLoading />;
  if (!user || user.role !== 'admin') return null;

  const filteredCertificates = certificates.filter(c => showArchived ? !!c.printed_at : !c.printed_at);

  return (
    <>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <h3 className="card-title">{t('nav.certificates')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: !showArchived ? '600' : '400', color: !showArchived ? '#111827' : '#9ca3af', transition: 'all 0.2s' }}>
                Активні
              </span>
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                style={{
                  position: 'relative',
                  width: '36px',
                  height: '20px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  margin: '0 0.375rem',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                }}
              >
                <div style={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: showArchived ? '#6b7280' : '#374151',
                  borderRadius: '3px',
                  transition: 'all 0.2s',
                  transform: showArchived ? 'translateX(16px)' : 'translateX(0)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }} />
              </button>
              <span style={{ fontSize: '0.8125rem', fontWeight: showArchived ? '600' : '400', color: showArchived ? '#111827' : '#9ca3af', transition: 'all 0.2s' }}>
                Архів
              </span>
            </div>
            <button className="btn btn-primary" onClick={handleCreate}>
              <Plus size={18} style={{ marginRight: '8px' }} />
              {t('actions.add')}
            </button>
          </div>
        </div>

        <div className="table-container">
          {filteredCertificates.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('table.id')}</th>
                  <th>Номінал</th>
                  <th>{t('common.status')}</th>
                  <th>Дата видачі</th>
                  <th>Ким видано</th>
                  <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCertificates.map((cert) => (
                  <tr key={cert.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280' }}>{cert.public_id}</td>
                    <td style={{ fontWeight: '600' }}>{cert.amount} грн</td>
                    <td>{getStatusBadge(cert)}</td>
                    <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{formatDateKyiv(cert.issued_at)}</td>
                    <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{cert.creator_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => handlePrintToggle(cert.id, !!cert.printed_at)}
                          title={cert.printed_at ? 'Надруковано' : 'Позначити як надруковано'}
                          style={{
                            padding: '6px 10px',
                            background: cert.printed_at ? '#dcfce7' : 'transparent',
                            color: cert.printed_at ? '#16a34a' : 'var(--gray-500)',
                            border: cert.printed_at ? '1px solid #16a34a' : '1px solid var(--gray-300)'
                          }}
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDownload(cert.id, cert.public_id)}
                          title="Завантажити PDF"
                          style={{ padding: '6px 10px' }}
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(cert.id)}
                          title="Видалити"
                          style={{ padding: '6px 10px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <h3 className="empty-state-title">{showArchived ? 'Архів порожній' : t('emptyStates.noCertificates')}</h3>
              <p className="empty-state-description">{showArchived ? 'Надруковані сертифікати з\'являться тут.' : t('emptyStates.noCertificatesHint')}</p>
              {!showArchived && (
                <button className="btn btn-primary" onClick={handleCreate} style={{ marginTop: '16px' }}>
                  <Plus size={18} style={{ marginRight: '8px' }} />
                  {t('modals.newCertificate')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirmId !== null && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px', width: '100%' }}
          >
            <div className="modal-header">
              <h3 className="modal-title">Видалення сертифіката</h3>
              <button className="modal-close" onClick={() => setDeleteConfirmId(null)} aria-label="Закрити">
                <XCircle size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: 'var(--gray-700)', fontSize: '14px', lineHeight: '20px' }}>
                Ви впевнені, що хочете безповоротно видалити цей сертифікат? Дію не можна скасувати.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                Скасувати
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleteLoading}
                style={{ minWidth: '120px' }}
              >
                {deleteLoading ? 'Видалення…' : 'Видалити'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: modalMaxWidth,
              width: '100%',
              maxHeight: '92vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--gray-200)',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)'
            }}
          >
            <div className="modal-header" style={{ padding: '24px 24px 16px 24px', alignItems: 'flex-start', flexShrink: 0 }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                <h3 className="modal-title" style={{ margin: 0 }}>Сертифікат на навчання</h3>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: 'var(--gray-600)' }}>
                  {activeTab === 'create'
                    ? 'Швидко створюйте сертифікати з готовими номіналами або власною сумою.'
                    : 'Підженіть позиції та вигляд елементів на сертифікаті без зайвих налаштувань.'}
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Закрити модальне вікно"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 160ms ease-out, color 160ms ease-out, transform 120ms ease-out'
                }}
              >
                <XCircle size={20} />
              </button>
            </div>

            <div style={{ padding: '0 24px 16px 24px', flexShrink: 0 }}>
              <div
                style={{
                  display: 'inline-flex',
                  gap: '4px',
                  padding: '4px',
                  background: 'var(--gray-100)',
                  borderRadius: '12px',
                  border: '1px solid var(--gray-200)'
                }}
              >
                {[
                  { id: 'create', label: 'Генерація' },
                  { id: 'design', label: 'Дизайн' },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'create' | 'design')}
                      style={{
                        height: '36px',
                        padding: '0 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isActive ? 'var(--gray-900)' : 'transparent',
                        color: isActive ? '#ffffff' : 'var(--gray-600)',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background-color 180ms ease-out, color 180ms ease-out, transform 120ms ease-out'
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '0 24px 24px 24px', flex: '1 1 auto' }}>
              {activeTab === 'create' ? (
                <div style={{ display: 'grid', gap: '24px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gap: '16px',
                      padding: '24px',
                      background: 'var(--gray-50)',
                      border: '1px solid var(--gray-200)',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <span style={{ fontSize: '16px', lineHeight: '24px', fontWeight: 600, color: 'var(--gray-900)' }}>
                        Параметри генерації
                      </span>
                      <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-600)' }}>
                        Оберіть суму, кількість і, за бажанням, додайте внутрішню нотатку.
                      </span>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Номінал</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {presetAmounts.map((amount) => {
                          const isActive = formData.amount === amount;
                          return (
                            <button
                              key={amount}
                              type="button"
                              onClick={() => setFormData({ ...formData, amount })}
                              style={{
                                height: '40px',
                                padding: '0 16px',
                                borderRadius: '8px',
                                border: isActive ? '1px solid var(--primary)' : '1px solid var(--gray-300)',
                                background: isActive ? 'var(--primary-light)' : '#ffffff',
                                color: isActive ? 'var(--primary-dark)' : 'var(--gray-700)',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background-color 180ms ease-out, border-color 180ms ease-out, color 180ms ease-out, transform 120ms ease-out'
                              }}
                            >
                              {amount} грн
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, amount: 0 })}
                          style={{
                            height: '40px',
                            padding: '0 16px',
                            borderRadius: '8px',
                            border: isCustomAmount ? '1px solid var(--primary)' : '1px solid var(--gray-300)',
                            background: isCustomAmount ? 'var(--primary-light)' : '#ffffff',
                            color: isCustomAmount ? 'var(--primary-dark)' : 'var(--gray-700)',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background-color 180ms ease-out, border-color 180ms ease-out, color 180ms ease-out, transform 120ms ease-out'
                          }}
                        >
                          Свій номінал
                        </button>
                      </div>
                      {isCustomAmount && (
                        <div style={{ marginTop: '12px' }}>
                          <input
                            type="number"
                            className="form-input"
                            placeholder="Введіть суму в грн"
                            value={formData.amount === 0 ? '' : formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                            min="1"
                          />
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Кількість</label>
                        <input
                          type="number"
                          className="form-input"
                          value={formData.count}
                          onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) || 1 })}
                          min="1"
                          max="50"
                        />
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gap: '4px',
                          padding: '12px 16px',
                          background: '#ffffff',
                          border: '1px solid var(--gray-200)',
                          borderRadius: '8px',
                          alignContent: 'center'
                        }}
                      >
                        <span style={{ fontSize: '12px', lineHeight: '16px', fontWeight: 500, color: 'var(--gray-500)' }}>
                          Підсумок
                        </span>
                        <span style={{ fontSize: '16px', lineHeight: '24px', fontWeight: 600, color: 'var(--gray-900)' }}>
                          {formData.count} шт. · {totalAmount} грн
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: '16px',
                      padding: '24px',
                      background: '#ffffff',
                      border: '1px solid var(--gray-200)',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <span style={{ fontSize: '16px', lineHeight: '24px', fontWeight: 600, color: 'var(--gray-900)' }}>
                        Додаткова інформація
                      </span>
                      <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-600)' }}>
                        Нотатка необов’язкова і потрібна лише для внутрішнього обліку.
                      </span>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">{t('common.note')}</label>
                      <textarea
                        className="form-input"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Наприклад: для розіграшу, для подарунка, для акції"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '16px',
                      background: 'var(--primary-light)',
                      border: '1px solid var(--gray-200)',
                      borderRadius: '12px',
                      alignItems: 'flex-start'
                    }}
                  >
                    <CheckCircle size={18} style={{ color: 'var(--primary-dark)', flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: 600, color: 'var(--gray-900)' }}>
                        Перед створенням
                      </span>
                      <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-700)' }}>
                        Буде згенеровано {formData.count} сертифікат(ів) номіналом {formData.amount || 0} грн. Максимум за раз — 50.
                      </span>
                    </div>
                  </div>

                  <div className="modal-footer" style={{ padding: 0, borderTop: 'none', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ minWidth: '112px' }}>
                      {t('actions.cancel')}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSave}
                      disabled={!canCreate}
                      style={{ minWidth: '168px' }}
                    >
                      {saving ? 'Створюємо…' : 'Створити сертифікати'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '24px' }}>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <span style={{ fontSize: '16px', lineHeight: '24px', fontWeight: 600, color: 'var(--gray-900)' }}>
                      Редактор дизайну
                    </span>
                    <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-600)' }}>
                      Перетягуйте елементи на прев’ю або налаштовуйте точно в панелі справа.
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(480px, 1.45fr) minmax(360px, 1fr)', gap: '24px', alignItems: 'start' }}>
                    <div
                      style={{
                        position: 'sticky',
                        top: '16px',
                        display: 'grid',
                        gap: '12px',
                        padding: '20px',
                        background: 'var(--gray-50)',
                        border: '1px solid var(--gray-200)',
                        borderRadius: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: 600, color: 'var(--gray-900)' }}>
                          Прев’ю сертифіката
                        </span>
                        <span style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--gray-500)' }}>
                          Тягніть елементи мишкою
                        </span>
                      </div>
                      {templateUrl ? (
                        <div
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                          style={{
                            position: 'relative',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid var(--gray-200)',
                            cursor: dragging ? 'grabbing' : 'crosshair',
                            userSelect: 'none',
                            containerType: 'inline-size',
                            background: '#ffffff'
                          }}
                        >
                          <img
                            src={templateUrl}
                            alt="Template"
                            onLoad={(e) => setImageDimensions({ width: e.currentTarget.naturalWidth || 842, height: e.currentTarget.naturalHeight || 595 })}
                            style={{ width: '100%', display: 'block', pointerEvents: 'none' }}
                          />

                          <div
                            onMouseDown={(e) => { e.stopPropagation(); setDragging('id'); }}
                            style={{
                              position: 'absolute',
                              left: `${idSettings.xPercent}%`,
                              bottom: `${idSettings.yPercent}%`,
                              transform: 'translateX(-50%)',
                              fontSize: `${(idSettings.fontSize / imageDimensions.width) * 100}cqi`,
                              color: idSettings.color,
                              fontWeight: 400,
                              fontFamily: 'var(--font-certificate-id), sans-serif',
                              letterSpacing: `${(idSettings.idLetterSpacing / imageDimensions.width) * 100}cqi`,
                              cursor: 'grab',
                              padding: '0.5cqi',
                              whiteSpace: 'nowrap',
                              border: dragging === 'id' ? '1px dashed var(--primary)' : '1px solid transparent',
                              background: dragging === 'id' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                              lineHeight: 1
                            }}
                          >
                            {nextPublicId || 'ID:85331'}
                          </div>

                          <div
                            onMouseDown={(e) => { e.stopPropagation(); setDragging('amount'); }}
                            style={{
                              position: 'absolute',
                              left: `${idSettings.amountXPercent}%`,
                              bottom: `${idSettings.amountYPercent}%`,
                              transform: `translateX(-50%) rotate(${idSettings.amountRotation}deg)`,
                              color: idSettings.amountColor,
                              fontWeight: 400,
                              fontFamily: 'var(--font-certificate-amount), sans-serif',
                              cursor: 'grab',
                              transformOrigin: 'center center',
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                              padding: '0.5cqi',
                              border: dragging === 'amount' ? '1px dashed var(--primary)' : '1px solid transparent',
                              background: dragging === 'amount' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                              lineHeight: 1
                            }}
                          >
                            <div style={{ fontSize: `${(idSettings.amountFontSize / imageDimensions.width) * 100}cqi`, pointerEvents: 'none' }}>{formData.amount}</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          height: '220px',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px dashed var(--gray-300)',
                          borderRadius: '12px',
                          color: 'var(--gray-500)'
                        }}>
                          Шаблон не завантажено
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gap: '16px' }}>
                      <div
                        style={{
                          display: 'grid',
                          gap: '16px',
                          padding: '20px',
                          background: '#ffffff',
                          border: '1px solid var(--gray-200)',
                          borderRadius: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <ImageIcon size={18} style={{ color: 'var(--gray-600)', flexShrink: 0, marginTop: '1px' }} />
                          <div style={{ display: 'grid', gap: '4px' }}>
                            <span style={{ fontSize: '16px', lineHeight: '24px', fontWeight: 600, color: 'var(--gray-900)' }}>
                              Шаблон сертифіката
                            </span>
                            <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-600)' }}>
                              Оновіть фон через одну спокійну дію, без системних елементів інтерфейсу.
                            </span>
                          </div>
                        </div>

                        <input
                          id="certificate-template-upload"
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          style={{ display: 'none' }}
                        />

                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '12px',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px',
                            background: 'var(--gray-50)',
                            border: '1px solid var(--gray-200)',
                            borderRadius: '12px'
                          }}
                        >
                          <div style={{ display: 'grid', gap: '4px', minWidth: 0, flex: '1 1 220px' }}>
                            <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
                              Обраний файл
                            </span>
                            <span
                              style={{
                                fontSize: '14px',
                                lineHeight: '20px',
                                fontWeight: 500,
                                color: selectedFile ? 'var(--gray-900)' : 'var(--gray-600)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {selectedTemplateName}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <label
                              htmlFor="certificate-template-upload"
                              style={{
                                height: '36px',
                                padding: '0 16px',
                                borderRadius: '8px',
                                border: '1px solid var(--gray-300)',
                                background: '#ffffff',
                                color: 'var(--gray-800)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'background-color 160ms ease-out, border-color 160ms ease-out, transform 120ms ease-out'
                              }}
                            >
                              Обрати файл
                            </label>

                            <button
                              className="btn btn-primary btn-sm"
                              onClick={handleUploadTemplate}
                              disabled={!selectedFile || uploading}
                              style={{ minWidth: '132px' }}
                            >
                              <Upload size={16} />
                              {uploading ? 'Завантаження…' : 'Оновити'}
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--gray-500)' }}>
                          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                          <span style={{ fontSize: '13px', lineHeight: '18px' }}>
                            Підтримуються формати PNG та JPG.
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    <div
                      style={{
                        display: 'grid',
                        gap: '16px',
                        padding: '20px',
                        background: '#ffffff',
                        border: '1px solid var(--gray-200)',
                        borderRadius: '12px'
                      }}
                    >
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <span style={{ fontSize: '16px', lineHeight: '24px', fontWeight: 600, color: 'var(--gray-900)' }}>
                          ID сертифіката
                        </span>
                        <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-600)' }}>
                          Контролюйте розмір, колір та позицію підпису.
                        </span>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Розмір шрифту</label>
                        <input
                          type="number"
                          className="form-input"
                          value={idSettings.fontSize}
                          onChange={(e) => setIdSettings({ ...idSettings, fontSize: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Колір</label>
                        <input
                          type="color"
                          className="form-input"
                          style={{ padding: '4px', height: '40px' }}
                          value={idSettings.color}
                          onChange={(e) => setIdSettings({ ...idSettings, color: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Позиція зліва: {idSettings.xPercent}%</label>
                        <input
                          type="range"
                          min="0" max="100"
                          value={idSettings.xPercent}
                          onChange={(e) => setIdSettings({ ...idSettings, xPercent: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Позиція знизу: {idSettings.yPercent}%</label>
                        <input
                          type="range"
                          min="0" max="100"
                          value={idSettings.yPercent}
                          onChange={(e) => setIdSettings({ ...idSettings, yPercent: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Відступ між символами</label>
                        <input
                          type="range"
                          min="0" max="10" step="0.5"
                          value={idSettings.idLetterSpacing}
                          onChange={(e) => setIdSettings({ ...idSettings, idLetterSpacing: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gap: '16px',
                        padding: '20px',
                        background: '#ffffff',
                        border: '1px solid var(--gray-200)',
                        borderRadius: '12px'
                      }}
                    >
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <span style={{ fontSize: '16px', lineHeight: '24px', fontWeight: 600, color: 'var(--gray-900)' }}>
                          Номінал
                        </span>
                        <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-600)' }}>
                          Налаштуйте суму так, щоб вона читалась чітко на шаблоні.
                        </span>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Розмір шрифту</label>
                        <input
                          type="number"
                          className="form-input"
                          value={idSettings.amountFontSize}
                          onChange={(e) => setIdSettings({ ...idSettings, amountFontSize: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Колір</label>
                        <input
                          type="color"
                          className="form-input"
                          style={{ padding: '4px', height: '40px' }}
                          value={idSettings.amountColor}
                          onChange={(e) => setIdSettings({ ...idSettings, amountColor: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Позиція зліва: {idSettings.amountXPercent}%</label>
                        <input
                          type="range"
                          min="0" max="100"
                          value={idSettings.amountXPercent}
                          onChange={(e) => setIdSettings({ ...idSettings, amountXPercent: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Позиція знизу: {idSettings.amountYPercent}%</label>
                        <input
                          type="range"
                          min="0" max="100"
                          value={idSettings.amountYPercent}
                          onChange={(e) => setIdSettings({ ...idSettings, amountYPercent: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Поворот</label>
                        <input
                          type="number"
                          className="form-input"
                          value={idSettings.amountRotation}
                          onChange={(e) => setIdSettings({ ...idSettings, amountRotation: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer" style={{ padding: 0, borderTop: 'none', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ minWidth: '112px' }}>
                      {t('actions.close')}
                    </button>
                    <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings} style={{ minWidth: '208px' }}>
                      {savingSettings ? 'Зберігаємо…' : 'Зберегти вигляд сертифіката'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
