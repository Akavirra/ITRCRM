'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderOpen, FileText, Image, Video, Music, File,
  Download, ExternalLink, Search, Trash2, LayoutGrid,
  LayoutList, ChevronLeft, ChevronRight, MoreVertical,
  Camera, CalendarDays, Play,
} from 'lucide-react';
import DraggableModal from '@/components/DraggableModal';
import Layout from '@/components/Layout';
import PageLoading from '@/components/PageLoading';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

// ── Kebab Menu ────────────────────────────────────────────────────────────────

interface KebabItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}

function KebabMenu({ items, counter }: { items: KebabItem[]; counter?: string }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.closest('[data-kebab]')?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const scrollHandler = () => setOpen(false);
    document.addEventListener('mousedown', handler);
    document.addEventListener('scroll', scrollHandler, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('scroll', scrollHandler, true);
    };
  }, [open]);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpen(o => !o);
  }

  return (
    <div data-kebab="" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {counter && (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{counter}</span>
      )}
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', background: open ? '#e2e8f0' : 'transparent', color: '#64748b', cursor: 'pointer', flexShrink: 0 }}
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)', minWidth: 200, zIndex: 9000, overflow: 'hidden' }}
        >
          {items.map((item, i) => (
            item.href ? (
              <a
                key={i}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', textDecoration: 'none', color: item.danger ? '#ef4444' : '#1e293b', fontSize: 13, fontWeight: 500, borderBottom: i < items.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                onMouseEnter={e => { e.currentTarget.style.background = item.danger ? '#fff5f5' : '#f8fafc'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {item.icon} {item.label}
              </a>
            ) : (
              <button
                key={i}
                onClick={() => { setOpen(false); item.onClick?.(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: item.danger ? '#ef4444' : '#1e293b', fontSize: 13, fontWeight: 500, textAlign: 'left', borderBottom: i < items.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                onMouseEnter={e => { e.currentTarget.style.background = item.danger ? '#fff5f5' : '#f8fafc'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {item.icon} {item.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}

interface Topic {
  id: number;
  thread_id: string;
  name: string;
  file_count: number;
}

interface MediaFile {
  id: number;
  topic_id: number;
  topic_name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  drive_file_id: string;
  drive_view_url: string;
  drive_download_url: string;
  uploaded_by_name: string | null;
  created_at: string;
  media_width: number | null;
  media_height: number | null;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'photo' | 'video' | 'document' | 'audio';

function thumbUrl(fileId: string, size = 400) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp|svg|avif|tiff?)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|m4v|3gp|wmv|flv|ts)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|flac|aac|m4a|wma|opus|oga)$/i;

function isPreviewable(type: string, fileName?: string) {
  if (['photo', 'animation', 'video', 'audio', 'voice'].includes(type)) return true;
  if (type === 'document' && fileName) {
    if (IMAGE_EXTENSIONS.test(fileName)) return true;
    if (VIDEO_EXTENSIONS.test(fileName)) return true;
    if (AUDIO_EXTENSIONS.test(fileName)) return true;
  }
  return false;
}

function isAudioType(type: string, fileName?: string) {
  if (type === 'audio' || type === 'voice') return true;
  if (type === 'document' && fileName && AUDIO_EXTENSIONS.test(fileName)) return true;
  return false;
}

function FileTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const s = { width: size, height: size, flexShrink: 0 };
  if (type === 'photo' || type === 'animation') return <Image style={s} color="#3b82f6" />;
  if (type === 'video') return <Video style={s} color="#8b5cf6" />;
  if (type === 'audio' || type === 'voice') return <Music style={s} color="#f59e0b" />;
  if (type === 'document') return <FileText style={s} color="#64748b" />;
  return <File style={s} color="#64748b" />;
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    photo:     { label: 'Фото',      bg: '#eff6ff', color: '#3b82f6' },
    animation: { label: 'GIF',       bg: '#eff6ff', color: '#3b82f6' },
    video:     { label: 'Відео',     bg: '#f5f3ff', color: '#8b5cf6' },
    document:  { label: 'Документ',  bg: '#f8fafc', color: '#64748b' },
    audio:     { label: 'Аудіо',     bg: '#fffbeb', color: '#f59e0b' },
    voice:     { label: 'Голосове',  bg: '#fffbeb', color: '#f59e0b' },
  };
  const s = map[type] ?? { label: type, bg: '#f8fafc', color: '#64748b' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Media Viewer Modal ────────────────────────────────────────────────────────

const HEADER_H = 52; // DraggableModal header height px

function calcMediaSize(
  mediaW: number | null | undefined,
  mediaH: number | null | undefined,
  type: 'image' | 'video' | 'audio',
): { width: number; height: number } {
  if (type === 'audio') return { width: 420, height: HEADER_H + 88 };

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (mediaW && mediaH) {
    const maxW = Math.min(vw * 0.88, type === 'video' ? 1280 : 1400);
    const maxContentH = Math.min(vh * 0.88, 900) - HEADER_H;
    const scale = Math.min(maxW / mediaW, maxContentH / mediaH, 1);
    const w = Math.max(Math.round(mediaW * scale), 320);
    const h = Math.round(mediaH * scale) + HEADER_H;
    return { width: w, height: h };
  }

  if (type === 'video') {
    const w = Math.round(Math.min(vw * 0.82, 960));
    const h = Math.min(Math.round(w * 9 / 16) + HEADER_H, vh * 0.9);
    return { width: w, height: h };
  }
  return { width: 760, height: 520 };
}

function MediaViewerModal({ files, index, onClose, onPrev, onNext }: {
  files: MediaFile[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const file = files[index];
  const isVideo = file.file_type === 'video' || VIDEO_EXTENSIONS.test(file.file_name ?? '');
  const isAudio = isAudioType(file.file_type, file.file_name);
  const mediaType = isAudio ? 'audio' : isVideo ? 'video' : 'image';
  const hasNav = files.length > 1;

  const [modalSize, setModalSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window === 'undefined') return { width: 760, height: 520 };
    return calcMediaSize(file.media_width, file.media_height, mediaType);
  });

  // Recalculate when switching files
  useEffect(() => {
    setModalSize(calcMediaSize(file.media_width, file.media_height, mediaType));
  }, [file.id, mediaType, file.media_width, file.media_height]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  // Fallback: recalculate from actual image element if DB dimensions missing
  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (file.media_width && file.media_height) return;
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    setModalSize(calcMediaSize(img.naturalWidth, img.naturalHeight, 'image'));
  }

  const headerAction = (
    <KebabMenu
      counter={hasNav ? `${index + 1} / ${files.length}` : undefined}
      items={[
        { label: 'Завантажити', icon: <Download size={14} />, href: file.drive_download_url },
        { label: 'Відкрити в Google Drive', icon: <ExternalLink size={14} />, href: file.drive_view_url },
      ]}
    />
  );

  return (
    <DraggableModal
      id="media-viewer"
      isOpen
      onClose={onClose}
      title={file.file_name}
      initialWidth={modalSize.width}
      initialHeight={modalSize.height}
      minWidth={320}
      minHeight={240}
      headerAction={headerAction}
      contentStyle={{ padding: 0, background: isAudio ? '#f8fafc' : '#0f172a', overflow: 'hidden', position: 'relative' }}
    >
      <style>{`@keyframes mediaFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Prev arrow — hidden for audio */}
        {!isAudio && hasNav && index > 0 && (
          <button onClick={onPrev}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Content */}
        {isAudio || isVideo ? (
          <iframe
            key={file.drive_file_id}
            src={`https://drive.google.com/file/d/${file.drive_file_id}/preview`}
            allow="autoplay"
            style={{ ...(isAudio ? { width: '100%', height: '100%' } : { position: 'absolute', inset: 0, width: '100%', height: '100%' }), border: 'none', animation: 'mediaFadeIn 0.2s ease' }}
          />
        ) : (
          <img
            key={file.drive_file_id}
            src={thumbUrl(file.drive_file_id, 1600)}
            alt={file.file_name}
            onLoad={handleImageLoad}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', animation: 'mediaFadeIn 0.2s ease' }}
          />
        )}

        {/* Next arrow — hidden for audio */}
        {!isAudio && hasNav && index < files.length - 1 && (
          <button onClick={onNext}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </DraggableModal>
  );
}

// ── Google Photos Tab ─────────────────────────────────────────────────────────

interface PhotosMediaItem {
  id: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: {
    creationTime: string;
    width?: string;
    height?: string;
    video?: object;
  };
  filename: string;
}

function PhotoViewerModal({ items, index, onClose, onPrev, onNext }: {
  items: PhotosMediaItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const item = items[index];
  const hasNav = items.length > 1;
  const w = item.mediaMetadata.width ? parseInt(item.mediaMetadata.width) : null;
  const h = item.mediaMetadata.height ? parseInt(item.mediaMetadata.height) : null;
  const size = calcMediaSize(w, h, 'image');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (w && h) return;
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      // size already calculated, just update if needed
    }
  }

  const headerAction = (
    <KebabMenu
      counter={hasNav ? `${index + 1} / ${items.length}` : undefined}
      items={[
        { label: 'Відкрити в Google Фото', icon: <ExternalLink size={14} />, href: item.productUrl },
      ]}
    />
  );

  return (
    <DraggableModal
      id="photo-viewer"
      isOpen
      onClose={onClose}
      title={item.filename}
      initialWidth={size.width}
      initialHeight={size.height}
      minWidth={320}
      minHeight={240}
      headerAction={headerAction}
      contentStyle={{ padding: 0, background: '#0f172a', overflow: 'hidden', position: 'relative' }}
    >
      <style>{`@keyframes mediaFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hasNav && index > 0 && (
          <button onClick={onPrev} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <ChevronLeft size={22} />
          </button>
        )}
        <img
          key={item.id}
          src={item.baseUrl + '=w1920'}
          alt={item.filename}
          onLoad={handleLoad}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', animation: 'mediaFadeIn 0.2s ease' }}
        />
        {hasNav && index < items.length - 1 && (
          <button onClick={onNext} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </DraggableModal>
  );
}

function GooglePhotosTab() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [photos, setPhotos] = useState<PhotosMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [noAccess, setNoAccess] = useState(false);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  // Only images can be opened in viewer (videos → Google Photos)
  const viewablePhotos = photos.filter(p => !p.mimeType.startsWith('video/'));

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    setNoAccess(false);
    fetch(`/api/photos/media?date=${date}`)
      .then(r => r.json())
      .then(data => {
        if (data.error === 'no_photos_access') {
          setNoAccess(true);
          setPhotos([]);
        } else {
          setPhotos(data.items ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [date]);

  function shiftDay(delta: number) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().split('T')[0];
    if (next <= todayStr) setDate(next);
  }

  function formatDateUk(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  return (
    <div>
      {viewerIdx !== null && (
        <PhotoViewerModal
          items={viewablePhotos}
          index={viewerIdx}
          onClose={() => setViewerIdx(null)}
          onPrev={() => setViewerIdx(i => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setViewerIdx(i => (i !== null && i < viewablePhotos.length - 1 ? i + 1 : i))}
        />
      )}

      {/* Date controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => shiftDay(-1)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#374151' }}
        >
          <ChevronLeft size={17} />
        </button>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <CalendarDays size={15} style={{ position: 'absolute', left: 10, color: '#94a3b8', pointerEvents: 'none' }} />
          <input
            type="date"
            value={date}
            max={todayStr}
            onChange={e => e.target.value && setDate(e.target.value)}
            style={{ paddingLeft: 32, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 9, border: '1px solid #e5e7eb', fontSize: 13, background: '#fff', color: '#1e293b', outline: 'none', cursor: 'pointer' }}
          />
        </div>

        <button
          onClick={() => shiftDay(1)}
          disabled={date >= todayStr}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', cursor: date >= todayStr ? 'default' : 'pointer', color: date >= todayStr ? '#cbd5e1' : '#374151' }}
        >
          <ChevronRight size={17} />
        </button>

        <button
          onClick={() => setDate(todayStr)}
          style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500 }}
        >
          Сьогодні
        </button>

        {!loading && photos.length > 0 && (
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {photos.length} медіафайл{photos.length === 1 ? '' : photos.length < 5 ? 'и' : 'ів'} за {formatDateUk(date)}
          </span>
        )}
      </div>

      {/* Content */}
      {noAccess ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
          <Camera size={44} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.25 }} />
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Потрібна авторизація Google Фото</div>
          <div style={{ fontSize: 13, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
            Запусти скрипт для оновлення токену:<br />
            <code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>node scripts/authorize-google.js</code>
          </div>
        </div>
      ) : loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{ borderRadius: 14, background: '#f1f5f9', aspectRatio: '1', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
          <Camera size={44} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.25 }} />
          <div style={{ fontSize: 15, fontWeight: 500 }}>Немає фото за {formatDateUk(date)}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
          {photos.map(item => {
            const isVideo = item.mimeType.startsWith('video/');
            const viewIdx = viewablePhotos.findIndex(p => p.id === item.id);
            return (
              <PhotoCard
                key={item.id}
                item={item}
                isVideo={isVideo}
                onClick={() => isVideo ? window.open(item.productUrl, '_blank') : setViewerIdx(viewIdx)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PhotoCard({ item, isVideo, onClick }: {
  item: PhotosMediaItem;
  isVideo: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const date = new Date(item.mediaMetadata.creationTime);
  const dateStr = date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{ borderRadius: 14, background: '#fff', border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.04)', transition: 'all 0.2s', cursor: 'pointer', position: 'relative' }}
    >
      <div style={{ aspectRatio: '1', overflow: 'hidden', background: '#f8fafc', position: 'relative' }}>
        <img
          src={item.baseUrl + '=w400-h400-c'}
          alt={item.filename}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        {isVideo && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={16} color="#8b5cf6" style={{ marginLeft: 2 }} />
            </div>
          </div>
        )}
        {hovered && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isVideo ? <Play size={18} color="#8b5cf6" style={{ marginLeft: 2 }} /> : <Image size={18} color="#3b82f6" />}
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{dateStr}</div>
        {isVideo && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: '#f5f3ff', color: '#8b5cf6', marginTop: 4, display: 'inline-block' }}>
            Відео
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MaterialsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [loading, setLoading] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'photos'>('files');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then(res => {
      if (!res.ok) { router.push('/login'); return null; }
      return res.json();
    }).then(data => {
      if (data) setUser(data.user);
      setAuthLoading(false);
    });
  }, [router]);

  const loadTopics = useCallback(async () => {
    const res = await fetch('/api/media/topics');
    if (res.ok) setTopics(await res.json());
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedTopicId) params.set('topic_id', String(selectedTopicId));
    if (search) params.set('search', search);
    const res = await fetch(`/api/media/files?${params}`);
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files);
    }
    setLoading(false);
  }, [selectedTopicId, search]);

  useEffect(() => { loadTopics(); }, [loadTopics]);
  useEffect(() => { loadFiles(); }, [loadFiles]);

  // Debounce search
  function handleSearchInput(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 400);
  }

  async function renameTopic(id: number, name: string) {
    await fetch('/api/media/topics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
    setEditingTopicId(null);
    loadTopics();
    loadFiles();
  }

  async function deleteFile(id: number) {
    if (!confirm('Видалити файл? Він буде видалений з Google Drive.')) return;
    setDeletingId(id);
    await fetch(`/api/media/files/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    loadFiles();
    loadTopics();
  }

  const selectedTopic = topics.find(t => t.id === selectedTopicId);
  const totalFiles = topics.reduce((s, t) => s + t.file_count, 0);

  // Resolve effective category based on file_type + filename extension
  function effectiveCategory(f: MediaFile): FilterType {
    if (f.file_type === 'photo' || f.file_type === 'animation') return 'photo';
    if (f.file_type === 'video') return 'video';
    if (f.file_type === 'audio' || f.file_type === 'voice') return 'audio';
    if (f.file_type === 'document') {
      if (IMAGE_EXTENSIONS.test(f.file_name)) return 'photo';
      if (VIDEO_EXTENSIONS.test(f.file_name)) return 'video';
      if (AUDIO_EXTENSIONS.test(f.file_name)) return 'audio';
    }
    return 'document';
  }

  // Filter by type
  const filteredFiles = files.filter(f =>
    filterType === 'all' || effectiveCategory(f) === filterType
  );

  // Visual files for lightbox
  const visualFiles = filteredFiles.filter(f => isPreviewable(f.file_type, f.file_name));

  function openLightbox(file: MediaFile) {
    const idx = visualFiles.findIndex(f => f.id === file.id);
    if (idx !== -1) setLightboxIndex(idx);
  }

  const filterTabs: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'all',      label: 'Всі',        icon: <File size={14} /> },
    { key: 'photo',    label: 'Фото',       icon: <Image size={14} /> },
    { key: 'video',    label: 'Відео',      icon: <Video size={14} /> },
    { key: 'document', label: 'Документи',  icon: <FileText size={14} /> },
    { key: 'audio',    label: 'Аудіо',      icon: <Music size={14} /> },
  ];

  if (authLoading || !user) return (
    <Layout user={{ id: 0, name: '', email: '', role: 'admin' }}>
      <PageLoading />
    </Layout>
  );

  return (
    <Layout user={user}>
    <div>
      {/* Media Viewer */}
      {lightboxIndex !== null && (
        <MediaViewerModal
          files={visualFiles}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLightboxIndex(i => (i !== null && i < visualFiles.length - 1 ? i + 1 : i))}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <FolderOpen size={26} color="#3b82f6" />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Файли</h1>
        <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 4 }}>{totalFiles} файлів</span>
        <div style={{ flex: 1 }} />
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, background: '#f8fafc', borderRadius: 10, padding: 4 }}>
          <button
            onClick={() => setActiveTab('files')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === 'files' ? 600 : 400, background: activeTab === 'files' ? '#fff' : 'transparent', color: activeTab === 'files' ? '#1e293b' : '#64748b', boxShadow: activeTab === 'files' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}
          >
            <FolderOpen size={14} /> Файли
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === 'photos' ? 600 : 400, background: activeTab === 'photos' ? '#fff' : 'transparent', color: activeTab === 'photos' ? '#1e293b' : '#64748b', boxShadow: activeTab === 'photos' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}
          >
            <Camera size={14} /> Google Фото
          </button>
        </div>
      </div>

      {activeTab === 'photos' && <GooglePhotosTab />}

      {activeTab === 'files' && <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Topics sidebar */}
        <div style={{ width: 210, flexShrink: 0, background: '#fff', borderRadius: 16, border: '1px solid #f0f0f0', padding: '10px 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', padding: '4px 12px 8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Теми
          </div>

          <button
            onClick={() => setSelectedTopicId(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', background: selectedTopicId === null ? '#e3f2fd' : 'transparent', color: selectedTopicId === null ? '#1565c0' : '#374151', fontWeight: selectedTopicId === null ? 600 : 400, fontSize: 13 }}
          >
            <FolderOpen size={15} />
            Всі файли
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{totalFiles}</span>
          </button>

          {topics.map(topic => (
            <div key={topic.id}>
              {editingTopicId === topic.id ? (
                <form onSubmit={e => { e.preventDefault(); renameTopic(topic.id, editingName); }} style={{ padding: '4px 8px' }}>
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={() => setEditingTopicId(null)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #3b82f6', fontSize: 13, outline: 'none' }}
                  />
                </form>
              ) : (
                <button
                  onClick={() => setSelectedTopicId(topic.id)}
                  onDoubleClick={() => { setEditingTopicId(topic.id); setEditingName(topic.name); }}
                  title="Двічі клікніть, щоб перейменувати"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', background: selectedTopicId === topic.id ? '#e3f2fd' : 'transparent', color: selectedTopicId === topic.id ? '#1565c0' : '#374151', fontWeight: selectedTopicId === topic.id ? 600 : 400, fontSize: 13 }}
                >
                  <FolderOpen size={15} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic.name}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, background: '#f1f5f9', padding: '1px 6px', borderRadius: 10 }}>{topic.file_count}</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Main area */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {/* Title */}
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginRight: 4 }}>
              {selectedTopic ? selectedTopic.name : 'Всі файли'}
            </span>

            {/* Type filter tabs */}
            <div style={{ display: 'flex', gap: 4, background: '#f8fafc', borderRadius: 10, padding: 4 }}>
              {filterTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilterType(tab.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: filterType === tab.key ? 600 : 400, background: filterType === tab.key ? '#fff' : 'transparent', color: filterType === tab.key ? '#1e293b' : '#64748b', boxShadow: filterType === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                placeholder="Пошук..."
                value={searchInput}
                onChange={e => handleSearchInput(e.target.value)}
                style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', width: 180 }}
              />
            </div>

            {/* View toggle */}
            <div style={{ display: 'flex', background: '#f8fafc', borderRadius: 10, padding: 3, gap: 2 }}>
              <button onClick={() => setViewMode('grid')} style={{ padding: '5px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', background: viewMode === 'grid' ? '#fff' : 'transparent', color: viewMode === 'grid' ? '#1e293b' : '#94a3b8', boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                <LayoutGrid size={16} />
              </button>
              <button onClick={() => setViewMode('list')} style={{ padding: '5px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', background: viewMode === 'list' ? '#fff' : 'transparent', color: viewMode === 'list' ? '#1e293b' : '#94a3b8', boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                <LayoutList size={16} />
              </button>
            </div>
          </div>

          {/* Count */}
          {!loading && filteredFiles.length > 0 && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
              {filteredFiles.length} файл{filteredFiles.length === 1 ? '' : filteredFiles.length < 5 ? 'и' : 'ів'}
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ borderRadius: 12, background: '#f1f5f9', aspectRatio: '1', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : filteredFiles.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
              <FolderOpen size={44} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.25 }} />
              <div style={{ fontSize: 15, fontWeight: 500 }}>Файлів немає</div>
              {search && <div style={{ fontSize: 13, marginTop: 4 }}>Спробуй змінити пошуковий запит</div>}
            </div>
          ) : viewMode === 'grid' ? (
            <GridView files={filteredFiles} selectedTopicId={selectedTopicId} onOpenLightbox={openLightbox} onDelete={deleteFile} deletingId={deletingId} />
          ) : (
            <ListView files={filteredFiles} selectedTopicId={selectedTopicId} onOpenLightbox={openLightbox} onDelete={deleteFile} deletingId={deletingId} />
          )}
        </div>
      </div>}
    </div>
    </Layout>
  );
}

// ── Grid View ─────────────────────────────────────────────────────────────────

function GridView({ files, selectedTopicId, onOpenLightbox, onDelete, deletingId }: {
  files: MediaFile[];
  selectedTopicId: number | null;
  onOpenLightbox: (f: MediaFile) => void;
  onDelete: (id: number) => void;
  deletingId: number | null;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
      {files.map(file => (
        <GridCard key={file.id} file={file} selectedTopicId={selectedTopicId} onOpenLightbox={onOpenLightbox} onDelete={onDelete} deletingId={deletingId} />
      ))}
    </div>
  );
}

function GridCard({ file, selectedTopicId, onOpenLightbox, onDelete, deletingId }: {
  file: MediaFile;
  selectedTopicId: number | null;
  onOpenLightbox: (f: MediaFile) => void;
  onDelete: (id: number) => void;
  deletingId: number | null;
}) {
  const [hovered, setHovered] = useState(false);
  const visual = isPreviewable(file.file_type, file.file_name);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderRadius: 14, background: '#fff', border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.04)', transition: 'all 0.2s', cursor: visual ? 'pointer' : 'default', position: 'relative' }}
    >
      {/* Thumbnail or icon */}
      <div
        onClick={() => visual && onOpenLightbox(file)}
        style={{ aspectRatio: '1', overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
      >
        {visual ? (
          <>
            {isAudioType(file.file_type, file.file_name) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Music size={26} color="#f59e0b" />
                </div>
                <TypeBadge type={file.file_type} />
              </div>
            ) : (
              <>
                <img
                  src={thumbUrl(file.drive_file_id)}
                  alt={file.file_name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {file.file_type === 'video' && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Video size={18} color="#8b5cf6" />
                    </div>
                  </div>
                )}
              </>
            )}
            {hovered && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isAudioType(file.file_type, file.file_name)
                    ? <Music size={18} color="#f59e0b" />
                    : <ExternalLink size={18} color="#3b82f6" />}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16 }}>
            <FileTypeIcon type={file.file_type} size={36} />
            <TypeBadge type={file.file_type} />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }} title={file.file_name}>
          {file.file_name}
        </div>
        {!selectedTopicId && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.topic_name}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          {new Date(file.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          {file.file_size > 0 && ` · ${formatSize(file.file_size)}`}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <KebabMenu items={[
            { label: 'Відкрити в Google Drive', icon: <ExternalLink size={14} />, href: file.drive_view_url },
            { label: 'Завантажити', icon: <Download size={14} />, href: file.drive_download_url },
            { label: 'Видалити', icon: <Trash2 size={14} />, onClick: () => onDelete(file.id), danger: true },
          ]} />
        </div>
      </div>
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────

function ListView({ files, selectedTopicId, onOpenLightbox, onDelete, deletingId }: {
  files: MediaFile[];
  selectedTopicId: number | null;
  onOpenLightbox: (f: MediaFile) => void;
  onDelete: (id: number) => void;
  deletingId: number | null;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {files.map((file, i) => {
        const visual = isPreviewable(file.file_type, file.file_name);
        return (
          <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < files.length - 1 ? '1px solid #f8f9fa' : 'none' }}>
            {/* Thumb or icon */}
            <div
              onClick={() => visual && onOpenLightbox(file)}
              style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', background: '#f8fafc', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: visual ? 'pointer' : 'default', position: 'relative' }}
            >
              {isAudioType(file.file_type, file.file_name) ? (
                <Music size={22} color="#f59e0b" />
              ) : visual ? (
                <img src={thumbUrl(file.drive_file_id, 100)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <FileTypeIcon type={file.file_type} size={22} />
              )}
              {file.file_type === 'video' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                  <Video size={14} color="#fff" />
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.file_name}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <TypeBadge type={file.file_type} />
                {!selectedTopicId && <span>{file.topic_name} ·</span>}
                {file.uploaded_by_name && <span>{file.uploaded_by_name} ·</span>}
                <span>{formatDate(file.created_at)}</span>
                {file.file_size > 0 && <span>· {formatSize(file.file_size)}</span>}
              </div>
            </div>

            <KebabMenu items={[
              { label: 'Відкрити в Google Drive', icon: <ExternalLink size={14} />, href: file.drive_view_url },
              { label: 'Завантажити', icon: <Download size={14} />, href: file.drive_download_url },
              { label: 'Видалити', icon: <Trash2 size={14} />, onClick: () => onDelete(file.id), danger: true },
            ]} />
          </div>
        );
      })}
    </div>
  );
}
