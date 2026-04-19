'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import PageLoading from '@/components/PageLoading';
import { useUser } from '@/components/UserContext';
import { Download, Plus, Trash2, CheckCircle, Clock, XCircle, AlertCircle, Image as ImageIcon, Upload } from 'lucide-react';

interface CertificateData {
  id: number;
  public_id: string;
  amount: number;
  status: 'active' | 'used' | 'expired' | 'canceled';
  issued_at: string;
  used_at: string | null;
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
  const [showDesignModal, setShowDesignModal] = useState(false);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [idSettings, setIdSettings] = useState({
    fontSize: 36,
    xPercent: 50,
    yPercent: 12,
    color: '#000000',
    amountFontSize: 48,
    amountXPercent: 78,
    amountYPercent: 28,
    amountColor: '#FFFFFF',
    amountRotation: -28
  });
  const [savingSettings, setSavingSettings] = useState(false);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">{t('status.active')}</span>;
      case 'used':
        return <span className="badge badge-info">Використано</span>;
      case 'expired':
        return <span className="badge badge-gray">Протерміновано</span>;
      case 'canceled':
        return <span className="badge badge-danger">Скасовано</span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  if (loading) return <PageLoading />;
  if (!user || user.role !== 'admin') return null;

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{t('nav.certificates')}</h3>
          <button className="btn btn-primary" onClick={handleCreate}>
            <Plus size={18} style={{ marginRight: '8px' }} />
            {t('actions.add')}
          </button>
        </div>

        <div className="table-container">
          {certificates.length > 0 ? (
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
                {certificates.map((cert) => (
                  <tr key={cert.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: '500' }}>{cert.public_id}</td>
                    <td style={{ fontWeight: '600' }}>{cert.amount} грн</td>
                    <td>{getStatusBadge(cert.status)}</td>
                    <td style={{ color: '#6b7280' }}>{formatDateKyiv(cert.issued_at)}</td>
                    <td style={{ color: '#6b7280' }}>{cert.creator_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => handleDownload(cert.id, cert.public_id)}
                        title="Завантажити PDF"
                        style={{ padding: '6px 10px' }}
                      >
                        <Download size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <h3 className="empty-state-title">{t('emptyStates.noCertificates')}</h3>
              <p className="empty-state-description">{t('emptyStates.noCertificatesHint')}</p>
              <button className="btn btn-primary" onClick={handleCreate} style={{ marginTop: '16px' }}>
                <Plus size={18} style={{ marginRight: '8px' }} />
                {t('modals.newCertificate')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Unified Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: activeTab === 'design' ? '600px' : '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{t('nav.certificates')}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><XCircle size={20} /></button>
            </div>
            
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: '20px' }}>
              <button 
                onClick={() => setActiveTab('create')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'create' ? '2px solid var(--primary-color)' : 'none',
                  color: activeTab === 'create' ? 'var(--primary-color)' : 'var(--gray-500)',
                  fontWeight: activeTab === 'create' ? '600' : '400',
                  cursor: 'pointer'
                }}
              >
                Генерація
              </button>
              <button 
                onClick={() => setActiveTab('design')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'design' ? '2px solid var(--primary-color)' : 'none',
                  color: activeTab === 'design' ? 'var(--primary-color)' : 'var(--gray-500)',
                  fontWeight: activeTab === 'design' ? '600' : '400',
                  cursor: 'pointer'
                }}
              >
                Дизайн та налаштування
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {activeTab === 'create' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Номінал (грн) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Кількість для генерації *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.count}
                      onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) || 1 })}
                      min="1"
                      max="50"
                    />
                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      Можна згенерувати до 50 сертифікатів за один раз.
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('common.note')}</label>
                    <textarea
                      className="form-input"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Додаткова інформація..."
                      rows={3}
                    />
                  </div>
                  <div className="modal-footer" style={{ padding: '20px 0 0 0', borderTop: 'none' }}>
                    <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                      {t('actions.cancel')}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSave}
                      disabled={saving || formData.amount <= 0 || formData.count <= 0}
                    >
                      {saving ? t('common.saving') : t('actions.create')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <label className="form-label">Попередній перегляд (ID та Номінал)</label>
                    {templateUrl ? (
                      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--gray-200)' }}>
                        <img src={templateUrl} alt="Template" style={{ width: '100%', display: 'block' }} />
                        {/* Preview ID */}
                        <div style={{
                          position: 'absolute',
                          left: `${idSettings.xPercent}%`,
                          bottom: `${idSettings.yPercent}%`,
                          transform: 'translateX(-50%)',
                          fontSize: `${idSettings.fontSize / 4}px`,
                          color: idSettings.color,
                          fontWeight: 'bold',
                          fontFamily: 'Bebas Neue Cyrillic, sans-serif',
                          pointerEvents: 'none',
                          textShadow: '0 0 2px white'
                        }}>
                          CRT-PREVIEW
                        </div>
                        {/* Preview Amount */}
                        <div style={{
                          position: 'absolute',
                          left: `${idSettings.amountXPercent}%`,
                          bottom: `${idSettings.amountYPercent}%`,
                          transform: `translateX(-50%) rotate(${idSettings.amountRotation}deg)`,
                          fontSize: `${idSettings.amountFontSize / 4}px`,
                          color: idSettings.amountColor,
                          fontWeight: 'bold',
                          fontFamily: 'Bebas Neue Cyrillic, sans-serif',
                          pointerEvents: 'none',
                          textShadow: '0 0 2px rgba(0,0,0,0.5)',
                          transformOrigin: 'center center'
                        }}>
                          1000 грн
                        </div>
                      </div>
                    ) : (
                      <div style={{ 
                        height: '150px', 
                        background: 'var(--gray-50)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        border: '2px dashed var(--gray-300)',
                        borderRadius: '8px',
                        color: 'var(--gray-500)'
                      }}>
                        Шаблон не завантажено
                      </div>
                    )}
                  </div>
  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', padding: '16px', background: 'var(--gray-50)', borderRadius: '8px' }}>
                    <div style={{ gridColumn: 'span 2', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>Налаштування ID (CRT-...)</div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Розмір шрифту (pt)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={idSettings.fontSize}
                        onChange={(e) => setIdSettings({ ...idSettings, fontSize: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Колір ID</label>
                      <input 
                        type="color" 
                        className="form-input" 
                        style={{ padding: '2px', height: '38px' }}
                        value={idSettings.color}
                        onChange={(e) => setIdSettings({ ...idSettings, color: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Зліва (%)</label>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={idSettings.xPercent}
                        onChange={(e) => setIdSettings({ ...idSettings, xPercent: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Знизу (%)</label>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={idSettings.yPercent}
                        onChange={(e) => setIdSettings({ ...idSettings, yPercent: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', padding: '16px', background: 'var(--gray-50)', borderRadius: '8px' }}>
                    <div style={{ gridColumn: 'span 2', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>Налаштування номіналу (грн)</div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Розмір (pt)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={idSettings.amountFontSize}
                        onChange={(e) => setIdSettings({ ...idSettings, amountFontSize: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Колір</label>
                      <input 
                        type="color" 
                        className="form-input" 
                        style={{ padding: '2px', height: '38px' }}
                        value={idSettings.amountColor}
                        onChange={(e) => setIdSettings({ ...idSettings, amountColor: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Зліва (%)</label>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={idSettings.amountXPercent}
                        onChange={(e) => setIdSettings({ ...idSettings, amountXPercent: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Знизу (%)</label>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={idSettings.amountYPercent}
                        onChange={(e) => setIdSettings({ ...idSettings, amountYPercent: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Поворот (°)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={idSettings.amountRotation}
                        onChange={(e) => setIdSettings({ ...idSettings, amountRotation: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  
                  <div className="form-group" style={{ padding: '16px', border: '1px solid var(--gray-200)', borderRadius: '8px' }}>
                    <label className="form-label">Оновити дизайн (PNG/JPG)</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type="file" 
                        accept="image/png,image/jpeg" 
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        style={{ fontSize: '14px' }}
                      />
                      {selectedFile && (
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={handleUploadTemplate}
                          disabled={uploading}
                        >
                          <Upload size={16} style={{ marginRight: '8px' }} />
                          {uploading ? '...' : 'Завантажити'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="modal-footer" style={{ padding: '20px 0 0 0', borderTop: 'none', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                      {t('actions.close')}
                    </button>
                    <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings}>
                      {savingSettings ? '...' : 'Зберегти налаштування вигляду'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
