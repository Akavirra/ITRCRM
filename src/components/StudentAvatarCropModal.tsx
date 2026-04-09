'use client';

import { useEffect, useRef, useState } from 'react';

interface CropOffset {
  x: number;
  y: number;
}

interface StudentAvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  fileName: string;
  title?: string;
  description?: string;
  onCancel: () => void;
  onApply: (croppedDataUrl: string, croppedFile: File | null) => void;
}

const AVATAR_CROP_VIEW_SIZE = 320;
const AVATAR_OUTPUT_SIZE = 512;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getAvatarCropMetrics(
  naturalWidth: number,
  naturalHeight: number,
  zoom: number
) {
  const baseScale = Math.max(
    AVATAR_CROP_VIEW_SIZE / naturalWidth,
    AVATAR_CROP_VIEW_SIZE / naturalHeight
  );
  const scale = baseScale * zoom;
  const displayWidth = naturalWidth * scale;
  const displayHeight = naturalHeight * scale;
  const maxOffsetX = Math.max(0, (displayWidth - AVATAR_CROP_VIEW_SIZE) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - AVATAR_CROP_VIEW_SIZE) / 2);

  return {
    displayWidth,
    displayHeight,
    maxOffsetX,
    maxOffsetY,
  };
}

export default function StudentAvatarCropModal({
  isOpen,
  imageSrc,
  fileName,
  title = 'Обрізати фото учня',
  description = 'Перетягніть фото та налаштуйте масштаб, щоб обрати потрібну область.',
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
    if (!isOpen || !imageSrc) {
      return;
    }

    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);

    const img = new window.Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) {
    return null;
  }

  const metrics = naturalSize.width > 0 && naturalSize.height > 0
    ? getAvatarCropMetrics(naturalSize.width, naturalSize.height, zoom)
    : null;

  const clampOffset = (next: CropOffset): CropOffset => {
    if (!metrics) {
      return next;
    }

    return {
      x: clamp(next.x, -metrics.maxOffsetX, metrics.maxOffsetX),
      y: clamp(next.y, -metrics.maxOffsetY, metrics.maxOffsetY),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!metrics) {
      return;
    }

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
    if (!isDragging || !dragStartRef.current) {
      return;
    }

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setOffset(
      clampOffset({
        x: dragStartRef.current.offsetX + deltaX,
        y: dragStartRef.current.offsetY + deltaY,
      })
    );
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
    if (!metrics || naturalSize.width <= 0 || naturalSize.height <= 0) {
      return;
    }

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
            {title}
          </div>
          <div style={{ marginTop: '0.375rem', fontSize: '0.925rem', color: '#6b7280' }}>
            {description}
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            style={{
              width: `${AVATAR_CROP_VIEW_SIZE}px`,
              height: `${AVATAR_CROP_VIEW_SIZE}px`,
              maxWidth: '100%',
              margin: '0 auto',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(14,165,233,0.08) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.16)',
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            {metrics && (
              <img
                src={imageSrc}
                alt="Обрізка фото"
                draggable={false}
                style={{
                  position: 'absolute',
                  width: `${metrics.displayWidth}px`,
                  height: `${metrics.displayHeight}px`,
                  left: `calc(50% - ${metrics.displayWidth / 2}px + ${offset.x}px)`,
                  top: `calc(50% - ${metrics.displayHeight / 2}px + ${offset.y}px)`,
                  pointerEvents: 'none',
                }}
              />
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                border: '2px solid rgba(255, 255, 255, 0.92)',
                borderRadius: '24px',
                boxShadow: 'inset 0 0 0 9999px rgba(15, 23, 42, 0.24)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: '72%',
                height: '72%',
                transform: 'translate(-50%, -50%)',
                border: '1px dashed rgba(255, 255, 255, 0.92)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }}
            />
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#6b7280', minWidth: '56px' }}>Масштаб</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '0.9rem', color: '#111827', width: '48px', textAlign: 'right' }}>
              {zoom.toFixed(1)}x
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '0 1.5rem 1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isApplying}>
            Скасувати
          </button>
          <button type="button" className="btn btn-primary" onClick={handleApply} disabled={isApplying}>
            {isApplying ? 'Застосування...' : 'Застосувати'}
          </button>
        </div>
      </div>
    </div>
  );
}
