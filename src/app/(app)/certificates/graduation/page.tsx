'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import PageLoading from '@/components/PageLoading';
import { useUser } from '@/components/UserContext';
import { Download, Plus, Trash2, Image as ImageIcon, Upload } from 'lucide-react';

interface CompletionCertificateData {
  id: number;
  student_id: number;
  student_name: string;
  course_id: number | null;
  course_title: string | null;
  group_id: number | null;
  issue_date: string;
  gender: 'male' | 'female';
  creator_name: string | null;
  created_at: string;
}

interface StudentOption {
  id: number;
  full_name: string;
  gender: 'male' | 'female' | null;
}

interface CourseOption {
  id: number;
  title: string;
}

interface BlockSetting {
  key: string;
  font: 'script' | 'roboto';
  size: number;
  xPercent: number;
  yPercent: number;
  color: string;
  align: 'left' | 'center' | 'right';
}

const DEFAULT_BLOCKS: BlockSetting[] = [
  { key: 'student_name', font: 'script', size: 42, xPercent: 50, yPercent: 45, color: '#1a237e', align: 'center' },
  { key: 'verb', font: 'roboto', size: 18, xPercent: 50, yPercent: 38, color: '#1a237e', align: 'center' },
  { key: 'course_name', font: 'roboto', size: 20, xPercent: 50, yPercent: 28, color: '#1565c0', align: 'center' },
  { key: 'issue_date', font: 'roboto', size: 14, xPercent: 80, yPercent: 8, color: '#1a237e', align: 'left' },
];

const BLOCK_LABELS: Record<string, string> = {
  student_name: "Ім'я учня",
  verb: 'Дієслово',
  course_name: 'Назва курсу',
  issue_date: 'Дата видачі',
};

export default function GraduationCertificatesPage() {
  const router = useRouter();
  const { user } = useUser();
  const [certificates, setCertificates] = useState<CompletionCertificateData[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'design'>('create');
  const [formData, setFormData] = useState({
    student_id: '',
    course_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    gender: '' as 'male' | 'female' | '',
  });
  const [saving, setSaving] = useState(false);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [blocks, setBlocks] = useState<BlockSetting[]>(DEFAULT_BLOCKS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user || user.role !== 'admin') {
          router.push('/dashboard');
          return;
        }

        const [certRes, studentRes, courseRes, templateRes, settingsRes] = await Promise.all([
          fetch('/api/completion-certificates'),
          fetch('/api/students'),
          fetch('/api/courses'),
          fetch('/api/completion-certificates/template'),
          fetch('/api/completion-certificates/settings'),
        ]);

        const certData = await certRes.json();
        setCertificates(Array.isArray(certData) ? certData : []);

        const studentData = await studentRes.json();
        setStudents(Array.isArray(studentData.students) ? studentData.students.map((s: any) => ({ id: s.id, full_name: s.full_name, gender: s.gender })) : []);

        const courseData = await courseRes.json();
        setCourses(Array.isArray(courseData.courses) ? courseData.courses.map((c: any) => ({ id: c.id, title: c.title })) : []);

        const templateData = await templateRes.json();
        if (templateData.url) setTemplateUrl(templateData.url);

        const settingsData = await settingsRes.json();
        if (settingsData && !settingsData.error && Array.isArray(settingsData.blocks)) {
          setBlocks(settingsData.blocks);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, user]);

  const handleCreate = () => {
    setFormData({
      student_id: '',
      course_id: '',
      issue_date: new Date().toISOString().slice(0, 10),
      gender: '',
    });
    setActiveTab('create');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.student_id || !formData.issue_date || !formData.gender) return;

    setSaving(true);
    try {
      const res = await fetch('/api/completion-certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || t('toasts.error'));
        return;
      }

      const newCert = await res.json();
      setShowModal(false);
      setCertificates(prev => [newCert, ...prev]);

      // Auto-download PDF
      window.open(`/api/completion-certificates/${newCert.id}/pdf`, '_blank');
    } catch (error) {
      console.error('Failed to save certificate:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = (id: number, studentName: string) => {
    window.open(`/api/completion-certificates/${id}/pdf`, '_blank');
  };

  const handleUploadTemplate = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      const res = await fetch('/api/completion-certificates/template', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Помилка завантаження');
        return;
      }
      const data = await res.json();
      setTemplateUrl(data.url);
      setSelectedFile(null);
      alert('Шаблон успішно оновлено!');
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
      const res = await fetch('/api/completion-certificates/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateUrl, blocks }),
      });
      if (res.ok) alert('Налаштування збережено');
    } catch (e) {
      console.error(e);
      alert('Помилка збереження');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/completion-certificates/${deleteConfirmId}`, { method: 'DELETE' });
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

  const onStudentChange = (studentId: string) => {
    const student = students.find(s => String(s.id) === studentId);
    setFormData(prev => ({
      ...prev,
      student_id: studentId,
      gender: student?.gender || prev.gender,
    }));
  };

  const canCreate = !saving && formData.student_id && formData.issue_date && formData.gender;
  const modalMaxWidth = activeTab === 'design' ? '1000px' : '600px';

  if (loading) return <PageLoading />;
  if (!user || user.role !== 'admin') return null;

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.5rem' }}>
        <button
          className="btn btn-sm"
          onClick={() => router.push('/certificates')}
          style={{
            fontWeight: 400,
            color: '#6b7280',
            borderBottom: '2px solid transparent',
            borderRadius: 0,
            background: 'transparent',
            padding: '0.5rem 0.75rem',
          }}
        >
          Подарункові
        </button>
        <button
          className="btn btn-sm"
          style={{
            fontWeight: 600,
            color: '#111827',
            borderBottom: '2px solid #111827',
            borderRadius: 0,
            background: 'transparent',
            padding: '0.5rem 0.75rem',
          }}
        >
          Про закінчення
        </button>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <h3 className="card-title">Сертифікати про закінчення</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <button className="btn btn-primary" onClick={handleCreate}>
              <Plus size={18} style={{ marginRight: '8px' }} />
              {t('actions.add')}
            </button>
          </div>
        </div>

        <div className="table-container">
          {certificates.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('table.student')}</th>
                  <th>{t('table.course')}</th>
                  <th>Дата видачі</th>
                  <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert) => (
                  <tr key={cert.id}>
                    <td style={{ fontWeight: 600 }}>{cert.student_name}</td>
                    <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{cert.course_title || '—'}</td>
                    <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{formatDateKyiv(cert.issue_date)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDownload(cert.id, cert.student_name)}
                          title="Завантажити PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(cert.id)}
                          title="Видалити"
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
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p style={{ color: 'var(--gray-500)', marginBottom: '1rem' }}>
                Сертифікатів про закінчення ще немає
              </p>
              <button className="btn btn-primary" onClick={handleCreate}>
                <Plus size={18} style={{ marginRight: '8px' }} />
                Створити перший сертифікат
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create / Design Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: modalMaxWidth, width: '95%' }}
          >
            <div className="modal-header">
              <h3 className="modal-title">Новий сертифікат про закінчення</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '12px 20px 0', borderBottom: '1px solid var(--gray-200)' }}>
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
                      borderRadius: '8px 8px 0 0',
                      border: 'none',
                      borderBottom: isActive ? '2px solid var(--gray-900)' : '2px solid transparent',
                      background: isActive ? '#ffffff' : 'transparent',
                      color: isActive ? 'var(--gray-900)' : 'var(--gray-600)',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'color 180ms ease-out, border-color 180ms ease-out',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              {activeTab === 'create' ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Учень <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      className="form-select"
                      value={formData.student_id}
                      onChange={(e) => onStudentChange(e.target.value)}
                    >
                      <option value="">Оберіть учня</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Курс</label>
                    <select
                      className="form-select"
                      value={formData.course_id}
                      onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                    >
                      <option value="">Оберіть курс</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Дата видачі <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.issue_date}
                      onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Стать <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      className="form-select"
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' })}
                    >
                      <option value="">Оберіть стать</option>
                      <option value="female">Жіноча</option>
                      <option value="male">Чоловіча</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '20px' }}>
                  {/* Template Upload */}
                  <div style={{ display: 'grid', gap: '12px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600 }}>Шаблон сертифіката</div>
                    {templateUrl && (
                      <div style={{ position: 'relative', width: '100%', maxHeight: '300px', overflow: 'hidden', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                        <img src={templateUrl} alt="Template" style={{ width: '100%', height: 'auto', display: 'block' }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Upload size={16} />
                        {selectedFile ? selectedFile.name : 'Обрати файл'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          style={{ display: 'none' }}
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      {selectedFile && (
                        <button
                          className="btn btn-primary"
                          onClick={handleUploadTemplate}
                          disabled={uploading}
                        >
                          {uploading ? 'Завантаження…' : 'Завантажити'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Block Settings */}
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ fontWeight: 600 }}>Позиції текстових блоків</div>
                    {blocks.map((block, idx) => (
                      <div key={block.key} style={{ display: 'grid', gap: '8px', padding: '12px', background: '#ffffff', border: '1px solid var(--gray-200)', borderRadius: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{BLOCK_LABELS[block.key] || block.key}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>Розмір шрифту</label>
                            <input
                              type="number"
                              className="form-input"
                              value={block.size}
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[idx].size = parseInt(e.target.value) || 0;
                                setBlocks(newBlocks);
                              }}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>Колір</label>
                            <input
                              type="color"
                              className="form-input"
                              style={{ padding: '4px', height: '40px' }}
                              value={block.color}
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[idx].color = e.target.value;
                                setBlocks(newBlocks);
                              }}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>X (%)</label>
                            <input
                              type="number"
                              className="form-input"
                              min={0}
                              max={100}
                              value={block.xPercent}
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[idx].xPercent = parseFloat(e.target.value) || 0;
                                setBlocks(newBlocks);
                              }}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>Y (%)</label>
                            <input
                              type="number"
                              className="form-input"
                              min={0}
                              max={100}
                              value={block.yPercent}
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[idx].yPercent = parseFloat(e.target.value) || 0;
                                setBlocks(newBlocks);
                              }}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>Шрифт</label>
                            <select
                              className="form-select"
                              value={block.font}
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[idx].font = e.target.value as 'script' | 'roboto';
                                setBlocks(newBlocks);
                              }}
                            >
                              <option value="script">Каліграфічний</option>
                              <option value="roboto">Звичайний</option>
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>Вирівнювання</label>
                            <select
                              className="form-select"
                              value={block.align}
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[idx].align = e.target.value as 'left' | 'center' | 'right';
                                setBlocks(newBlocks);
                              }}
                            >
                              <option value="left">Ліворуч</option>
                              <option value="center">По центру</option>
                              <option value="right">Праворуч</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ minWidth: '112px' }}>
                {t('actions.close')}
              </button>
              {activeTab === 'create' ? (
                <button className="btn btn-primary" onClick={handleSave} disabled={!canCreate} style={{ minWidth: '160px' }}>
                  {saving ? 'Зберігаємо…' : 'Згенерувати PDF'}
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings} style={{ minWidth: '208px' }}>
                  {savingSettings ? 'Зберігаємо…' : 'Зберегти вигляд сертифіката'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId !== null && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Видалити сертифікат?</h3>
              <button className="modal-close" onClick={() => setDeleteConfirmId(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Цю дію неможливо скасувати.</p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                {t('actions.cancel')}
              </button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleteLoading}>
                {deleteLoading ? 'Видалення…' : t('actions.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
