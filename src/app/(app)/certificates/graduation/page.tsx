'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Move, Plus, RotateCcw, SlidersHorizontal, Trash2, Upload, ZoomIn, ZoomOut } from 'lucide-react';
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

const modalCardStyle = {
  display: 'grid',
  gap: '16px',
  padding: '18px',
  background: '#ffffff',
  border: '1px solid var(--gray-200)',
  borderRadius: '16px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)',
} as const;

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
  const [selectedBlock, setSelectedBlock] = useState<number | null>(0);
  const [imageDimensions, setImageDimensions] = useState({ width: 842, height: 595 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [previewTexts, setPreviewTexts] = useState<Record<string, string>>({});
  const previewRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const selectedStudent = students.find((student) => String(student.id) === formData.student_id) || null;
  const selectedCourse = courses.find((course) => String(course.id) === formData.course_id) || null;
  const activeBlock = selectedBlock !== null ? blocks[selectedBlock] : null;
  const canCreate = !saving && formData.student_id && formData.issue_date && formData.gender;

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
    const fit = () => {
      if (!viewportRef.current || !previewRef.current) return;
      const viewportWidth = viewportRef.current.clientWidth;
      const viewportHeight = viewportRef.current.clientHeight;
      if (!viewportWidth || !viewportHeight || !imageDimensions.height) return;

      const contentHeight = viewportWidth * (imageDimensions.height / imageDimensions.width);
      const nextScale = Math.min(1, viewportHeight / contentHeight);
      setScale(nextScale);
      setPan({ x: 0, y: 0 });
    };

    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [imageDimensions, templateUrl]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const onWheelNative = (event: WheelEvent) => {
      event.preventDefault();
      adjustScale(event.deltaY > 0 ? -0.1 : 0.1);
    };

    element.addEventListener('wheel', onWheelNative, { passive: false });
    return () => element.removeEventListener('wheel', onWheelNative);
  }, [showModal]);

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

  const updateBlock = (index: number, patch: Partial<BlockSetting>) => {
    setBlocks((prev) => prev.map((block, currentIndex) => (
      currentIndex === index ? { ...block, ...patch } : block
    )));
  };

  const adjustScale = (delta: number) => {
    setScale((prev) => {
      const next = Math.max(0.4, Math.min(2.5, prev + delta));
      return Math.round(next * 10) / 10;
    });
  };

  const resetViewport = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
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

  const formatPreviewDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const getPreviewText = (key: string) => {
    if (previewTexts[key] !== undefined) return previewTexts[key];

    switch (key) {
      case 'student_name':
        return selectedStudent?.full_name || "Єва Григор'єва";
      case 'verb':
        return formData.gender === 'male'
          ? 'успішно завершив навчання\nз курсу'
          : 'успішно завершила навчання\nз курсу';
      case 'course_name':
        return selectedCourse?.title ? `«${selectedCourse.title}»` : "«Комп'ютерна графіка та дизайн»";
      case 'issue_date':
        return formatPreviewDate(formData.issue_date);
      default:
        return '';
    }
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
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDownload(certificate.id)}
                          title="Завантажити PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(certificate.id)}
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: '1280px',
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
                background: 'rgba(255, 255, 255, 0.86)',
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
                padding: '24px',
                display: 'grid',
                gap: '24px',
                gridTemplateColumns: 'minmax(320px, 380px) minmax(0, 1fr)',
              }}
            >
              <div style={{ display: 'grid', gap: '18px', alignContent: 'start' }}>
                <section style={modalCardStyle}>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '15px', lineHeight: '22px', fontWeight: 700, color: 'var(--gray-900)' }}>
                      Дані сертифіката
                    </span>
                    <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
                      Обов'язкові поля зібрані в одному місці, щоб не губитися між налаштуваннями шаблону.
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Учень <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      className="form-select"
                      value={formData.student_id}
                      onChange={(event) => onStudentChange(event.target.value)}
                    >
                      <option value="">Оберіть учня</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.full_name}
                        </option>
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
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
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
                      borderRadius: '12px',
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

                <section style={modalCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ fontSize: '15px', lineHeight: '22px', fontWeight: 700, color: 'var(--gray-900)' }}>
                        Шаблон
                      </span>
                      <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
                        PNG або JPG. Завантажений фон одразу з'являється в прев'ю.
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

                      <button
                        className="btn btn-primary"
                        onClick={handleUploadTemplate}
                        disabled={!selectedFile || uploading}
                        style={{ minWidth: '132px' }}
                      >
                        {uploading ? 'Завантаження…' : 'Оновити шаблон'}
                      </button>
                    </div>
                  </div>
                </section>

                <section style={modalCardStyle}>
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
                        Виберіть блок і відредагуйте його параметри нижче.
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
                            <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: 600 }}>
                              {BLOCK_LABELS[block.key]}
                            </span>
                            <span style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--gray-500)' }}>
                              {Math.round(block.xPercent)}% / {Math.round(block.yPercent)}%
                            </span>
                          </span>
                          <span style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--gray-500)' }}>
                            {block.size}px
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {activeBlock && selectedBlock !== null && (
                    <div
                      style={{
                        display: 'grid',
                        gap: '14px',
                        paddingTop: '4px',
                        borderTop: '1px solid var(--gray-100)',
                      }}
                    >
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
                            min="8"
                            max="96"
                            value={activeBlock.size}
                            onChange={(event) => updateBlock(selectedBlock, { size: parseInt(event.target.value, 10) || 8 })}
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

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '14px',
                          lineHeight: '20px',
                          color: 'var(--gray-700)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={activeBlock.wrap}
                          onChange={(event) => updateBlock(selectedBlock, { wrap: event.target.checked })}
                        />
                        Дозволити перенесення рядків
                      </label>
                    </div>
                  )}
                </section>
              </div>

              <div style={{ display: 'grid', gap: '18px', minWidth: 0 }}>
                <section style={{ ...modalCardStyle, padding: '18px 18px 16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ fontSize: '15px', lineHeight: '22px', fontWeight: 700, color: 'var(--gray-900)' }}>
                        Прев'ю сертифіката
                      </span>
                      <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
                        Перетягніть активний блок або рухайте полотно, затиснувши порожнє місце.
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

                      <button className="btn btn-secondary btn-sm" onClick={() => adjustScale(-0.1)} title="Зменшити">
                        <ZoomOut size={15} />
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={resetViewport} title="Скинути вигляд">
                        <RotateCcw size={15} />
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => adjustScale(0.1)} title="Збільшити">
                        <ZoomIn size={15} />
                      </button>
                    </div>
                  </div>

                  {templateUrl ? (
                    <div
                      ref={viewportRef}
                      style={{
                        position: 'relative',
                        borderRadius: '18px',
                        overflow: 'hidden',
                        border: '1px solid rgba(148, 163, 184, 0.24)',
                        background: 'linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)',
                        minHeight: '62vh',
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
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: '100%',
                          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
                          transformOrigin: 'center center',
                          cursor: dragging !== null ? 'grabbing' : isPanning ? 'grabbing' : 'default',
                          userSelect: 'none',
                          containerType: 'inline-size',
                        }}
                      >
                        <img
                          src={templateUrl}
                          alt="Template"
                          onLoad={(event) => setImageDimensions({
                            width: event.currentTarget.naturalWidth || 842,
                            height: event.currentTarget.naturalHeight || 595,
                          })}
                          style={{ width: '100%', display: 'block', pointerEvents: 'none' }}
                        />

                        {blocks.map((block, index) => {
                          const isSelected = selectedBlock === index;
                          const isNameBlock = block.key === 'student_name';
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
                                fontSize: `${(block.size / imageDimensions.width) * 100}cqw`,
                                color: block.color,
                                fontFamily: isNameBlock ? "'Cassandra', cursive" : "'Montserrat', sans-serif",
                                fontWeight: block.weight === 'bold' ? 700 : 400,
                                fontStyle: block.style === 'italic' ? 'italic' : 'normal',
                                cursor: isSelected ? 'grab' : 'pointer',
                                padding: '0.55cqw 0.8cqw',
                                whiteSpace: block.wrap ? 'pre-wrap' : 'nowrap',
                                maxWidth: block.wrap ? '38cqw' : 'none',
                                border: isSelected ? '1px dashed rgba(37, 99, 235, 0.9)' : '1px solid transparent',
                                background: isSelected ? 'rgba(255, 255, 255, 0.72)' : 'transparent',
                                borderRadius: '0.7cqw',
                                lineHeight: 1.12,
                                textAlign: block.align,
                                zIndex: isSelected ? 5 : 1,
                                boxShadow: isSelected ? '0 10px 24px rgba(37, 99, 235, 0.14)' : 'none',
                                transition: 'background-color 180ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out, transform 120ms ease-out',
                              }}
                            >
                              {getPreviewText(block.key)}
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

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '10px',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: 'var(--gray-50)',
                      border: '1px solid var(--gray-200)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gray-600)', fontSize: '13px', lineHeight: '18px' }}>
                      <Move size={15} />
                      Активний блок можна перетягувати просто на макеті.
                    </div>
                    <div style={{ color: 'var(--gray-500)', fontSize: '12px', lineHeight: '16px' }}>
                      Поле стилів зібране зліва, щоб не перекривати сертифікат у прев'ю.
                    </div>
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
              <button className="modal-close" onClick={() => setDeleteConfirmId(null)}>
                ×
              </button>
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
