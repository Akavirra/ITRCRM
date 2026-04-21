'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import PageLoading from '@/components/PageLoading';
import { useUser } from '@/components/UserContext';
import { Download, Plus, Trash2, Upload, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

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
  size: number;
  xPercent: number;
  yPercent: number;
  color: string;
  align: 'left' | 'center' | 'right';
  weight: 'normal' | 'bold';
  style: 'normal' | 'italic';
}

const DEFAULT_BLOCKS: BlockSetting[] = [
  { key: 'student_name', size: 42, xPercent: 50, yPercent: 45, color: '#1a237e', align: 'center', weight: 'normal', style: 'normal' },
  { key: 'verb', size: 18, xPercent: 50, yPercent: 38, color: '#1a237e', align: 'center', weight: 'normal', style: 'normal' },
  { key: 'course_name', size: 20, xPercent: 50, yPercent: 28, color: '#1565c0', align: 'center', weight: 'normal', style: 'normal' },
  { key: 'issue_date', size: 14, xPercent: 80, yPercent: 8, color: '#1a237e', align: 'left', weight: 'normal', style: 'normal' },
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
  const [dragging, setDragging] = useState<{ index: number; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ index: number; startSize: number; startY: number } | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 842, height: 595 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const previewRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = resizing.startY - e.clientY;
      const newSize = Math.max(8, resizing.startSize + delta * 0.3);
      setBlocks(prev => {
        const next = [...prev];
        next[resizing.index] = { ...next[resizing.index], size: Math.round(newSize) };
        return next;
      });
    };
    const handleUp = () => setResizing(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  useEffect(() => {
    const fit = () => {
      if (!viewportRef.current || !previewRef.current) return;
      const vw = viewportRef.current.clientWidth;
      const vh = viewportRef.current.clientHeight;
      if (!vw || !vh || !imageDimensions.height) return;
      const contentHeight = vw * (imageDimensions.height / imageDimensions.width);
      const s = Math.min(1, vh / contentHeight);
      setScale(s);
      setPan({ x: 0, y: 0 });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [imageDimensions, templateUrl]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(prev => {
          const next = Math.max(0.1, Math.min(5, prev + delta));
          return Math.round(next * 10) / 10;
        });
      } else {
        const speed = 1.5;
        setPan(prev => ({ x: prev.x - e.deltaX * speed, y: prev.y - e.deltaY * speed }));
      }
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && selectedBlock === null && e.target === e.currentTarget)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    if (!dragging) return;
    const container = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - container.left - dragging.offsetX) / container.width) * 100;
    let y = 100 - (((e.clientY - container.top - dragging.offsetY) / container.height) * 100);
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    setBlocks(prev => {
      const next = [...prev];
      next[dragging.index] = { ...next[dragging.index], xPercent: parseFloat(x.toFixed(2)), yPercent: parseFloat(y.toFixed(2)) };
      return next;
    });
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

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
            style={{ maxWidth: '1100px', width: '100%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--gray-200)', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)' }}
          >
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h3 className="modal-title">Новий сертифікат про закінчення</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ overflow: 'hidden', flex: '1 1 auto', padding: '20px', display: 'flex', gap: '20px' }}>
              <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
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
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
                  {/* Template Upload */}
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
                      <button className="btn btn-primary" onClick={handleUploadTemplate} disabled={uploading}>
                        {uploading ? 'Завантаження…' : 'Завантажити'}
                      </button>
                    )}
                  </div>

                  {templateUrl ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{Math.round(scale * 100)}%</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => setScale(s => Math.max(0.1, Math.round((s - 0.1) * 10) / 10))}>−</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} title="Скинути">⟲</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => setScale(s => Math.min(5, Math.round((s + 0.1) * 10) / 10))}>+</button>
                        </div>
                      </div>
                      <div
                        ref={viewportRef}
                        style={{
                          position: 'relative',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          border: '1px solid var(--gray-200)',
                          background: '#f8fafc',
                          height: '55vh',
                          cursor: isPanning ? 'grabbing' : 'default',
                        }}
                      >
                        <div
                          ref={previewRef}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                          onClick={(e) => { if (e.target === e.currentTarget) setSelectedBlock(null); }}
                          onMouseDown={handleCanvasMouseDown}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: '100%',
                            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
                            transformOrigin: 'center center',
                            cursor: dragging !== null ? 'grabbing' : isPanning ? 'grabbing' : 'crosshair',
                            userSelect: 'none',
                            containerType: 'inline-size',
                          }}
                        >
                        <img
                          src={templateUrl}
                          alt="Template"
                          onLoad={(e) => setImageDimensions({ width: e.currentTarget.naturalWidth || 842, height: e.currentTarget.naturalHeight || 595 })}
                          style={{ width: '100%', display: 'block', pointerEvents: 'none' }}
                        />
                      {blocks.map((block, idx) => {
                        const isSelected = selectedBlock === idx;
                        const isName = block.key === 'student_name';
                        return (
                          <div
                            key={block.key}
                            onClick={(e) => { e.stopPropagation(); setSelectedBlock(idx); }}
                            onMouseDown={(e) => {
                              if (!isSelected) return;
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDragging({
                                index: idx,
                                offsetX: e.clientX - (rect.left + rect.width / 2),
                                offsetY: e.clientY - (rect.top + rect.height / 2),
                              });
                            }}
                            style={{
                              position: 'absolute',
                              left: `${block.xPercent}%`,
                              bottom: `${block.yPercent}%`,
                              transform: `translateX(-50%)`,
                              fontSize: `${(block.size / imageDimensions.width) * 100}cqw`,
                              color: block.color,
                              fontFamily: isName ? "'Cassandra', cursive" : "'Montserrat', sans-serif",
                              fontWeight: block.weight === 'bold' ? 700 : 400,
                              fontStyle: block.style === 'italic' ? 'italic' : 'normal',
                              cursor: isSelected ? 'grab' : 'pointer',
                              padding: '0.5cqw',
                              whiteSpace: 'normal',
                              border: isSelected ? '1px dashed var(--primary)' : '1px solid transparent',
                              background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                              lineHeight: 1,
                              textAlign: block.align,
                              zIndex: isSelected ? 10 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                (e.currentTarget as HTMLDivElement).style.border = '1px dashed rgba(37, 99, 235, 0.4)';
                                (e.currentTarget as HTMLDivElement).style.background = 'rgba(59, 130, 246, 0.04)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                (e.currentTarget as HTMLDivElement).style.border = '1px solid transparent';
                                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                              }
                            }}
                          >
                            {/* Toolbar */}
                            {isSelected && (
                              <div
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: '50%',
                                  transform: `translateX(-50%) scale(${Math.min(2.5, 1 / scale)})`,
                                  transformOrigin: 'bottom center',
                                  marginBottom: '6px',
                                  display: 'flex',
                                  gap: '4px',
                                  padding: '4px',
                                  background: '#ffffff',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                  border: '1px solid var(--gray-200)',
                                  zIndex: 20,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <input
                                  type="color"
                                  value={block.color}
                                  onChange={(e) => {
                                    const newBlocks = [...blocks];
                                    newBlocks[idx].color = e.target.value;
                                    setBlocks(newBlocks);
                                  }}
                                  style={{ width: '28px', height: '28px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                />
                                {([
                                  { a: 'left' as const, icon: AlignLeft },
                                  { a: 'center' as const, icon: AlignCenter },
                                  { a: 'right' as const, icon: AlignRight },
                                ]).map(({ a, icon: Icon }) => (
                                  <button
                                    key={a}
                                    onClick={() => {
                                      const newBlocks = [...blocks];
                                      newBlocks[idx].align = a;
                                      setBlocks(newBlocks);
                                    }}
                                    title={a === 'left' ? 'По лівому краю' : a === 'center' ? 'По центру' : 'По правому краю'}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '4px',
                                      border: 'none',
                                      background: block.align === a ? 'var(--gray-900)' : 'transparent',
                                      color: block.align === a ? '#fff' : 'var(--gray-600)',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Icon size={14} />
                                  </button>
                                ))}
                                {([
                                  { label: 'N', w: 'normal', s: 'normal', title: 'Звичайний' },
                                  { label: 'B', w: 'bold', s: 'normal', title: 'Жирний' },
                                  { label: 'I', w: 'normal', s: 'italic', title: 'Курсив' },
                                  { label: 'BI', w: 'bold', s: 'italic', title: 'Жирний курсив' },
                                ] as const).map((ws) => (
                                  <button
                                    key={ws.label}
                                    onClick={() => {
                                      const newBlocks = [...blocks];
                                      newBlocks[idx].weight = ws.w;
                                      newBlocks[idx].style = ws.s;
                                      setBlocks(newBlocks);
                                    }}
                                    title={ws.title}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '4px',
                                      border: 'none',
                                      background: block.weight === ws.w && block.style === ws.s ? 'var(--gray-900)' : 'transparent',
                                      color: block.weight === ws.w && block.style === ws.s ? '#fff' : 'var(--gray-600)',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      fontWeight: ws.w === 'bold' ? 700 : 400,
                                      fontStyle: ws.s === 'italic' ? 'italic' : 'normal',
                                    }}
                                  >
                                    {ws.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Resize handles */}
                            {isSelected && (
                              <>
                                <div
                                  onMouseDown={(e) => { e.stopPropagation(); setResizing({ index: idx, startSize: block.size, startY: e.clientY }); }}
                                  style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    left: '-8px',
                                    width: '16px',
                                    height: '16px',
                                    background: '#2563eb',
                                    border: '2px solid #fff',
                                    borderRadius: '50%',
                                    cursor: 'nwse-resize',
                                    zIndex: 20,
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                                    transform: `scale(${Math.min(2.5, 1 / scale)})`,
                                    transformOrigin: 'center',
                                  }}
                                />
                                <div
                                  onMouseDown={(e) => { e.stopPropagation(); setResizing({ index: idx, startSize: block.size, startY: e.clientY }); }}
                                  style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    right: '-8px',
                                    width: '16px',
                                    height: '16px',
                                    background: '#2563eb',
                                    border: '2px solid #fff',
                                    borderRadius: '50%',
                                    cursor: 'nesw-resize',
                                    zIndex: 20,
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                                    transform: `scale(${Math.min(2.5, 1 / scale)})`,
                                    transformOrigin: 'center',
                                  }}
                                />
                                <div
                                  onMouseDown={(e) => { e.stopPropagation(); setResizing({ index: idx, startSize: block.size, startY: e.clientY }); }}
                                  style={{
                                    position: 'absolute',
                                    bottom: '-8px',
                                    left: '-8px',
                                    width: '16px',
                                    height: '16px',
                                    background: '#2563eb',
                                    border: '2px solid #fff',
                                    borderRadius: '50%',
                                    cursor: 'nesw-resize',
                                    zIndex: 20,
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                                    transform: `scale(${Math.min(2.5, 1 / scale)})`,
                                    transformOrigin: 'center',
                                  }}
                                />
                                <div
                                  onMouseDown={(e) => { e.stopPropagation(); setResizing({ index: idx, startSize: block.size, startY: e.clientY }); }}
                                  style={{
                                    position: 'absolute',
                                    bottom: '-8px',
                                    right: '-8px',
                                    width: '16px',
                                    height: '16px',
                                    background: '#2563eb',
                                    border: '2px solid #fff',
                                    borderRadius: '50%',
                                    cursor: 'nwse-resize',
                                    zIndex: 20,
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                                    transform: `scale(${Math.min(2.5, 1 / scale)})`,
                                    transformOrigin: 'center',
                                  }}
                                />
                              </>
                            )}

                            {block.key === 'student_name' && "Єва Григор'єва"}
                            {block.key === 'verb' && (
                              <>
                                успішно завершила навчання
                                <br />
                                з курсу
                              </>
                            )}
                            {block.key === 'course_name' && "«Комп'ютерна графіка та дизайн»"}
                            {block.key === 'issue_date' && 'Дата видачі: 12.06.2025'}
                          </div>
                        );
                      })}
                    </div>
                    </div>
                  </>
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

                  <div style={{ fontSize: '13px', color: 'var(--gray-500)', textAlign: 'center' }}>
                    Натисніть на текстовий блок, щоб відкрити налаштування. Перетягніть блок для зміни позиції, потягніть за круглі кнопки в кутах для зміни розміру.
                  </div>
                </div>
              </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ minWidth: '112px' }}>
                {t('actions.close')}
              </button>
              <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings} style={{ minWidth: '180px' }}>
                {savingSettings ? 'Зберігаємо…' : 'Зберегти вигляд'}
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!canCreate} style={{ minWidth: '160px' }}>
                {saving ? 'Зберігаємо…' : 'Згенерувати PDF'}
              </button>
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
