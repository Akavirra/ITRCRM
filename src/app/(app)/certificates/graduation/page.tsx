'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Download,
  Move,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import PageLoading from '@/components/PageLoading';
import { useUser } from '@/components/UserContext';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';

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

const panelStyle = {
  display: 'grid',
  gap: '16px',
  padding: '18px',
  background: '#ffffff',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: '18px',
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.04)',
} as const;

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
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: '1320px',
              width: '100%',
              maxHeight: '94vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(148, 163, 184, 0.28)',
              boxShadow: '0 32px 80px rgba(15, 23, 42, 0.18)',
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            }}
          >
            <div
              className="modal-header"
              style={{
                flexShrink: 0,
                padding: '24px 24px 18px',
                borderBottom: '1px solid rgba(226, 232, 240, 0.9)',
                background: 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div style={{ display: 'grid', gap: '6px' }}>
                <h3 className="modal-title" style={{ margin: 0 }}>Новий сертифікат про закінчення</h3>
                <p style={{ margin: 0, color: 'var(--gray-600)', fontSize: '14px', lineHeight: '20px' }}>
                  Спочатку заповніть дані учня, потім відкоригуйте макет і одразу згенеруйте фінальний PDF.
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Закрити"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  transition: 'background-color 160ms ease-out, transform 120ms ease-out',
                }}
              >
                ×
              </button>
            </div>

            <div
              className="modal-body"
              style={{
                overflow: 'auto',
                flex: '1 1 auto',
                padding: '22px',
                display: 'grid',
                gap: '22px',
                gridTemplateColumns: 'minmax(320px, 360px) minmax(0, 1fr)',
              }}
            >
              <div style={{ display: 'grid', gap: '16px', alignContent: 'start' }}>
                <section style={panelStyle}>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '15px', lineHeight: '22px', fontWeight: 700, color: 'var(--gray-900)' }}>
                      Дані сертифіката
                    </span>
                    <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
                      Зібрав основні поля в окремий блок, щоб вони не губилися серед редактора макета.
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Учень <span style={{ color: '#ef4444' }}>*</span></label>
                    <select className="form-select" value={formData.student_id} onChange={(event) => onStudentChange(event.target.value)}>
                      <option value="">Оберіть учня</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>{student.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Курс</label>
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Дата видачі <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.issue_date}
                        onChange={(event) => setFormData((prev) => ({ ...prev, issue_date: event.target.value }))}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Стать <span style={{ color: '#ef4444' }}>*</span></label>
                      <select
                        className="form-select"
                        value={formData.gender}
                        onChange={(event) => setFormData((prev) => ({ ...prev, gender: event.target.value as 'male' | 'female' }))}
                      >
                        <option value="">Оберіть стать</option>
                        <option value="female">Жіноча</option>
                        <option value="male">Чоловіча</option>
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: '4px',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.08))',
                      border: '1px solid rgba(37, 99, 235, 0.14)',
                    }}
                  >
                    <span style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--gray-500)' }}>
                      Попередній зміст
                    </span>
                    <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: 600, color: 'var(--gray-900)' }}>
                      {selectedStudent?.full_name || 'Оберіть учня'}{selectedCourse ? ` • ${selectedCourse.title}` : ''}
                    </span>
                  </div>
                </section>

                <section style={panelStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ fontSize: '15px', lineHeight: '22px', fontWeight: 700, color: 'var(--gray-900)' }}>
                        Шаблон
                      </span>
                      <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
                        PNG або JPG. Завантажений фон одразу з'явиться в робочому полі.
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--gray-400)' }}>
                      до 10 МБ
                    </span>
                  </div>

                  <input
                    id="completion-certificate-template"
                    type="file"
                    accept="image/png,image/jpeg"
                    style={{ display: 'none' }}
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  />

                  <div
                    style={{
                      display: 'grid',
                      gap: '12px',
                      padding: '14px',
                      borderRadius: '14px',
                      background: 'var(--gray-50)',
                      border: '1px solid var(--gray-200)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--gray-500)', marginBottom: '4px' }}>
                        Поточний файл
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          lineHeight: '20px',
                          color: selectedFile ? 'var(--gray-900)' : 'var(--gray-600)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {selectedFile?.name || (templateUrl ? 'Шаблон завантажено' : 'Файл ще не вибрано')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      <label
                        htmlFor="completion-certificate-template"
                        style={{
                          height: '38px',
                          padding: '0 14px',
                          borderRadius: '10px',
                          border: '1px solid var(--gray-300)',
                          background: '#ffffff',
                          color: 'var(--gray-800)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          transition: 'background-color 160ms ease-out, border-color 160ms ease-out, transform 120ms ease-out',
                        }}
                      >
                        <Upload size={16} />
                        Обрати файл
                      </label>

                      <button className="btn btn-primary" onClick={handleUploadTemplate} disabled={!selectedFile || uploading}>
                        {uploading ? 'Завантаження…' : 'Оновити шаблон'}
                      </button>
                    </div>
                  </div>
                </section>

                <section style={panelStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: 'rgba(15, 23, 42, 0.06)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--gray-700)',
                      }}
                    >
                      <SlidersHorizontal size={16} />
                    </div>
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <span style={{ fontSize: '15px', lineHeight: '22px', fontWeight: 700, color: 'var(--gray-900)' }}>
                        Текстові блоки
                      </span>
                      <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
                        Основні параметри лишаються тут, але швидкі зміни тепер ідуть прямо над активним блоком.
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '8px' }}>
                    {blocks.map((block, index) => {
                      const isActive = selectedBlock === index;
                      return (
                        <button
                          key={block.key}
                          type="button"
                          onClick={() => setSelectedBlock(index)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: isActive ? '1px solid rgba(37, 99, 235, 0.24)' : '1px solid var(--gray-200)',
                            background: isActive ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                            color: 'var(--gray-800)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background-color 180ms ease-out, border-color 180ms ease-out, transform 120ms ease-out',
                          }}
                        >
                          <span style={{ display: 'grid', gap: '2px' }}>
                            <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: 600 }}>{BLOCK_LABELS[block.key]}</span>
                            <span style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--gray-500)' }}>
                              {Math.round(block.xPercent)}% / {Math.round(block.yPercent)}%
                            </span>
                          </span>
                          <span style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--gray-500)' }}>{block.size}px</span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'grid', gap: '14px', paddingTop: '4px', borderTop: '1px solid var(--gray-100)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Текст у прев'ю</label>
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Розмір</label>
                        <input
                          type="number"
                          className="form-input"
                          min="10"
                          max="160"
                          value={activeBlock.size}
                          onChange={(event) => updateBlock(selectedBlock, { size: parseInt(event.target.value, 10) || 10 })}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Колір</label>
                        <input
                          type="color"
                          className="form-input"
                          value={activeBlock.color}
                          style={{ padding: '4px', height: '40px' }}
                          onChange={(event) => updateBlock(selectedBlock, { color: event.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Вирівнювання</label>
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

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Накреслення</label>
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

                    <div style={{ display: 'grid', gap: '10px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Позиція зліва: {activeBlock.xPercent}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={activeBlock.xPercent}
                          onChange={(event) => updateBlock(selectedBlock, { xPercent: parseInt(event.target.value, 10) })}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Позиція знизу: {activeBlock.yPercent}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={activeBlock.yPercent}
                          onChange={(event) => updateBlock(selectedBlock, { yPercent: parseInt(event.target.value, 10) })}
                        />
                      </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', lineHeight: '20px', color: 'var(--gray-700)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={activeBlock.wrap}
                        onChange={(event) => updateBlock(selectedBlock, { wrap: event.target.checked })}
                      />
                      Дозволити перенесення рядків
                    </label>
                  </div>
                </section>
              </div>

              <div style={{ display: 'grid', gap: '18px', minWidth: 0 }}>
                <section style={{ ...panelStyle, padding: '16px', gap: '14px', background: 'linear-gradient(180deg, #fdfefe 0%, #f8fbff 100%)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ fontSize: '15px', lineHeight: '22px', fontWeight: 700, color: 'var(--gray-900)' }}>
                        Прев'ю сертифіката
                      </span>
                      <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
                        Активний блок редагується прямо на полотні: тягни, масштабуй і стилізуй його вгорі, як у графічному редакторі.
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <span
                        style={{
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: 'var(--gray-100)',
                          fontSize: '12px',
                          lineHeight: '16px',
                          color: 'var(--gray-600)',
                        }}
                      >
                        Масштаб {Math.round(scale * 100)}%
                      </span>

                      <button className="btn btn-secondary btn-sm" onClick={() => adjustScale(-0.08)} title="Зменшити">
                        <ZoomOut size={15} />
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={resetViewport} title="Скинути вигляд">
                        <RotateCcw size={15} />
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => adjustScale(0.08)} title="Збільшити">
                        <ZoomIn size={15} />
                      </button>
                    </div>
                  </div>

                  {templateUrl ? (
                    <div
                      ref={viewportRef}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        background: 'radial-gradient(circle at top, rgba(255,255,255,0.96), rgba(236, 245, 255, 0.92))',
                        minHeight: '70vh',
                        cursor: isPanning ? 'grabbing' : 'default',
                      }}
                    >
                      <div
                        ref={previewRef}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onMouseDown={handleCanvasMouseDown}
                        style={{
                          position: 'relative',
                          width: `${imageDimensions.width}px`,
                          height: `${imageDimensions.height}px`,
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                          transformOrigin: 'center center',
                          cursor: dragging ? 'grabbing' : isPanning ? 'grabbing' : 'default',
                          userSelect: 'none',
                          willChange: 'transform',
                        }}
                      >
                        <img
                          src={templateUrl}
                          alt="Template"
                          onLoad={(event) => setImageDimensions({
                            width: event.currentTarget.naturalWidth || 842,
                            height: event.currentTarget.naturalHeight || 595,
                          })}
                          style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
                        />

                        {blocks.map((block, index) => {
                          const isSelected = selectedBlock === index;
                          const text = getPreviewText(block.key);

                          return (
                            <div
                              key={block.key}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedBlock(index);
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
                                position: 'absolute',
                                left: `${block.xPercent}%`,
                                bottom: `${block.yPercent}%`,
                                transform: 'translateX(-50%)',
                                color: block.color,
                                fontSize: `${block.size}px`,
                                fontFamily: getBlockFontFamily(block.key),
                                fontWeight: block.weight === 'bold' ? 700 : 400,
                                fontStyle: block.style === 'italic' ? 'italic' : 'normal',
                                lineHeight: 1.12,
                                textAlign: block.align,
                                whiteSpace: block.wrap ? 'pre-wrap' : 'nowrap',
                                maxWidth: block.wrap ? '360px' : 'none',
                                padding: isSelected ? '6px 10px' : '4px 6px',
                                borderRadius: '10px',
                                border: isSelected ? '1px dashed rgba(37, 99, 235, 0.95)' : '1px solid transparent',
                                background: isSelected ? 'rgba(255, 255, 255, 0.82)' : 'transparent',
                                boxShadow: isSelected ? '0 20px 48px rgba(37, 99, 235, 0.16)' : 'none',
                                cursor: isSelected ? 'grab' : 'pointer',
                                zIndex: isSelected ? 12 : 1,
                                transition: 'background-color 180ms ease-out, box-shadow 180ms ease-out, border-color 180ms ease-out',
                              }}
                            >
                              {isSelected && (
                                <div
                                  onMouseDown={(event) => event.stopPropagation()}
                                  style={{
                                    position: 'absolute',
                                    bottom: 'calc(100% + 12px)',
                                    left: '50%',
                                    transform: `translateX(-50%) scale(${toolbarScale})`,
                                    transformOrigin: 'bottom center',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '6px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.97)',
                                    border: '1px solid rgba(148, 163, 184, 0.28)',
                                    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
                                    backdropFilter: 'blur(14px)',
                                    whiteSpace: 'nowrap',
                                    zIndex: 30,
                                  }}
                                >
                                  <input
                                    type="color"
                                    value={block.color}
                                    onChange={(event) => updateBlock(index, { color: event.target.value })}
                                    style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                  />
                                  {[{ value: 'left', icon: AlignLeft }, { value: 'center', icon: AlignCenter }, { value: 'right', icon: AlignRight }].map(({ value, icon: Icon }) => (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => updateBlock(index, { align: value as BlockSetting['align'] })}
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: block.align === value ? 'var(--gray-900)' : 'transparent',
                                        color: block.align === value ? '#fff' : 'var(--gray-600)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Icon size={14} />
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => updateBlock(index, { weight: block.weight === 'bold' ? 'normal' : 'bold' })}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '8px',
                                      border: 'none',
                                      background: block.weight === 'bold' ? 'var(--gray-900)' : 'transparent',
                                      color: block.weight === 'bold' ? '#fff' : 'var(--gray-600)',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    B
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateBlock(index, { style: block.style === 'italic' ? 'normal' : 'italic' })}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '8px',
                                      border: 'none',
                                      background: block.style === 'italic' ? 'var(--gray-900)' : 'transparent',
                                      color: block.style === 'italic' ? '#fff' : 'var(--gray-600)',
                                      fontStyle: 'italic',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    I
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateBlock(index, { wrap: !block.wrap })}
                                    style={{
                                      minWidth: '40px',
                                      height: '28px',
                                      padding: '0 8px',
                                      borderRadius: '8px',
                                      border: 'none',
                                      background: block.wrap ? 'var(--gray-900)' : 'transparent',
                                      color: block.wrap ? '#fff' : 'var(--gray-600)',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
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
                                      onMouseDown={(event) => {
                                        event.stopPropagation();
                                        setResizing({ index, startSize: block.size, startY: event.clientY });
                                      }}
                                      style={{
                                        position: 'absolute',
                                        width: '14px',
                                        height: '14px',
                                        borderRadius: '4px',
                                        border: '2px solid #ffffff',
                                        background: '#2563eb',
                                        boxShadow: '0 8px 18px rgba(37, 99, 235, 0.28)',
                                        zIndex: 24,
                                        ...handle,
                                      }}
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
                  ) : (
                    <div
                      style={{
                        minHeight: '320px',
                        borderRadius: '18px',
                        border: '2px dashed var(--gray-300)',
                        background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                        textAlign: 'center',
                        color: 'var(--gray-500)',
                      }}
                    >
                      <div style={{ display: 'grid', gap: '8px' }}>
                        <span style={{ fontSize: '16px', lineHeight: '24px', fontWeight: 600 }}>
                          Спочатку завантажте шаблон сертифіката
                        </span>
                        <span style={{ fontSize: '13px', lineHeight: '18px' }}>
                          Після цього тут з'явиться живе прев'ю з можливістю перетягувати блоки.
                        </span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', color: 'var(--gray-600)', fontSize: '13px', lineHeight: '18px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Move size={15} />
                      Перетягування працює прямо на макеті.
                    </span>
                    <span>Resize доступний через кутові хендли, а швидкі стилі відкриваються над активним блоком.</span>
                  </div>
                </section>
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                flexShrink: 0,
                padding: '18px 24px 24px',
                borderTop: '1px solid rgba(226, 232, 240, 0.9)',
                background: 'rgba(255, 255, 255, 0.9)',
              }}
            >
              <div style={{ color: 'var(--gray-500)', fontSize: '13px', lineHeight: '18px', alignSelf: 'center' }}>
                Збереження вигляду не створює документ. PDF генерується окремою кнопкою.
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ minWidth: '112px' }}>
                  {t('actions.close')}
                </button>
                <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings} style={{ minWidth: '180px' }}>
                  {savingSettings ? 'Зберігаємо…' : 'Зберегти вигляд'}
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!canCreate} style={{ minWidth: '170px' }}>
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
