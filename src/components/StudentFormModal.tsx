'use client';

import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n/t';

interface Student {
  id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  parent_name: string | null;
  notes: string | null;
  birth_date: string | null;
  photo: string | null;
  school: string | null;
  discount: number | null;
  parent_relation: string | null;
  parent_phone?: string | null;
  parent2_name?: string | null;
  parent2_phone?: string | null;
  parent2_relation?: string | null;
  interested_courses?: string | null;
  source?: string | null;
}

interface StudentFormData {
  first_name: string;
  last_name: string;
  birth_date: string;
  email: string;
  school: string;
  discount: string;
  photo: string | null;
  photoFile: File | null;
  phone: string;
  parent_name: string;
  parent_relation: string;
  parent_relation_other: string;
  parent_phone: string;
  parent2_name: string;
  parent2_phone: string;
  parent2_relation: string;
  parent2_relation_other: string;
  notes: string;
  interested_courses: string[];
  source: string;
  source_other: string;
}

interface AutocompleteStudent {
  id: number;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
}

interface Course {
  id: number;
  title: string;
  public_id: string;
}

interface CropOffset {
  x: number;
  y: number;
}

interface StudentAvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  fileName: string;
  onCancel: () => void;
  onApply: (croppedDataUrl: string, croppedFile: File | null) => void;
}

const RELATION_OPTIONS = [
  { value: 'mother', label: t('forms.relationMother') },
  { value: 'father', label: t('forms.relationFather') },
  { value: 'grandmother', label: t('forms.relationGrandmother') },
  { value: 'grandfather', label: t('forms.relationGrandfather') },
  { value: 'other', label: t('forms.relationOther') },
];

const SOURCE_OPTIONS = [
  { value: 'social', label: t('forms.sourceSocial') },
  { value: 'friends', label: t('forms.sourceFriends') },
  { value: 'search', label: t('forms.sourceSearch') },
  { value: 'other', label: t('forms.sourceOther') },
];

const AVATAR_CROP_VIEW_SIZE = 320;
const AVATAR_OUTPUT_SIZE = 512;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getAvatarCropMetrics(naturalWidth: number, naturalHeight: number, zoom: number) {
  const baseScale = Math.max(
    AVATAR_CROP_VIEW_SIZE / naturalWidth,
    AVATAR_CROP_VIEW_SIZE / naturalHeight
  );
  const scale = baseScale * zoom;
  const displayWidth = naturalWidth * scale;
  const displayHeight = naturalHeight * scale;
  const maxOffsetX = Math.max(0, (displayWidth - AVATAR_CROP_VIEW_SIZE) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - AVATAR_CROP_VIEW_SIZE) / 2);

  return { displayWidth, displayHeight, maxOffsetX, maxOffsetY };
}

function formatPhoneNumber(value: string): string {
  if (value === '') return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  return digits.slice(-9);
}

function StudentAvatarCropModal({
  isOpen,
  imageSrc,
  fileName,
  onCancel,
  onApply,
}: StudentAvatarCropModalProps) {
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);

    const img = new window.Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const metrics = naturalSize.width > 0 && naturalSize.height > 0
    ? getAvatarCropMetrics(naturalSize.width, naturalSize.height, zoom)
    : null;

  const clampOffset = (next: CropOffset): CropOffset => {
    if (!metrics) return next;
    return {
      x: clamp(next.x, -metrics.maxOffsetX, metrics.maxOffsetX),
      y: clamp(next.y, -metrics.maxOffsetY, metrics.maxOffsetY),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!metrics) return;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setOffset(clampOffset({
      x: dragStartRef.current.offsetX + deltaX,
      y: dragStartRef.current.offsetY + deltaY,
    }));
  };

  const stopDragging = () => {
    dragStartRef.current = null;
    setIsDragging(false);
  };

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom);
    if (naturalSize.width > 0 && naturalSize.height > 0) {
      const nextMetrics = getAvatarCropMetrics(naturalSize.width, naturalSize.height, nextZoom);
      setOffset((current) => ({
        x: clamp(current.x, -nextMetrics.maxOffsetX, nextMetrics.maxOffsetX),
        y: clamp(current.y, -nextMetrics.maxOffsetY, nextMetrics.maxOffsetY),
      }));
    }
  };

  const handleApply = async () => {
    if (!metrics || naturalSize.width <= 0 || naturalSize.height <= 0) return;

    setIsApplying(true);
    try {
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Не вдалося завантажити фото для обрізки'));
        img.src = imageSrc;
      });

      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_OUTPUT_SIZE;
      canvas.height = AVATAR_OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Не вдалося підготувати обрізане фото');
      }

      const left = AVATAR_CROP_VIEW_SIZE / 2 - metrics.displayWidth / 2 + offset.x;
      const top = AVATAR_CROP_VIEW_SIZE / 2 - metrics.displayHeight / 2 + offset.y;
      const sx = ((0 - left) / metrics.displayWidth) * naturalSize.width;
      const sy = ((0 - top) / metrics.displayHeight) * naturalSize.height;
      const sw = (AVATAR_CROP_VIEW_SIZE / metrics.displayWidth) * naturalSize.width;
      const sh = (AVATAR_CROP_VIEW_SIZE / metrics.displayHeight) * naturalSize.height;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const croppedBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92)
      );
      const safeBaseName = (fileName || 'student-avatar').replace(/\.[^.]+$/, '');
      const croppedFile = croppedBlob
        ? new File([croppedBlob], `${safeBaseName}-avatar.jpg`, { type: 'image/jpeg' })
        : null;

      onApply(croppedDataUrl, croppedFile);
    } catch (error) {
      console.error('Failed to crop student avatar:', error);
      alert('Не вдалося обрізати фото. Спробуйте ще раз.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.68)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10050,
        padding: '1.5rem',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92vw, 540px)',
          backgroundColor: '#fff',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1.25rem 1.5rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
            Обрізати фото учня
          </div>
          <div style={{ marginTop: '0.375rem', fontSize: '0.925rem', color: '#6b7280' }}>
            Перетягніть фото та налаштуйте масштаб, щоб обрати потрібну область.
          </div>
        </div>
      </div>
    </div>
  );
}

