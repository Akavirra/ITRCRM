'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  Download,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Undo2,
  Upload,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import PageLoading from '@/components/PageLoading';
import { useUser } from '@/components/UserContext';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import s from './graduation/graduation.module.css';

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

type TextWeight = 'normal' | 'bold';
type TextStyle = 'normal' | 'italic';
type AccordionKey = 'data' | 'blocks' | 'template';
type BlockKey = 'id' | 'amount';

interface GiftCertificateSettings {
  fontSize: number;
  xPercent: number;
  yPercent: number;
  color: string;
  idLetterSpacing: number;
  idWeight: TextWeight;
  idStyle: TextStyle;
  amountFontSize: number;
  amountXPercent: number;
  amountYPercent: number;
  amountColor: string;
  amountRotation: number;
  amountWeight: TextWeight;
  amountStyle: TextStyle;
}

interface EditorFormData {
  amount: number;
  notes: string;
  count: number;
}

interface EditorSnapshot {
  settings: GiftCertificateSettings;
  formData: EditorFormData;
  pan: { x: number; y: number };
  scale: number;
  selectedBlock: BlockKey | null;
}

const DEFAULT_SETTINGS: GiftCertificateSettings = {
  fontSize: 36,
  xPercent: 50,
  yPercent: 12,
  color: '#000000',
  idLetterSpacing: 1.5,
  idWeight: 'normal',
  idStyle: 'normal',
  amountFontSize: 48,
  amountXPercent: 78,
  amountYPercent: 28,
  amountColor: '#FFFFFF',
  amountRotation: -28,
  amountWeight: 'normal',
  amountStyle: 'normal',
};

const DEFAULT_FORM_DATA: EditorFormData = {
  amount: 1000,
  notes: '',
  count: 1,
};

export default function CertificatesPage() {
  const router = useRouter();
  const { user } = useUser();

  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<EditorFormData>(DEFAULT_FORM_DATA);
  const [saving, setSaving] = useState(false);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [idSettings, setIdSettings] = useState<GiftCertificateSettings>(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 842, height: 595 });
  const [nextPublicId, setNextPublicId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<AccordionKey>('data');
  const [selectedBlock, setSelectedBlock] = useState<BlockKey | null>('amount');
  const [dragging, setDragging] = useState<{ target: BlockKey; offsetX: number; offsetY: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<EditorSnapshot[]>([]);

  const presetAmounts = [500, 1000, 2000];
  const isCustomAmount = !presetAmounts.includes(formData.amount);
  const canCreate = !saving && formData.amount > 0 && formData.count > 0;
  const totalAmount = Math.max(formData.amount, 0) * Math.max(formData.count, 0);
  const selectedTemplateName = selectedFile?.name || 'Файл ще не вибрано';
  const scaledWidth = imageDimensions.width * scale;
  const scaledHeight = imageDimensions.height * scale;
  const panBounds = {
    x: Math.max(0, Math.round((scaledWidth - viewportSize.width) / 2)),
    y: Math.max(0, Math.round((scaledHeight - viewportSize.height) / 2)),
  };
  const canUndo = historyRef.current.length > 0;

  const activeBlock = selectedBlock === 'id'
    ? {
        key: 'id' as const,
        label: 'ID сертифіката',
        preview: nextPublicId || 'GC-00001',
        fontSize: idSettings.fontSize,
        xPercent: idSettings.xPercent,
        yPercent: idSettings.yPercent,
        color: idSettings.color,
        weight: idSettings.idWeight,
        style: idSettings.idStyle,
        extraLabel: 'Відступ між символами',
        extraValue: idSettings.idLetterSpacing,
        fontFamily: 'var(--font-certificate-id), sans-serif',
      }
    : {
        key: 'amount' as const,
        label: 'Номінал',
        preview: `${formData.amount || 0}`,
        fontSize: idSettings.amountFontSize,
        xPercent: idSettings.amountXPercent,
        yPercent: idSettings.amountYPercent,
        color: idSettings.amountColor,
        weight: idSettings.amountWeight,
        style: idSettings.amountStyle,
        extraLabel: 'Поворот',
        extraValue: idSettings.amountRotation,
        fontFamily: 'var(--font-certificate-amount), sans-serif',
      };

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        if (!user || user.role !== 'admin') {
          router.push('/dashboard');
          return;
        }

        const [certRes, templateRes, settingsRes, nextRes] = await Promise.all([
          fetch('/api/admin-app/certificates'),
          fetch('/api/admin-app/certificates/template'),
          fetch('/api/admin-app/certificates/settings'),
          fetch('/api/admin-app/certificates/next-id'),
        ]);

        const certData = await certRes.json();
        setCertificates(Array.isArray(certData) ? certData : []);

        const templateData = await templateRes.json();
        if (templateData.url) {
          setTemplateUrl(templateData.url);
        }

        const settingsData = await settingsRes.json();
        if (settingsData && !settingsData.error) {
          setIdSettings((prev) => ({ ...prev, ...settingsData }));
        }

        const nextData = await nextRes.json();
        if (nextData?.nextId) {
          setNextPublicId(nextData.nextId);
        }
      } catch (error) {
        console.error('Failed to fetch certificates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCertificates();
  }, [router, user]);

  useEffect(() => {
    if (!showModal) return;

    const fitPreview = () => {
      if (!viewportRef.current || !imageDimensions.width || !imageDimensions.height) return;

      const viewportWidth = Math.max(viewportRef.current.clientWidth - 40, 0);
      const viewportHeight = Math.max(viewportRef.current.clientHeight - 40, 0);
      setViewportSize({ width: viewportWidth, height: viewportHeight });

      const widthScale = viewportWidth / imageDimensions.width;
      const heightScale = viewportHeight / imageDimensions.height;
      const nextScale = Math.min(widthScale, heightScale, 1);

      setScale(Math.max(0.45, Math.round(nextScale * 100) / 100));
      setPan({ x: 0, y: 0 });
    };

    fitPreview();
    window.addEventListener('resize', fitPreview);
    return () => window.removeEventListener('resize', fitPreview);
  }, [showModal, imageDimensions.width, imageDimensions.height]);

  useEffect(() => {
    if (!showModal) return;

    const element = viewportRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      adjustScale(event.deltaY > 0 ? -0.08 : 0.08);
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
        event.preventDefault();
        undoLastChange();
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTypingTarget = Boolean(
        target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        )
      );

      if (isTypingTarget || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const stepX = 100 / imageDimensions.width;
      const stepY = 100 / imageDimensions.height;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        pushHistory();
        if (selectedBlock === 'id') {
          setIdSettings((prev) => ({ ...prev, xPercent: Number(Math.max(0, prev.xPercent - stepX).toFixed(3)) }));
        } else {
          setIdSettings((prev) => ({ ...prev, amountXPercent: Number(Math.max(0, prev.amountXPercent - stepX).toFixed(3)) }));
        }
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        pushHistory();
        if (selectedBlock === 'id') {
          setIdSettings((prev) => ({ ...prev, xPercent: Number(Math.min(100, prev.xPercent + stepX).toFixed(3)) }));
        } else {
          setIdSettings((prev) => ({ ...prev, amountXPercent: Number(Math.min(100, prev.amountXPercent + stepX).toFixed(3)) }));
        }
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        pushHistory();
        if (selectedBlock === 'id') {
          setIdSettings((prev) => ({ ...prev, yPercent: Number(Math.min(100, prev.yPercent + stepY).toFixed(3)) }));
        } else {
          setIdSettings((prev) => ({ ...prev, amountYPercent: Number(Math.min(100, prev.amountYPercent + stepY).toFixed(3)) }));
        }
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        pushHistory();
        if (selectedBlock === 'id') {
          setIdSettings((prev) => ({ ...prev, yPercent: Number(Math.max(0, prev.yPercent - stepY).toFixed(3)) }));
        } else {
          setIdSettings((prev) => ({ ...prev, amountYPercent: Number(Math.max(0, prev.amountYPercent - stepY).toFixed(3)) }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, selectedBlock, imageDimensions.width, imageDimensions.height]);

  const createSnapshot = (): EditorSnapshot => ({
    settings: { ...idSettings },
    formData: { ...formData },
    pan: { ...pan },
    scale,
    selectedBlock,
  });

  const applySnapshot = (snapshot: EditorSnapshot) => {
    setIdSettings({ ...snapshot.settings });
    setFormData({ ...snapshot.formData });
    setPan({ ...snapshot.pan });
    setScale(snapshot.scale);
    setSelectedBlock(snapshot.selectedBlock);
  };

  const pushHistory = (snapshot = createSnapshot()) => {
    const lastSnapshot = historyRef.current[historyRef.current.length - 1];
    const serializedSnapshot = JSON.stringify(snapshot);
    if (lastSnapshot && JSON.stringify(lastSnapshot) === serializedSnapshot) return;
    historyRef.current.push(snapshot);
    if (historyRef.current.length > 100) {
      historyRef.current.shift();
    }
  };

  const undoLastChange = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    applySnapshot(previous);
  };

  const toggleAccordion = (key: AccordionKey) => {
    setOpenAccordion((prev) => (prev === key ? prev : key));
  };

  const resetViewport = () => {
    if (!viewportRef.current || !imageDimensions.width || !imageDimensions.height) return;

    const viewportWidth = Math.max(viewportRef.current.clientWidth - 40, 0);
    const viewportHeight = Math.max(viewportRef.current.clientHeight - 40, 0);
    setViewportSize({ width: viewportWidth, height: viewportHeight });

    const widthScale = viewportWidth / imageDimensions.width;
    const heightScale = viewportHeight / imageDimensions.height;
    const nextScale = Math.min(widthScale, heightScale, 1);

    setScale(Math.max(0.45, Math.round(nextScale * 100) / 100));
    setPan({ x: 0, y: 0 });
  };

  const adjustScale = (delta: number) => {
    setScale((prev) => Math.max(0.45, Math.min(2.4, Math.round((prev + delta) * 100) / 100)));
  };

  const handleCanvasMouseDown = (event: React.MouseEvent) => {
    const clickedCanvasSurface = event.target === event.currentTarget || event.target instanceof HTMLImageElement;

    if (event.button === 0 && clickedCanvasSurface && (scale > 1 || pan.x !== 0 || pan.y !== 0)) {
      event.preventDefault();
      pushHistory();
      setSelectedBlock(null);
      setDragging(null);
      setIsPanning(true);
      setPanStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
      return;
    }

    if (event.button === 0 && clickedCanvasSurface) {
      event.preventDefault();
      setSelectedBlock(null);
      setDragging(null);
    }
  };

  const updateSettings = (patch: Partial<GiftCertificateSettings>) => {
    pushHistory();
    setIdSettings((prev) => ({ ...prev, ...patch }));
  };

  const updateFormData = (patch: Partial<EditorFormData>, shouldRecordHistory = false) => {
    if (shouldRecordHistory) {
      pushHistory();
    }
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  const handleCreate = () => {
    setFormData(DEFAULT_FORM_DATA);
    setSelectedFile(null);
    setOpenAccordion('data');
    setSelectedBlock('amount');
    historyRef.current = [];
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

  const handleDownload = (id: number) => {
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
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Помилка завантаження');
        return;
      }

      const data = await res.json();
      setTemplateUrl(data.url);
      setSelectedFile(null);
      alert('Шаблон сертифіката оновлено');
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
      const res = await fetch('/api/admin-app/certificates/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(idSettings),
      });

      if (res.ok) {
        alert('Налаштування збережено');
      }
    } catch (error) {
      console.error(error);
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
        body: JSON.stringify({ action: isPrinted ? 'unprint' : 'print' }),
      });

      if (!res.ok) throw new Error('Failed');

      setCertificates((prev) =>
        prev.map((certificate) =>
          certificate.id === id
            ? { ...certificate, printed_at: isPrinted ? null : new Date().toISOString() }
            : certificate
        )
      );
    } catch (error) {
      console.error(error);
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
      setCertificates((prev) => prev.filter((certificate) => certificate.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error(error);
      alert('Помилка видалення');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({ x: event.clientX - panStart.x, y: event.clientY - panStart.y });
      return;
    }

    if (!dragging) return;

    const container = previewRef.current?.getBoundingClientRect();
    if (!container) return;

    let x = ((event.clientX - container.left - dragging.offsetX) / container.width) * 100;
    let y = 100 - (((event.clientY - container.top - dragging.offsetY) / container.height) * 100);

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    if (dragging.target === 'id') {
      setIdSettings((prev) => ({
        ...prev,
        xPercent: parseFloat(x.toFixed(2)),
        yPercent: parseFloat(y.toFixed(2)),
      }));
      return;
    }

    setIdSettings((prev) => ({
      ...prev,
      amountXPercent: parseFloat(x.toFixed(2)),
      amountYPercent: parseFloat(y.toFixed(2)),
    }));
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  const getStatusBadge = (certificate: CertificateData) => {
    if (certificate.status === 'used') return <span className="badge badge-info">Використано</span>;
    if (certificate.status === 'expired') return <span className="badge badge-gray">Протерміновано</span>;
    if (certificate.status === 'canceled') return <span className="badge badge-danger">Скасовано</span>;
    if (certificate.printed_at) {
      return <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>Надруковано</span>;
    }
    return <span className="badge badge-success">{t('status.active')}</span>;
  };

  if (loading) return <PageLoading />;
  if (!user || user.role !== 'admin') return null;

  const filteredCertificates = certificates.filter((certificate) => (
    showArchived ? Boolean(certificate.printed_at) : !certificate.printed_at
  ));

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.5rem' }}>
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
          Подарункові
        </button>
        <button
          className="btn btn-sm"
          onClick={() => router.push('/certificates/graduation')}
          style={{
            fontWeight: 400,
            color: '#6b7280',
            borderBottom: '2px solid transparent',
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
          <h3 className="card-title">{t('nav.certificates')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: !showArchived ? 600 : 400, color: !showArchived ? '#111827' : '#9ca3af', transition: 'color 150ms ease-out' }}>
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
                  transition: 'background-color 150ms ease-out, transform 120ms ease-out',
                  margin: '0 0.375rem',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    backgroundColor: showArchived ? '#6b7280' : '#374151',
                    borderRadius: '3px',
                    transition: 'transform 180ms ease-out, background-color 180ms ease-out',
                    transform: showArchived ? 'translateX(16px)' : 'translateX(0)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}
                />
              </button>
              <span style={{ fontSize: '0.8125rem', fontWeight: showArchived ? 600 : 400, color: showArchived ? '#111827' : '#9ca3af', transition: 'color 150ms ease-out' }}>
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
                {filteredCertificates.map((certificate) => (
                  <tr key={certificate.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280' }}>{certificate.public_id}</td>
                    <td style={{ fontWeight: 600 }}>{certificate.amount} грн</td>
                    <td>{getStatusBadge(certificate)}</td>
                    <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{formatDateKyiv(certificate.issued_at)}</td>
                    <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{certificate.creator_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => handlePrintToggle(certificate.id, Boolean(certificate.printed_at))}
                          title={certificate.printed_at ? 'Надруковано' : 'Позначити як надруковано'}
                          style={{
                            padding: '6px 10px',
                            background: certificate.printed_at ? '#dcfce7' : 'transparent',
                            color: certificate.printed_at ? '#16a34a' : 'var(--gray-500)',
                            border: certificate.printed_at ? '1px solid #16a34a' : '1px solid var(--gray-300)',
                          }}
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDownload(certificate.id)}
                          title="Завантажити PDF"
                          style={{ padding: '6px 10px' }}
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(certificate.id)}
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
              <p className="empty-state-description">
                {showArchived ? 'Надруковані сертифікати з’являться тут.' : t('emptyStates.noCertificatesHint')}
              </p>
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

      {deleteConfirmId !== null && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
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
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleteLoading} style={{ minWidth: '120px' }}>
                {deleteLoading ? 'Видалення…' : 'Видалити'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <h3 className={s.modalTitle}>Сертифікат на навчання</h3>
                    <span className={s.headerDivider}>•</span>
                    <span className={s.headerStudent}>{activeBlock.preview}</span>
                  </div>
                  <p className={s.modalSubtitle}>
                    Одне вікно для генерації, шаблону й точного керування двома блоками: сумою та ID.
                  </p>
                </div>
              </div>

              <div className={s.headerActions}>
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
                    <span className={s.canvasHint}>
                      Wheel масштабує, `Ctrl+Z` повертає попередній стан, а drag & drop не змінює пропорції самого шаблону.
                    </span>
                  </div>

                  <div className={s.canvasToolbar}>
                    <button type="button" className={s.toolbarBtn} onClick={undoLastChange} title="Крок назад (Ctrl+Z)" disabled={!canUndo}>
                      <Undo2 size={15} />
                    </button>
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
                    <div className={s.canvasFrame}>
                      <div
                        ref={previewRef}
                        className={s.canvasContent}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onMouseDown={handleCanvasMouseDown}
                        style={{
                          width: `${imageDimensions.width}px`,
                          aspectRatio: `${imageDimensions.width} / ${imageDimensions.height}`,
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                          transformOrigin: 'center center',
                          cursor: dragging ? 'grabbing' : isPanning ? 'grabbing' : (scale > 1 || pan.x !== 0 || pan.y !== 0) ? 'grab' : 'default',
                        }}
                      >
                        <img
                          src={templateUrl}
                          alt="Шаблон сертифіката"
                          onLoad={(event) => setImageDimensions({
                            width: event.currentTarget.naturalWidth || 842,
                            height: event.currentTarget.naturalHeight || 595,
                          })}
                          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
                        />

                        <div
                          className={`${s.canvasBlock} ${selectedBlock === 'id' ? s.canvasBlockSelected : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedBlock('id');
                            setOpenAccordion('blocks');
                          }}
                          onMouseDown={(event) => {
                            if (selectedBlock !== 'id') return;
                            event.stopPropagation();
                            pushHistory();
                            const rect = event.currentTarget.getBoundingClientRect();
                            setDragging({
                              target: 'id',
                              offsetX: event.clientX - (rect.left + rect.width / 2),
                              offsetY: event.clientY - (rect.top + rect.height / 2),
                            });
                          }}
                          style={{
                            left: `${idSettings.xPercent}%`,
                            bottom: `${idSettings.yPercent}%`,
                            transform: 'translateX(-50%)',
                            color: idSettings.color,
                            fontSize: `${idSettings.fontSize}px`,
                            letterSpacing: `${idSettings.idLetterSpacing}px`,
                            fontFamily: 'var(--font-certificate-id), sans-serif',
                            fontWeight: idSettings.idWeight === 'bold' ? 700 : 400,
                            fontStyle: idSettings.idStyle,
                            whiteSpace: 'nowrap',
                            maxWidth: 'none',
                          }}
                        >
                          {selectedBlock === 'id' && (
                            <div className={s.blockToolbar} onMouseDown={(event) => event.stopPropagation()} style={{ transform: `translateX(-50%) scale(${1 / scale})` }}>
                              <input type="color" value={idSettings.color} onChange={(event) => updateSettings({ color: event.target.value })} className={s.blockColorInput} />
                              <button type="button" onClick={() => updateSettings({ idWeight: idSettings.idWeight === 'bold' ? 'normal' : 'bold' })} className={`${s.blockToolbarBtn} ${idSettings.idWeight === 'bold' ? s.blockToolbarBtnActive : ''}`} title="Жирний">B</button>
                              <button type="button" onClick={() => updateSettings({ idStyle: idSettings.idStyle === 'italic' ? 'normal' : 'italic' })} className={`${s.blockToolbarBtn} ${idSettings.idStyle === 'italic' ? s.blockToolbarBtnActive : ''}`} title="Курсив">I</button>
                              <button type="button" onClick={() => updateSettings({ fontSize: Math.max(10, idSettings.fontSize - 2) })} className={s.blockToolbarBtn} title="Зменшити розмір">-</button>
                              <button type="button" className={s.blockToolbarSize} title={`Поточний розмір: ${idSettings.fontSize}px`}>{idSettings.fontSize}px</button>
                              <button type="button" onClick={() => updateSettings({ fontSize: Math.min(160, idSettings.fontSize + 2) })} className={s.blockToolbarBtn} title="Збільшити розмір">+</button>
                            </div>
                          )}
                          {nextPublicId || 'GC-00001'}
                        </div>

                        <div
                          className={`${s.canvasBlock} ${selectedBlock === 'amount' ? s.canvasBlockSelected : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedBlock('amount');
                            setOpenAccordion('blocks');
                          }}
                          onMouseDown={(event) => {
                            if (selectedBlock !== 'amount') return;
                            event.stopPropagation();
                            pushHistory();
                            const rect = event.currentTarget.getBoundingClientRect();
                            setDragging({
                              target: 'amount',
                              offsetX: event.clientX - (rect.left + rect.width / 2),
                              offsetY: event.clientY - (rect.top + rect.height / 2),
                            });
                          }}
                          style={{
                            left: `${idSettings.amountXPercent}%`,
                            bottom: `${idSettings.amountYPercent}%`,
                            transform: `translateX(-50%) rotate(${idSettings.amountRotation}deg)`,
                            color: idSettings.amountColor,
                            fontSize: `${idSettings.amountFontSize}px`,
                            fontFamily: 'var(--font-certificate-amount), sans-serif',
                            fontWeight: idSettings.amountWeight === 'bold' ? 700 : 400,
                            fontStyle: idSettings.amountStyle,
                            whiteSpace: 'nowrap',
                            maxWidth: 'none',
                            textAlign: 'center',
                          }}
                        >
                          {selectedBlock === 'amount' && (
                            <div className={s.blockToolbar} onMouseDown={(event) => event.stopPropagation()} style={{ transform: `translateX(-50%) scale(${1 / scale})` }}>
                              <input type="color" value={idSettings.amountColor} onChange={(event) => updateSettings({ amountColor: event.target.value })} className={s.blockColorInput} />
                              <button type="button" onClick={() => updateSettings({ amountWeight: idSettings.amountWeight === 'bold' ? 'normal' : 'bold' })} className={`${s.blockToolbarBtn} ${idSettings.amountWeight === 'bold' ? s.blockToolbarBtnActive : ''}`} title="Жирний">B</button>
                              <button type="button" onClick={() => updateSettings({ amountStyle: idSettings.amountStyle === 'italic' ? 'normal' : 'italic' })} className={`${s.blockToolbarBtn} ${idSettings.amountStyle === 'italic' ? s.blockToolbarBtnActive : ''}`} title="Курсив">I</button>
                              <button type="button" onClick={() => updateSettings({ amountFontSize: Math.max(10, idSettings.amountFontSize - 2) })} className={s.blockToolbarBtn} title="Зменшити розмір">-</button>
                              <button type="button" className={s.blockToolbarSize} title={`Поточний розмір: ${idSettings.amountFontSize}px`}>{idSettings.amountFontSize}px</button>
                              <button type="button" onClick={() => updateSettings({ amountFontSize: Math.min(160, idSettings.amountFontSize + 2) })} className={s.blockToolbarBtn} title="Збільшити розмір">+</button>
                            </div>
                          )}
                          {formData.amount || 0}
                        </div>
                      </div>

                      {(panBounds.x > 0 || panBounds.y > 0) && (
                        <div className={s.panOverlay}>
                          {panBounds.y > 0 && (
                            <div className={`${s.panRail} ${s.panRailVertical}`}>
                              <input
                                type="range"
                                min={-panBounds.y}
                                max={panBounds.y}
                                value={Math.round(pan.y)}
                                onChange={(event) => setPan((prev) => ({ ...prev, y: parseInt(event.target.value, 10) }))}
                                className={`${s.panSlider} ${s.panSliderVertical}`}
                                aria-label="Прокрутка по вертикалі"
                              />
                            </div>
                          )}
                          {panBounds.x > 0 && (
                            <div className={`${s.panRail} ${s.panRailHorizontal}`}>
                              <input
                                type="range"
                                min={-panBounds.x}
                                max={panBounds.x}
                                value={Math.round(pan.x)}
                                onChange={(event) => setPan((prev) => ({ ...prev, x: parseInt(event.target.value, 10) }))}
                                className={`${s.panSlider} ${s.panSliderHorizontal}`}
                                aria-label="Прокрутка по горизонталі"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={s.canvasEmpty}>
                    <span className={s.canvasEmptyTitle}>Спочатку завантажте шаблон сертифіката</span>
                    <span className={s.canvasEmptyDesc}>Після цього тут з’явиться повноцінне прев’ю без спотворення пропорцій.</span>
                  </div>
                )}
              </section>

              <aside className={s.sidebar}>
                <div className={s.sidebarInner}>
                  <section className={s.accordionSection}>
                    <button type="button" className={s.accordionHeader} onClick={() => toggleAccordion('data')}>
                      <div>
                        <div className={s.accordionTitle}>Дані</div>
                        <div className={s.accordionMeta}>Номінал, кількість і службова нотатка</div>
                      </div>
                      <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'data' ? s.accordionChevronOpen : ''}`} />
                    </button>
                    {openAccordion === 'data' && (
                      <div className={s.accordionBody}>
                        <div className={s.summaryCard}>
                          <span className={s.summaryLabel}>Поточна генерація</span>
                          <strong className={s.summaryValue}>{formData.count} шт. · {totalAmount} грн</strong>
                          <span className={s.summaryMeta}>Максимум за один запуск: 50 сертифікатів</span>
                        </div>

                        <div className={s.compactGroup}>
                          <label className={s.compactLabel}>Номінал <span className={s.compactRequired}>*</span></label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {presetAmounts.map((amount) => (
                              <button
                                key={amount}
                                type="button"
                                className={`${s.segmentedOption} ${formData.amount === amount ? s.segmentedOptionActive : ''}`}
                                style={{ minWidth: '84px' }}
                                onClick={() => updateFormData({ amount }, true)}
                              >
                                {amount} грн
                              </button>
                            ))}
                            <button
                              type="button"
                              className={`${s.segmentedOption} ${isCustomAmount ? s.segmentedOptionActive : ''}`}
                              onClick={() => updateFormData({ amount: 0 }, true)}
                            >
                              Свій номінал
                            </button>
                          </div>
                        </div>

                        <div className={s.compactRow}>
                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>Сума вручну</label>
                            <input
                              type="number"
                              className="form-input"
                              value={formData.amount === 0 ? '' : formData.amount}
                              onChange={(event) => updateFormData({ amount: parseInt(event.target.value, 10) || 0 }, true)}
                              min="1"
                            />
                          </div>
                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>Кількість <span className={s.compactRequired}>*</span></label>
                            <input
                              type="number"
                              className="form-input"
                              value={formData.count}
                              onChange={(event) => updateFormData({ count: parseInt(event.target.value, 10) || 1 }, true)}
                              min="1"
                              max="50"
                            />
                          </div>
                        </div>

                        <div className={s.compactGroup}>
                          <label className={s.compactLabel}>{t('common.note')}</label>
                          <textarea
                            className="form-input"
                            rows={3}
                            value={formData.notes}
                            onChange={(event) => updateFormData({ notes: event.target.value }, true)}
                            placeholder="Наприклад: для подарунка, акції чи внутрішнього обліку"
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--text-muted)' }}>
                          <CheckCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                          <span style={{ fontSize: '12px', lineHeight: '16px' }}>
                            Без учнів, груп і курсів: тільки те, що реально потрібно подарунковому сертифікату.
                          </span>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className={s.accordionSection}>
                    <button type="button" className={s.accordionHeader} onClick={() => toggleAccordion('blocks')}>
                      <div>
                        <div className={s.accordionTitle}>Текстові блоки</div>
                        <div className={s.accordionMeta}>ID і сума сертифіката</div>
                      </div>
                      <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'blocks' ? s.accordionChevronOpen : ''}`} />
                    </button>
                    {openAccordion === 'blocks' && (
                      <div className={s.accordionBody}>
                        <div className={s.blockList}>
                          {[
                            { key: 'id' as const, name: 'ID сертифіката', x: idSettings.xPercent, y: idSettings.yPercent, size: idSettings.fontSize },
                            { key: 'amount' as const, name: 'Номінал', x: idSettings.amountXPercent, y: idSettings.amountYPercent, size: idSettings.amountFontSize },
                          ].map((block) => (
                            <button
                              key={block.key}
                              type="button"
                              onClick={() => setSelectedBlock(block.key)}
                              className={`${s.blockItem} ${selectedBlock === block.key ? s.blockItemActive : ''}`}
                            >
                              <span>
                                <span className={s.blockItemName}>{block.name}</span>
                                <span className={s.blockItemMeta}>{Math.round(block.x)}% / {Math.round(block.y)}%</span>
                              </span>
                              <span className={s.blockItemMeta}>{block.size}px</span>
                            </button>
                          ))}
                        </div>

                        <div className={s.blockEditor}>
                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>Текст у прев’ю</label>
                            <input
                              className="form-input"
                              value={activeBlock.preview}
                              onChange={(event) => {
                                if (activeBlock.key === 'amount') {
                                  const numericValue = parseInt(event.target.value.replace(/[^\d]/g, ''), 10) || 0;
                                  updateFormData({ amount: numericValue }, true);
                                }
                              }}
                              disabled={activeBlock.key === 'id'}
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
                                value={activeBlock.fontSize}
                                onChange={(event) => {
                                  const nextValue = parseInt(event.target.value, 10) || 10;
                                  if (activeBlock.key === 'id') {
                                    updateSettings({ fontSize: nextValue });
                                  } else {
                                    updateSettings({ amountFontSize: nextValue });
                                  }
                                }}
                              />
                            </div>
                            <div className={s.compactGroup}>
                              <label className={s.compactLabel}>Колір</label>
                              <input
                                type="color"
                                className={`form-input ${s.colorInput}`}
                                value={activeBlock.color}
                                onChange={(event) => {
                                  if (activeBlock.key === 'id') {
                                    updateSettings({ color: event.target.value });
                                  } else {
                                    updateSettings({ amountColor: event.target.value });
                                  }
                                }}
                              />
                            </div>
                          </div>

                          <div className={s.compactRow}>
                            <div className={s.compactGroup}>
                              <label className={s.compactLabel}>Накреслення</label>
                              <select
                                className="form-select"
                                value={`${activeBlock.weight}:${activeBlock.style}`}
                                onChange={(event) => {
                                  const [weight, style] = event.target.value.split(':') as [TextWeight, TextStyle];
                                  if (activeBlock.key === 'id') {
                                    updateSettings({ idWeight: weight, idStyle: style });
                                  } else {
                                    updateSettings({ amountWeight: weight, amountStyle: style });
                                  }
                                }}
                              >
                                <option value="normal:normal">Звичайне</option>
                                <option value="bold:normal">Жирне</option>
                                <option value="normal:italic">Курсив</option>
                                <option value="bold:italic">Жирний курсив</option>
                              </select>
                            </div>
                            <div className={s.compactGroup}>
                              <label className={s.compactLabel}>Шрифт</label>
                              <input className="form-input" value={activeBlock.key === 'id' ? 'Bebas Neue Cyrillic' : 'Ermilov'} readOnly />
                            </div>
                          </div>

                          <div className={s.sliderGroup}>
                            <label className={s.compactLabel}>Позиція зліва: {Math.round(activeBlock.xPercent)}%</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={activeBlock.xPercent}
                              onChange={(event) => {
                                const nextValue = parseInt(event.target.value, 10);
                                if (activeBlock.key === 'id') {
                                  updateSettings({ xPercent: nextValue });
                                } else {
                                  updateSettings({ amountXPercent: nextValue });
                                }
                              }}
                            />
                          </div>

                          <div className={s.sliderGroup}>
                            <label className={s.compactLabel}>Позиція знизу: {Math.round(activeBlock.yPercent)}%</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={activeBlock.yPercent}
                              onChange={(event) => {
                                const nextValue = parseInt(event.target.value, 10);
                                if (activeBlock.key === 'id') {
                                  updateSettings({ yPercent: nextValue });
                                } else {
                                  updateSettings({ amountYPercent: nextValue });
                                }
                              }}
                            />
                          </div>

                          <div className={s.compactGroup}>
                            <label className={s.compactLabel}>{activeBlock.extraLabel}</label>
                            <input
                              type="number"
                              className="form-input"
                              step={activeBlock.key === 'id' ? '0.5' : '1'}
                              value={activeBlock.extraValue}
                              onChange={(event) => {
                                const nextValue = activeBlock.key === 'id'
                                  ? parseFloat(event.target.value) || 0
                                  : parseInt(event.target.value, 10) || 0;

                                if (activeBlock.key === 'id') {
                                  updateSettings({ idLetterSpacing: nextValue });
                                } else {
                                  updateSettings({ amountRotation: nextValue });
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className={s.accordionSection}>
                    <button type="button" className={s.accordionHeader} onClick={() => toggleAccordion('template')}>
                      <div>
                        <div className={s.accordionTitle}>Шаблон</div>
                        <div className={s.accordionMeta}>PNG або JPG для фону</div>
                      </div>
                      <ChevronDown className={`${s.accordionChevron} ${openAccordion === 'template' ? s.accordionChevronOpen : ''}`} />
                    </button>
                    {openAccordion === 'template' && (
                      <div className={s.accordionBody}>
                        <input
                          id="certificate-template-upload"
                          type="file"
                          accept="image/png,image/jpeg"
                          style={{ display: 'none' }}
                          onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        />

                        <div className={s.templateInfo}>
                          <span className={s.templateHint}>Поточний файл</span>
                          <span className={s.templateFileName}>{selectedTemplateName}</span>
                        </div>

                        <div className={s.templateActions}>
                          <label htmlFor="certificate-template-upload" className={s.templateUploadLabel}>
                            <Upload size={14} />
                            Обрати файл
                          </label>
                          <button className="btn btn-primary btn-sm" onClick={handleUploadTemplate} disabled={!selectedFile || uploading}>
                            {uploading ? 'Завантаження…' : 'Оновити'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--text-muted)' }}>
                          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                          <span style={{ fontSize: '12px', lineHeight: '16px' }}>
                            Підтримуються PNG і JPG. Пропорції шаблону в прев’ю зберігаються один в один.
                          </span>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </aside>
            </div>

            <div className={s.modalFooter}>
              <div className={s.footerActions}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('actions.close')}
                </button>
                <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? 'Зберігаємо…' : 'Зберегти вигляд'}
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!canCreate}>
                  {saving ? 'Генеруємо…' : 'Згенерувати сертифікати'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
