'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  Download, ExternalLink, ChevronLeft, ChevronRight, Music,
} from 'lucide-react';
import DraggableModal from '@/components/DraggableModal';

// ── Types (exported so materials page can use them) ────────────────────────────

export interface MediaFile {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

export const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp|svg|avif|tiff?)$/i;
export const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|m4v|3gp|wmv|flv|ts)$/i;
export const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|flac|aac|m4a|wma|opus|oga)$/i;

export function isAudioType(type: string, fileName?: string) {
  if (type === 'audio' || type === 'voice') return true;
  if (type === 'document' && fileName && AUDIO_EXTENSIONS.test(fileName)) return true;
  return false;
}

export function isPreviewable(type: string, fileName?: string) {
  if (['photo', 'animation', 'video', 'audio', 'voice'].includes(type)) return true;
  if (type === 'document' && fileName) {
    if (IMAGE_EXTENSIONS.test(fileName)) return true;
    if (VIDEO_EXTENSIONS.test(fileName)) return true;
    if (AUDIO_EXTENSIONS.test(fileName)) return true;
  }
  return false;
}

export function thumbUrl(fileId: string, size = 400) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

export function lessonMediaStreamUrl(fileId: string) {
  return `/api/lesson-media/${encodeURIComponent(fileId)}`;
}

export function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function effectiveCategory(f: MediaFile): 'photo' | 'video' | 'audio' | 'document' {
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

// ── Context ───────────────────────────────────────────────────────────────────

interface MediaViewerContextValue {
  openMediaViewer: (files: MediaFile[], index: number) => void;
}

const MediaViewerContext = createContext<MediaViewerContextValue>({
  openMediaViewer: () => {},
});

export function useMediaViewer() {
  return useContext(MediaViewerContext);
}

// ── Media Viewer Modal ────────────────────────────────────────────────────────

const HEADER_H = 52;

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

function readVideoMetadata(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanup();
      if (!width || !height) {
        resolve(null);
        return;
      }
      resolve({ width, height });
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    video.src = src;
  });
}

function MediaViewerModal({ files, index, onClose, onNavigate }: {
  files: MediaFile[];
  index: number;
  onClose: () => void;
  onNavigate: (idx: number) => void;
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
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    setModalSize(calcMediaSize(file.media_width, file.media_height, mediaType));
  }, [file.id, mediaType, file.media_width, file.media_height]);

  useEffect(() => {
    if (!isVideo || (file.media_width && file.media_height)) {
      return;
    }

    let isCancelled = false;

    readVideoMetadata(lessonMediaStreamUrl(file.drive_file_id)).then((metadata) => {
      if (isCancelled || !metadata) {
        return;
      }

      setModalSize(calcMediaSize(metadata.width, metadata.height, 'video'));
    });

    return () => {
      isCancelled = true;
    };
  }, [file.drive_file_id, file.media_height, file.media_width, isVideo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (e.key === 'ArrowRight' && index < files.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onNavigate, index, files.length]);

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (file.media_width && file.media_height) return;
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    setModalSize(calcMediaSize(img.naturalWidth, img.naturalHeight, 'image'));
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const touch = event.changedTouches[0];

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (!touch || startX === null || startY === null) {
      return;
    }

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0 && index < files.length - 1) {
      onNavigate(index + 1);
      return;
    }

    if (deltaX > 0 && index > 0) {
      onNavigate(index - 1);
    }
  }

  const headerAction = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {hasNav && (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{index + 1} / {files.length}</span>
      )}
      <a
        href={file.drive_download_url}
        target="_blank"
        rel="noopener noreferrer"
        title="Завантажити"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, color: '#64748b', textDecoration: 'none' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <Download size={14} />
      </a>
      <a
        href={file.drive_view_url}
        target="_blank"
        rel="noopener noreferrer"
        title="Відкрити в Google Drive"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, color: '#64748b', textDecoration: 'none' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <ExternalLink size={14} />
      </a>
    </div>
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
      <div
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        {!isAudio && hasNav && index > 0 && (
          <button onClick={() => onNavigate(index - 1)}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <ChevronLeft size={22} />
          </button>
        )}

        {isAudio ? (
          <iframe
            key={file.drive_file_id}
            src={`https://drive.google.com/file/d/${file.drive_file_id}/preview`}
            allow="autoplay"
            style={{ width: '100%', height: '100%', border: 'none', animation: 'mediaFadeIn 0.2s ease' }}
          />
        ) : isVideo ? (
          <iframe
            key={file.drive_file_id}
            src={`https://drive.google.com/file/d/${file.drive_file_id}/preview`}
            allow="autoplay"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', animation: 'mediaFadeIn 0.2s ease', background: '#000' }}
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

        {!isAudio && hasNav && index < files.length - 1 && (
          <button onClick={() => onNavigate(index + 1)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </DraggableModal>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function MediaViewerProvider({ children }: { children: ReactNode }) {
  const [viewerFiles, setViewerFiles] = useState<MediaFile[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const openMediaViewer = useCallback((files: MediaFile[], index: number) => {
    setViewerFiles(files);
    setViewerIndex(index);
  }, []);

  const closeMediaViewer = useCallback(() => {
    setViewerIndex(null);
    setViewerFiles([]);
  }, []);

  return (
    <MediaViewerContext.Provider value={{ openMediaViewer }}>
      {children}
      {viewerIndex !== null && viewerFiles.length > 0 && (
        <MediaViewerModal
          files={viewerFiles}
          index={viewerIndex}
          onClose={closeMediaViewer}
          onNavigate={setViewerIndex}
        />
      )}
    </MediaViewerContext.Provider>
  );
}
