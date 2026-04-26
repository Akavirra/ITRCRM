'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  XCircle,
} from 'lucide-react';
import CompletionCertificatesPanel from '@/components/certificates/CompletionCertificatesPanel';
import CertificateEditorFooterActions from '@/components/certificates/CertificateEditorFooterActions';
import CertificateEditorLoadingNotice from '@/components/certificates/CertificateEditorLoadingNotice';
import CertificateEditorModalShell from '@/components/certificates/CertificateEditorModalShell';
import GiftCertificateCanvas from '@/components/certificates/GiftCertificateCanvas';
import GiftCertificateEditorSidebar from '@/components/certificates/GiftCertificateEditorSidebar';
import GiftCertificatesTable, { type GiftCertificateListItem } from '@/components/certificates/GiftCertificatesTable';

import CertificatesPageShell from '@/components/certificates/CertificatesPageShell';
import CertificatesSectionHeader from '@/components/certificates/CertificatesSectionHeader';
import { useUser } from '@/components/UserContext';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import s from '@/components/certificates/certificates-editor.module.css';

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

interface CertificateListResponse {
  items: CertificateData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

type CertificatesTab = 'gift' | 'completion';

interface GiftCertificatesPanelProps {
}

function GiftCertificatesPanel({}: GiftCertificatesPanelProps = {}) {
  const router = useRouter();
  const pathname = usePathname() ?? '/certificates';
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const { user } = useUser();
  const initialGiftSearch = safeSearchParams.get('gift_search') || '';
  const initialGiftStatus = safeSearchParams.get('gift_status');
  const initialGiftPage = Number.parseInt(safeSearchParams.get('gift_page') || '1', 10);
  const initialGiftArchived = safeSearchParams.get('gift_archived') === '1';
  const normalizedGiftStatus: 'all' | 'unprinted' | 'printed' | CertificateData['status'] =
    initialGiftStatus === 'active'
    || initialGiftStatus === 'used'
    || initialGiftStatus === 'expired'
    || initialGiftStatus === 'canceled'
    || initialGiftStatus === 'printed'
    || initialGiftStatus === 'unprinted'
      ? initialGiftStatus
      : 'all';

  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [listLoading, setListLoading] = useState(true);
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
  const [showArchived, setShowArchived] = useState(initialGiftArchived);
  const [editorBootstrapLoading, setEditorBootstrapLoading] = useState(false);
  const [editorBootstrapReady, setEditorBootstrapReady] = useState(false);
  const [searchInput, setSearchInput] = useState(initialGiftSearch);
  const [searchQuery, setSearchQuery] = useState(initialGiftSearch);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unprinted' | 'printed' | CertificateData['status']>(normalizedGiftStatus);
  const [page, setPage] = useState(Number.isFinite(initialGiftPage) && initialGiftPage > 0 ? initialGiftPage : 1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
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
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  const fetchCertificates = async (targetPage = page) => {
    if (!user || user.role !== 'admin') return;

    setListLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(pagination.limit),
      });

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const effectiveStatusFilter = statusFilter === 'all'
        ? (showArchived ? 'printed' : 'unprinted')
        : statusFilter;

      params.set('status', effectiveStatusFilter);

      const response = await fetch(`/api/admin-app/certificates?${params.toString()}`);
      const data = await response.json() as CertificateListResponse;

      const items = Array.isArray(data.items) ? data.items : [];
      setCertificates((prev) => (targetPage === 1 ? items : [...prev, ...items]));
      setPagination({
        page: typeof data.page === 'number' ? data.page : targetPage,
        limit: typeof data.limit === 'number' ? data.limit : 20,
        total: typeof data.total === 'number' ? data.total : 0,
        totalPages: typeof data.totalPages === 'number' ? data.totalPages : 1,
      });
    } catch (error) {
      console.error('Failed to fetch certificates:', error);
      if (targetPage === 1) setCertificates([]);
      setPagination((prev) => ({ ...prev, page: targetPage, total: 0, totalPages: 1 }));
    } finally {
      setListLoading(false);
    }
  };

  const bootstrapEditor = async (force = false) => {
    if (editorBootstrapReady && !force) return true;

    setEditorBootstrapLoading(true);
    try {
      const [templateRes, settingsRes, nextRes] = await Promise.all([
        fetch('/api/admin-app/certificates/template'),
        fetch('/api/admin-app/certificates/settings'),
        fetch('/api/admin-app/certificates/next-id'),
      ]);

      const templateData = await templateRes.json();
      setTemplateUrl(templateData?.url || null);

      const settingsData = await settingsRes.json();
      if (settingsData && !settingsData.error) {
        setIdSettings((prev) => ({ ...prev, ...settingsData }));
      }

      const nextData = await nextRes.json();
      setNextPublicId(nextData?.nextId || null);
      setEditorBootstrapReady(true);
      return true;
    } catch (error) {
      console.error('Failed to bootstrap certificate editor:', error);
      return false;
    } finally {
      setEditorBootstrapLoading(false);
    }
  };

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
    if (user && user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [router, user]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    setCertificates([]);
    setPage(1);
    fetchCertificates(1);
  }, [searchQuery, showArchived, statusFilter, user]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    if (page === 1) return;
    fetchCertificates(page);
  }, [page, user]);

  useEffect(() => {
    if (!sentinelRef.current || listLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && page < pagination.totalPages) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [listLoading, page, pagination.totalPages]);

  useEffect(() => {
    const currentQuery = safeSearchParams.toString();
    const nextParams = new URLSearchParams(currentQuery);

    if (searchQuery) {
      nextParams.set('gift_search', searchQuery);
    } else {
      nextParams.delete('gift_search');
    }

    if (statusFilter !== 'all') {
      nextParams.set('gift_status', statusFilter);
    } else {
      nextParams.delete('gift_status');
    }

    if (showArchived) {
      nextParams.set('gift_archived', '1');
    } else {
      nextParams.delete('gift_archived');
    }

    if (page > 1) {
      nextParams.set('gift_page', String(page));
    } else {
      nextParams.delete('gift_page');
    }

    const nextQuery = nextParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [page, pathname, router, safeSearchParams, searchQuery, showArchived, statusFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

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

  const handleCreate = async () => {
    setFormData(DEFAULT_FORM_DATA);
    setSelectedFile(null);
    setOpenAccordion('data');
    setSelectedBlock('amount');
    historyRef.current = [];
    setShowModal(true);
    await bootstrapEditor();
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
      setPage(1);
      await fetchCertificates(1);
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
      await fetchCertificates(page);
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
      setDeleteConfirmId(null);
      const nextPage = certificates.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      await fetchCertificates(nextPage);
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

  const getStatusBadge = (certificate: GiftCertificateListItem) => {
    if (certificate.status === 'used') return <span className="badge badge-info">Використано</span>;
    if (certificate.status === 'expired') return <span className="badge badge-gray">Протерміновано</span>;
    if (certificate.status === 'canceled') return <span className="badge badge-danger">Скасовано</span>;
    if (certificate.printed_at) {
      return <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>Надруковано</span>;
    }
    return <span className="badge badge-success">{t('status.active')}</span>;
  };

  if (!user || user.role !== 'admin') return null;

  const filteredCertificates = certificates;

  return (
    <>
      <CertificatesSectionHeader
          title={t('nav.certificates')}
          controls={(
            <>
              <input
                type="search"
                className="form-input"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Пошук по ID"
                style={{ maxWidth: '220px' }}
              />
              <select
                className="form-select"
                value={statusFilter}
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value as typeof statusFilter);
                }}
                style={{ maxWidth: '200px' }}
              >
                <option value="all">Усі статуси</option>
                <option value="active">Активні</option>
                <option value="used">Використані</option>
                <option value="canceled">Скасовані</option>
                <option value="expired">Протерміновані</option>
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
                <button
                  type="button"
                  onClick={() => setShowArchived(false)}
                  style={{
                    padding: '6px 16px',
                    fontSize: '13px',
                    fontWeight: !showArchived ? 600 : 400,
                    color: !showArchived ? 'var(--primary)' : 'var(--gray-500)',
                    background: !showArchived ? 'var(--primary-light)' : 'white',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 150ms ease-out, color 150ms ease-out',
                  }}
                >
                  Активні
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchived(true)}
                  style={{
                    padding: '6px 16px',
                    fontSize: '13px',
                    fontWeight: showArchived ? 600 : 400,
                    color: showArchived ? 'var(--primary)' : 'var(--gray-500)',
                    background: showArchived ? 'var(--primary-light)' : 'white',
                    border: 'none',
                    borderLeft: '1px solid var(--gray-200)',
                    cursor: 'pointer',
                    transition: 'background-color 150ms ease-out, color 150ms ease-out',
                  }}
                >
                  Архів
                </button>
              </div>
            </>
          )}
          actionLabel={t('actions.add')}
          onAction={handleCreate}
        />

        <div className="table-container">
          <GiftCertificatesTable
            certificates={filteredCertificates}
            loading={listLoading}
            showArchived={showArchived}
            getStatusBadge={getStatusBadge}
            formatIssuedAt={formatDateKyiv}
            onTogglePrinted={handlePrintToggle}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onCreate={handleCreate}
            emptyTitle={showArchived ? 'Архів порожній' : t('emptyStates.noCertificates')}
            emptyDescription={showArchived ? 'Надруковані сертифікати з’являться тут.' : t('emptyStates.noCertificatesHint')}
          />
        </div>
        {listLoading && certificates.length > 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--gray-500)', fontSize: '13px' }}>
            Завантажуємо ще…
          </div>
        )}
        <div ref={sentinelRef} style={{ height: '1px' }} />

      {deleteConfirmId !== null && createPortal(
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
        </div>,
        document.body
      )}

      <CertificateEditorModalShell
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        shellClassName={s.modalShell}
        headerClassName={s.modalHeader}
        headerMainClassName={s.modalHeaderMain}
        headerBackClassName={s.headerBack}
        headerTitleStackClassName={s.headerTitleStack}
        headerActionsClassName={s.headerActions}
        closeButtonClassName={s.modalClose}
        bodyClassName={s.modalBody}
        footerClassName={s.modalFooter}
        headerContent={(
          <>
            <div className={s.headerTitleRow}>
              <h3 className={s.modalTitle}>Сертифікат на навчання</h3>
              <span className={s.headerDivider}>•</span>
              <span className={s.headerStudent}>{activeBlock.preview}</span>
            </div>
            <p className={s.modalSubtitle}>
              Одне вікно для генерації, шаблону й точного керування двома блоками: сумою та ID.
            </p>
          </>
        )}
        bodyNotice={editorBootstrapLoading ? (
          <CertificateEditorLoadingNotice description="Підтягуємо шаблон, налаштування і наступний ID сертифіката." />
        ) : undefined}
        footer={(
          <CertificateEditorFooterActions
            className={s.footerActions}
            onClose={() => setShowModal(false)}
            onSaveSettings={handleSaveSettings}
            onPrimaryAction={handleSave}
            settingsDisabled={savingSettings || editorBootstrapLoading}
            primaryDisabled={!canCreate || editorBootstrapLoading}
            savingSettings={savingSettings}
            primaryLoading={saving}
            primaryLabel="Згенерувати сертифікати"
            primaryLoadingLabel="Генеруємо…"
          />
        )}
      >
              <GiftCertificateCanvas
                templateUrl={templateUrl}
                viewportRef={viewportRef}
                previewRef={previewRef}
                imageDimensions={imageDimensions}
                setImageDimensions={setImageDimensions}
                pan={pan}
                scale={scale}
                dragging={dragging}
                isPanning={isPanning}
                handleMouseMove={handleMouseMove}
                handleMouseUp={handleMouseUp}
                handleCanvasMouseDown={handleCanvasMouseDown}
                selectedBlock={selectedBlock}
                setSelectedBlock={setSelectedBlock}
                setOpenAccordion={setOpenAccordion}
                pushHistory={pushHistory}
                setDragging={setDragging}
                idSettings={idSettings}
                updateSettings={updateSettings}
                nextPublicId={nextPublicId}
                amountValue={formData.amount}
                panBounds={panBounds}
                setPan={setPan}
                canUndo={canUndo}
                undoLastChange={undoLastChange}
                adjustScale={adjustScale}
                resetViewport={resetViewport}
              />

              <GiftCertificateEditorSidebar
                openAccordion={openAccordion}
                toggleAccordion={toggleAccordion}
                formData={formData}
                totalAmount={totalAmount}
                presetAmounts={presetAmounts}
                isCustomAmount={isCustomAmount}
                updateFormData={updateFormData}
                activeBlock={activeBlock}
                idSettings={idSettings}
                selectedBlock={selectedBlock ?? activeBlock.key}
                setSelectedBlock={setSelectedBlock}
                updateSettings={updateSettings}
                setSelectedFile={setSelectedFile}
                selectedTemplateName={selectedTemplateName}
                handleUploadTemplate={handleUploadTemplate}
                selectedFile={selectedFile}
                uploading={uploading}
              />
      </CertificateEditorModalShell>
    </>
  );
}

export default function CertificatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const activeTab: CertificatesTab = safeSearchParams.get('tab') === 'completion' ? 'completion' : 'gift';

  const handleTabChange = (tab: CertificatesTab) => {
    router.push(tab === 'gift' ? '/certificates' : '/certificates?tab=completion');
  };

  return (
    <CertificatesPageShell activeTab={activeTab} onTabChange={handleTabChange}>
      {activeTab === 'completion' ? <CompletionCertificatesPanel /> : <GiftCertificatesPanel />}
    </CertificatesPageShell>
  );
}
