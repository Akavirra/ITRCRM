'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ChevronDown,
  Download,
  Move,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import PageLoading from '@/components/PageLoading';
import { useUser } from '@/components/UserContext';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import s from './graduation.module.css';

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
  wrap: boolean;
}

const DEFAULT_BLOCKS: BlockSetting[] = [
  { key: 'student_name', size: 42, xPercent: 50, yPercent: 45, color: '#1a237e', align: 'center', weight: 'normal', style: 'normal', wrap: false },
  { key: 'verb', size: 18, xPercent: 50, yPercent: 38, color: '#1a237e', align: 'center', weight: 'normal', style: 'normal', wrap: true },
  { key: 'course_name', size: 20, xPercent: 50, yPercent: 28, color: '#1565c0', align: 'center', weight: 'normal', style: 'normal', wrap: true },
  { key: 'issue_date', size: 14, xPercent: 80, yPercent: 8, color: '#1a237e', align: 'left', weight: 'normal', style: 'normal', wrap: false },
];

const BLOCK_LABELS: Record<string, string> = {
  student_name: "Ім'я учня",
  verb: 'Текст завершення',
  course_name: 'Назва курсу',
  issue_date: 'Дата видачі',
};

type AccordionKey = 'data' | 'blocks' | 'template';

export default function GraduationCertificatesPage() {
  const router = useRouter();
  const { user } = useUser();

  const [certificates, setCertificates] = useState<CompletionCertificateData[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [blocks, setBlocks] = useState<BlockSetting[]>(DEFAULT_BLOCKS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dragging, setDragging] = useState<{ index: number; offsetX: number; offsetY: number } | null>(null);
  const [openAccordion, setOpenAccordion] = useState<AccordionKey>('data');
  const [resizing, setResizing] = useState<{ index: number; startSize: number; startY: number } | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<number>(0);
  const [imageDimensions, setImageDimensions] = useState({ width: 842, height: 595 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [previewTexts, setPreviewTexts] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    student_id: '',
    course_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    gender: '' as 'male' | 'female' | '',
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const activeBlock = blocks[selectedBlock];
  const selectedStudent = students.find((student) => String(student.id) === formData.student_id) || null;
  const selectedCourse = courses.find((course) => String(course.id) === formData.course_id) || null;
  const canCreate = !saving && formData.student_id && formData.issue_date && formData.gender;
  const toolbarScale = Math.min(1.3, Math.max(0.82, 1 / scale));

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
        setStudents(
          Array.isArray(studentData.students)
            ? studentData.students.map((student: any) => ({
                id: student.id,
                full_name: student.full_name,
                gender: student.gender,
              }))
            : []
        );

        const courseData = await courseRes.json();
        setCourses(
          Array.isArray(courseData.courses)
            ? courseData.courses.map((course: any) => ({
                id: course.id,
                title: course.title,
              }))
            : []
        );

        const templateData = await templateRes.json();
        if (templateData.url) {
          setTemplateUrl(templateData.url);
        }

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

  useEffect(() => {
    const fitPreview = () => {
      if (!viewportRef.current || !imageDimensions.width || !imageDimensions.height) return;

      const viewportWidth = viewportRef.current.clientWidth - 40;
      const viewportHeight = viewportRef.current.clientHeight - 40;
      if (!viewportWidth || !viewportHeight) return;

      const widthScale = viewportWidth / imageDimensions.width;
      const heightScale = viewportHeight / imageDimensions.height;
      const nextScale = Math.min(widthScale, heightScale, 1);

      setScale(Math.max(0.45, Math.round(nextScale * 100) / 100));
      setPan({ x: 0, y: 0 });
    };

    fitPreview();
    window.addEventListener('resize', fitPreview);

    return () => window.removeEventListener('resize', fitPreview);
  }, [imageDimensions, templateUrl, showModal]);

  useEffect(() => {
    if (!resizing) return;

    const handleResizeMove = (event: MouseEvent) => {
      const delta = resizing.startY - event.clientY;
      const nextSize = Math.max(10, Math.min(160, resizing.startSize + delta * 0.28));
      updateBlock(resizing.index, { size: Math.round(nextSize) });
    };

    const handleResizeEnd = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [resizing]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      adjustScale(event.deltaY > 0 ? -0.08 : 0.08);
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [showModal]);

  const updateBlock = (index: number, patch: Partial<BlockSetting>) => {
    setBlocks((prev) => prev.map((block, currentIndex) => (
      currentIndex === index ? { ...block, ...patch } : block
    )));
  };

  const getPreviewText = (key: string) => {
    if (previewTexts[key] !== undefined) {
      return previewTexts[key];
    }

    switch (key) {
      case 'student_name':
        return selectedStudent?.full_name || "Єва Григор'єва";
      case 'verb':
        return formData.gender === 'male'
          ? 'успішно завершив навчання\nз курсу'
          : 'успішно завершила навчання\nз курсу';
      case 'course_name':
        return selectedCourse?.title ? `«${selectedCourse.title}»` : "«Комп'ютерна графіка та дизайн»";
      case 'issue_date': {
        const date = new Date(formData.issue_date);
        if (Number.isNaN(date.getTime())) return formData.issue_date;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      }
      default:
        return '';
    }
  };

  const getBlockFontFamily = (key: string) => (
    key === 'student_name' ? "'Cassandra', cursive" : "'Montserrat', sans-serif"
  );

  const adjustScale = (delta: number) => {
    setScale((prev) => {
      const next = Math.max(0.4, Math.min(2.4, prev + delta));
      return Math.round(next * 100) / 100;
    });
  };

  const resetViewport = () => {
    setPan({ x: 0, y: 0 });
    if (!viewportRef.current) {
      setScale(1);
      return;
    }
    const viewportWidth = viewportRef.current.clientWidth - 40;
    const viewportHeight = viewportRef.current.clientHeight - 40;
    const widthScale = viewportWidth / imageDimensions.width;
    const heightScale = viewportHeight / imageDimensions.height;
    setScale(Math.max(0.45, Math.min(widthScale, heightScale, 1)));
  };

  const handleCanvasMouseDown = (event: React.MouseEvent) => {
    if (event.button === 1 || (event.button === 0 && event.target === event.currentTarget)) {
      event.preventDefault();
      setIsPanning(true);
      setPanStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: event.clientX - panStart.x, y: event.clientY - panStart.y });
      return;
    }

    if (!dragging) return;

    const container = event.currentTarget.getBoundingClientRect();
    let x = ((event.clientX - container.left - dragging.offsetX) / container.width) * 100;
    let y = 100 - (((event.clientY - container.top - dragging.offsetY) / container.height) * 100);

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    updateBlock(dragging.index, {
      xPercent: parseFloat(x.toFixed(2)),
      yPercent: parseFloat(y.toFixed(2)),
    });
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  const handleCreate = () => {
    setFormData({
      student_id: '',
      course_id: '',
      issue_date: new Date().toISOString().slice(0, 10),
      gender: '',
    });
    setPreviewTexts({});
    setSelectedBlock(0);
    setSelectedFile(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!canCreate) return;

    setSaving(true);
    try {
      const response = await fetch('/api/completion-certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || t('toasts.error'));
        return;
      }

      const newCertificate = await response.json();
      setCertificates((prev) => [newCertificate, ...prev]);
      setShowModal(false);
      window.open(`/api/completion-certificates/${newCertificate.id}/pdf`, '_blank');
    } catch (error) {
      console.error('Failed to save certificate:', error);
      alert('Не вдалося згенерувати сертифікат');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = (id: number) => {
    window.open(`/api/completion-certificates/${id}/pdf`, '_blank');
  };

  const handleUploadTemplate = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);

      const response = await fetch('/api/completion-certificates/template', {
        method: 'POST',
        body: form,
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Помилка завантаження');
        return;
      }

      const data = await response.json();
      setTemplateUrl(data.url);
      setSelectedFile(null);
      alert('Шаблон успішно оновлено');
    } catch (error) {
      console.error(error);
      alert('Помилка завантаження');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await fetch('/api/completion-certificates/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateUrl, blocks }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      alert('Налаштування збережено');
    } catch (error) {
      console.error(error);
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
      const response = await fetch(`/api/completion-certificates/${deleteConfirmId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed');
      }

      setCertificates((prev) => prev.filter((certificate) => certificate.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error(error);
      alert('Помилка видалення');
    } finally {
      setDeleteLoading(false);
    }
  };

  const onStudentChange = (studentId: string) => {
    const student = students.find((item) => String(item.id) === studentId);
    setFormData((prev) => ({
      ...prev,
      student_id: studentId,
      gender: student?.gender || prev.gender,
    }));
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
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: '4px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Сертифікати про закінчення</h3>
            <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
              Генеруйте PDF і налаштовуйте макет у тому ж вікні.
            </span>
          </div>
          <button className="btn btn-primary" onClick={handleCreate} style={{ marginLeft: 'auto' }}>
            <Plus size={18} style={{ marginRight: '8px' }} />
            {t('actions.add')}
          </button>
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
                {certificates.map((certificate) => (
                  <tr key={certificate.id}>
                    <td style={{ fontWeight: 600 }}>{certificate.student_name}</td>
                    <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{certificate.course_title || '—'}</td>
                    <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{formatDateKyiv(certificate.issue_date)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(certificate.id)} title="Завантажити PDF">
                          <Download size={16} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(certificate.id)} title="Видалити">
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className={s.modalShell} onClick={(event) => event.stopPropagation()}>
            <div className={s.modalHeader}>
              <div className={s.modalHeaderMain}>
                <button type="button" className={s.headerBack} onClick={() => setShowModal(false)} aria-label="Назад">
                  <ArrowLeft size={16} />
                </button>
                <div className={s.headerTitleStack}>
                  <div className={s.headerTitleRow}>
                    <h3 className={s.modalTitle}>Сертифікат</h3>
                    <span className={s.headerDivider}>•</span>
                    <span className={s.headerStudent}>{selectedStudent?.full_name || 'Оберіть учня'}</span>
                  </div>
                  <p className={s.modalSubtitle}>Canvas-first редактор: спершу вміст, потім макет, далі готовий PDF.</p>
                </div>
              </div>

              <div className={s.headerActions}>
                <button className="btn btn-secondary btn-sm" onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? 'Збереження…' : 'Зберегти'}
                </button>
                <button type="button" className={s.modalClose} onClick={() => setShowModal(false)} aria-label="Закрити">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={s.modalBody}>
              <section className={s.canvasArea}>
                <div className={s.canvasTopbar}>
                  <div className={s.canvasMeta}>
                    <span className={s.canvasLabel}>Полотно сертифіката</span>
                    <span className={s.canvasHint}>Перетягування, resize і швидкі стилі доступні прямо на макеті.</span>
                  </div>

                  <div className={s.canvasToolbar}>
                    <button type="button" className={s.toolbarBtn} onClick={() => adjustScale(-0.08)} title="Зменшити">
                      <ZoomOut size={15} />
                    </button>
                    <span className={s.toolbarScale}>{Math.round(scale * 100)}%</span>
                    <button type="button" className={s.toolbarBtn} onClick={resetViewport} title="Скинути вигляд">
                      <RotateCcw size={15} />
                    </button>
                    <button type="button" className={s.toolbarBtn} onClick={() => adjustScale(0.08)} title="Збільшити">
                      <ZoomIn size={15} />
                    </button>
                  </div>
                </div>

                {templateUrl ? (
                  <div ref={viewportRef} className={s.canvasViewport}>
                    <div
                      className={s.canvasFrame}
                      style={{ cursor: isPanning ? 'grabbing' : 'default' }}
                    >
                      <div
                        ref={previewRef}
                        className={s.canvasContent}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onMouseDown={handleCanvasMouseDown}
                        style={{
                          width: `${imageDimensions.width}px`,
                          height: `${imageDimensions.height}px`,
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                          transformOrigin: 'center center',
                          cursor: dragging ? 'grabbing' : isPanning ? 'grabbing' : 'default',
                        }}
                      >
                        <img
                          src={templateUrl}
                          alt="Шаблон сертифіката"
                          onLoad={(event) => setImageDimensions({
                            width: event.currentTarget.naturalWidth || 842,
                            height: event.currentTarget.naturalHeight || 595,
                          })}
                        />

                        {blocks.map((block, index) => {
                          const isSelected = selectedBlock === index;
                          const text = getPreviewText(block.key);

                          return (
                            <div
                              key={block.key}
                              className={`${s.canvasBlock} ${isSelected ? s.canvasBlockSelected : ''}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedBlock(index);
                                setOpenAccordion('blocks');
                              }}
                              onMouseDown={(event) => {
                                if (!isSelected) return;
                                event.stopPropagation();
                                const rect = event.currentTarget.getBoundingClientRect();
                                setDragging({
                                  index,
                                  offsetX: event.clientX - (rect.left + rect.width / 2),
                                  offsetY: event.clientY - (rect.top + rect.height / 2),
                                });
                              }}
                              style={{
                                left: `${block.xPercent}%`,
                                bottom: `${block.yPercent}%`,
                                transform: 'translateX(-50%)',
                                color: block.color,
                                fontSize: `${block.size}px`,
                                fontFamily: getBlockFontFamily(block.key),
                                fontWeight: block.weight === 'bold' ? 700 : 400,
                                fontStyle: block.style === 'italic' ? 'italic' : 'normal',
                                textAlign: block.align,
                                whiteSpace: block.wrap ? 'pre-wrap' : 'nowrap',
                                maxWidth: block.wrap ? '360px' : 'none',
                              }}
                            >
                              {isSelected && (
                                <div
                                  className={s.blockToolbar}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  style={{ transform: `translateX(-50%) scale(${toolbarScale})` }}
                                >
                                  <input
                                    type="color"
                                    value={block.color}
                                    onChange={(event) => updateBlock(index, { color: event.target.value })}
                                    className={s.blockColorInput}
                                  />
                                  {[{ value: 'left', icon: AlignLeft }, { value: 'center', icon: AlignCenter }, { value: 'right', icon: AlignRight }].map(({ value, icon: Icon }) => (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => updateBlock(index, { align: value as BlockSetting['align'] })}
                                      className={`${s.blockToolbarBtn} ${block.align === value ? s.blockToolbarBtnActive : ''}`}
                                    >
                                      <Icon size={14} />
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => updateBlock(index, { weight: block.weight === 'bold' ? 'normal' : 'bold' })}
                                    className={`${s.blockToolbarBtn} ${block.weight === 'bold' ? s.blockToolbarBtnActive : ''}`}
                                  >
                                    B
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateBlock(index, { style: block.style === 'italic' ? 'normal' : 'italic' })}
                                    className={`${s.blockToolbarBtn} ${block.style === 'italic' ? s.blockToolbarBtnActive : ''}`}
                                  >
                                    I
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateBlock(index, { wrap: !block.wrap })}
                                    className={`${s.blockToolbarToggle} ${block.wrap ? s.blockToolbarBtnActive : ''}`}
                                  >
                                    wrap
                                  </button>
                                </div>
                              )}

                              {isSelected && (
                                <>
                                  {[
                                    { top: '-7px', left: '-7px', cursor: 'nwse-resize' },
                                    { top: '-7px', right: '-7px', cursor: 'nesw-resize' },
                                    { bottom: '-7px', left: '-7px', cursor: 'nesw-resize' },
                                    { bottom: '-7px', right: '-7px', cursor: 'nwse-resize' },
                                  ].map((handle, handleIndex) => (
                                    <button
                                      key={handleIndex}
                                      type="button"
                                      className={s.resizeHandle}
                                      onMouseDown={(event) => {
                                        event.stopPropagation();
                                        setResizing({ index, startSize: block.size, startY: event.clientY });
                                      }}
                                      style={handle}
                                    />
                                  ))}
                                </>
                              )}

                              {text}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={s.canvasEmpty}>
                    <span className={s.canvasEmptyTitle}>Спочатку завантажте шаблон сертифіката</span>
                    <span className={s.canvasEmptyDesc}>Після цього тут з'явиться повноцінне прев’ю з drag & drop і редагуванням блоків.</span>
                  </div>
                )}

                <div className={s.canvasBottomHint}>
                  <span className={s.canvasBottomItem}>
                    <Move size={15} />
                    Перетягування працює прямо на полотні.
                  </span>
                  <span className={s.canvasBottomItem}>Resize робиться кутовими хендлами, а стилі відкриваються над активним елементом.</span>
                </div>
              </section>

              <aside className={s.sidebar}>
                <div className={s.sidebarInner}>
                  <section className={s.accordionSection}>
                    <button type="button" className={s.accordionHeader} onClick={() => setOpenAccordion('data')}>
                      <div>
                        <div className={s.accordionTitle}>Дані</div>
                        <div className={s.accordionMeta}>Учень, курс, дата і стать</div>
                      </div>
                      <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'data' ? s.accordionChevronOpen : ''}`} />
                    </button>
                    {openAccordion === 'data' && (
                      <div className={s.accordionBody}>
                        <div className={s.summaryCard}>
                          <span className={s.summaryLabel}>Поточний сертифікат</span>
                          <strong className={s.summaryValue}>{selectedStudent?.full_name || 'Оберіть учня'}</strong>
                          <span className={s.summaryMeta}>{selectedCourse?.title || 'Курс ще не обрано'}</span>
                        </div>

                        <div className={s.compactGroup}>
                          <label className={s.compactLabel}>Учень <span className={s.compactRequired}>*</span></label>
                          <select className="form-select" value={formData.student_id} onChange={(event) => onStudentChange(event.target.value)}>
                            <option value="">Оберіть учня</option>
                            {students.map((student) => (
                              <option key={student.id} value={student.id}>{student.full_name}</option>
                            ))}
                          </select>
                        </div>

                        <div className={s.compactGroup}>
                          <label className={s.compactLabel}>Курс</label>
                          <select
                            className="form-select"
                            value={formData.course_id}
                            onChange={(event) => setFormData((prev) => ({ ...prev, course_id: event.target.value }))}
                          >
                            <option value="">Оберіть курс</option>
                            {courses.map((course) => (
                              <option key={course.id} value={course.id}>{course.title}</option>
                            ))}
                          </select>
                        </div>

                        <div className={s.compactRow}>
                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>Дата <span className={s.compactRequired}>*</span></label>
                            <input
                              type="date"
                              className="form-input"
                              value={formData.issue_date}
                              onChange={(event) => setFormData((prev) => ({ ...prev, issue_date: event.target.value }))}
                            />
                          </div>
                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>Стать <span className={s.compactRequired}>*</span></label>
                            <select
                              className="form-select"
                              value={formData.gender}
                              onChange={(event) => setFormData((prev) => ({ ...prev, gender: event.target.value as 'male' | 'female' }))}
                            >
                              <option value="">Оберіть</option>
                              <option value="female">Жіноча</option>
                              <option value="male">Чоловіча</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className={s.accordionSection}>
                    <button type="button" className={s.accordionHeader} onClick={() => setOpenAccordion('blocks')}>
                      <div>
                        <div className={s.accordionTitle}>Текстові блоки</div>
                        <div className={s.accordionMeta}>Позиція, стиль і текст активного елемента</div>
                      </div>
                      <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'blocks' ? s.accordionChevronOpen : ''}`} />
                    </button>
                    {openAccordion === 'blocks' && (
                      <div className={s.accordionBody}>
                        <div className={s.blockList}>
                          {blocks.map((block, index) => {
                            const isActive = selectedBlock === index;
                            return (
                              <button
                                key={block.key}
                                type="button"
                                onClick={() => setSelectedBlock(index)}
                                className={`${s.blockItem} ${isActive ? s.blockItemActive : ''}`}
                              >
                                <span>
                                  <span className={s.blockItemName}>{BLOCK_LABELS[block.key]}</span>
                                  <span className={s.blockItemMeta}>{Math.round(block.xPercent)}% / {Math.round(block.yPercent)}%</span>
                                </span>
                                <span className={s.blockItemMeta}>{block.size}px</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className={s.blockEditor}>
                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>Текст у прев’ю</label>
                            <textarea
                              className="form-input"
                              rows={activeBlock.key === 'verb' ? 3 : 2}
                              value={previewTexts[activeBlock.key] ?? getPreviewText(activeBlock.key)}
                              onChange={(event) => setPreviewTexts((prev) => ({
                                ...prev,
                                [activeBlock.key]: event.target.value,
                              }))}
                            />
                          </div>

                          <div className={s.compactRow}>
                            <div className={s.compactGroup}>
                              <label className={s.compactLabel}>Розмір</label>
                              <input
                                type="number"
                                className="form-input"
                                min="10"
                                max="160"
                                value={activeBlock.size}
                                onChange={(event) => updateBlock(selectedBlock, { size: parseInt(event.target.value, 10) || 10 })}
                              />
                            </div>
                            <div className={s.compactGroup}>
                              <label className={s.compactLabel}>Колір</label>
                              <input
                                type="color"
                                className={`form-input ${s.colorInput}`}
                                value={activeBlock.color}
                                onChange={(event) => updateBlock(selectedBlock, { color: event.target.value })}
                              />
                            </div>
                          </div>

                          <div className={s.compactRow}>
                            <div className={s.compactGroup}>
                              <label className={s.compactLabel}>Вирівнювання</label>
                              <select
                                className="form-select"
                                value={activeBlock.align}
                                onChange={(event) => updateBlock(selectedBlock, { align: event.target.value as BlockSetting['align'] })}
                              >
                                <option value="left">Ліворуч</option>
                                <option value="center">По центру</option>
                                <option value="right">Праворуч</option>
                              </select>
                            </div>
                            <div className={s.compactGroup}>
                              <label className={s.compactLabel}>Накреслення</label>
                              <select
                                className="form-select"
                                value={`${activeBlock.weight}:${activeBlock.style}`}
                                onChange={(event) => {
                                  const [weight, style] = event.target.value.split(':') as [BlockSetting['weight'], BlockSetting['style']];
                                  updateBlock(selectedBlock, { weight, style });
                                }}
                              >
                                <option value="normal:normal">Звичайне</option>
                                <option value="bold:normal">Жирне</option>
                                <option value="normal:italic">Курсив</option>
                                <option value="bold:italic">Жирний курсив</option>
                              </select>
                            </div>
                          </div>

                          <div className={s.sliderGroup}>
                            <label className={s.compactLabel}>Позиція зліва: {activeBlock.xPercent}%</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={activeBlock.xPercent}
                              onChange={(event) => updateBlock(selectedBlock, { xPercent: parseInt(event.target.value, 10) })}
                            />
                          </div>

                          <div className={s.sliderGroup}>
                            <label className={s.compactLabel}>Позиція знизу: {activeBlock.yPercent}%</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={activeBlock.yPercent}
                              onChange={(event) => updateBlock(selectedBlock, { yPercent: parseInt(event.target.value, 10) })}
                            />
                          </div>

                          <label className={s.checkboxRow}>
                            <input
                              type="checkbox"
                              checked={activeBlock.wrap}
                              onChange={(event) => updateBlock(selectedBlock, { wrap: event.target.checked })}
                            />
                            <span>Дозволити перенесення рядків</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className={s.accordionSection}>
                    <button type="button" className={s.accordionHeader} onClick={() => setOpenAccordion('template')}>
                      <div>
                        <div className={s.accordionTitle}>Шаблон</div>
                        <div className={s.accordionMeta}>PNG або JPG до 10 МБ</div>
                      </div>
                      <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'template' ? s.accordionChevronOpen : ''}`} />
                    </button>
                    {openAccordion === 'template' && (
                      <div className={s.accordionBody}>
                        <input
                          id="completion-certificate-template"
                          type="file"
                          accept="image/png,image/jpeg"
                          style={{ display: 'none' }}
                          onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        />
                        <div className={s.templateInfo}>
                          <span className={s.templateHint}>Поточний файл</span>
                          <span className={s.templateFileName}>{selectedFile?.name || (templateUrl ? 'Шаблон завантажено' : 'Файл ще не вибрано')}</span>
                        </div>

                        <div className={s.templateActions}>
                          <label htmlFor="completion-certificate-template" className={s.templateUploadLabel}>
                            <Upload size={14} />
                            Обрати файл
                          </label>
                          <button className="btn btn-primary btn-sm" onClick={handleUploadTemplate} disabled={!selectedFile || uploading}>
                            {uploading ? 'Завантаження…' : 'Оновити'}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </aside>
            </div>

            <div className={s.modalFooter}>
              <div className={s.footerNote}>Збереження вигляду не створює документ. PDF генерується окремою кнопкою.</div>
              <div className={s.footerActions}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('actions.close')}
                </button>
                <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? 'Зберігаємо…' : 'Зберегти вигляд'}
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!canCreate}>
                  {saving ? 'Генеруємо…' : 'Згенерувати PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId !== null && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '400px' }}>
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
