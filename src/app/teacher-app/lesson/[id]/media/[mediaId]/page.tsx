'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/Icons';
import { useTelegramInitData } from '@/components/TelegramWebAppProvider';
import { isVideoMimeType } from '@/lib/lesson-media';

interface LessonPhoto {
  id: number;
  driveFileId: string;
  url: string;
  downloadUrl: string;
  thumbnailUrl: string;
  fileName: string;
  mimeType: string | null;
}

interface LessonPayload {
  photos?: LessonPhoto[];
}

function buildDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

function buildDriveImageUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
}

export default function TeacherLessonMediaPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initData, isLoading: initLoading } = useTelegramInitData();
  const lessonId = params.id as string;
  const mediaId = Number(params.mediaId);
  const versionSuffix = searchParams.get('v') ? `?v=${encodeURIComponent(searchParams.get('v')!)}` : '';

  const [photos, setPhotos] = useState<LessonPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initLoading) return;

    if (!initData) {
      setError('Telegram WebApp не ініціалізовано');
      setLoading(false);
      return;
    }

    const fetchPayload = async () => {
      try {
        const response = await fetch(`/api/teacher-app/lessons/${lessonId}`, {
          headers: { 'X-Telegram-Init-Data': initData },
        });

        if (!response.ok) {
          throw new Error('Не вдалося завантажити медіа заняття');
        }

        const data: LessonPayload = await response.json();
        setPhotos(data.photos || []);
      } catch (fetchError) {
        console.error('Teacher media page error:', fetchError);
        setError('Не вдалося завантажити медіа заняття');
      } finally {
        setLoading(false);
      }
    };

    fetchPayload();
  }, [initData, initLoading, lessonId]);

  const currentIndex = useMemo(
    () => photos.findIndex((photo) => photo.id === mediaId),
    [mediaId, photos],
  );
  const currentPhoto = currentIndex >= 0 ? photos[currentIndex] : null;

  const navigateToIndex = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= photos.length) {
      return;
    }

    router.push(`/teacher-app/lesson/${lessonId}/media/${photos[nextIndex].id}${versionSuffix}`);
  };

  if (loading) {
    return (
      <div className="tg-loading">
        <div className="tg-spinner" />
      </div>
    );
  }

  if (error || !currentPhoto) {
    return (
      <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
        <p style={{ color: 'var(--tg-text-color)', marginBottom: 'var(--space-md)', fontSize: '15px' }}>
          {error || 'Медіа не знайдено'}
        </p>
        <button
          type="button"
          onClick={() => router.push(`/teacher-app/lesson/${lessonId}${versionSuffix}`)}
          className="tg-button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeftIcon size={16} /> Назад до заняття
        </button>
      </div>
    );
  }

  const isVideo = isVideoMimeType(currentPhoto.mimeType);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: 'var(--space-lg)' }}>
        <button
          type="button"
          onClick={() => router.push(`/teacher-app/lesson/${lessonId}${versionSuffix}`)}
          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--tg-link-color)', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <ArrowLeftIcon size={16} /> До заняття
        </button>

        <a
          href={currentPhoto.url}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--tg-link-color)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600 }}
        >
          Drive
        </a>
      </div>

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tg-text-color)', marginBottom: '4px', wordBreak: 'break-word' }}>
          {currentPhoto.fileName}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--tg-text-secondary)' }}>
          {currentIndex + 1} з {photos.length}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          borderRadius: '16px',
          overflow: 'hidden',
          minHeight: '50vh',
        }}
      >
        {photos.length > 1 && currentIndex > 0 && (
          <button
            type="button"
            onClick={() => navigateToIndex(currentIndex - 1)}
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: '40px', height: '40px', borderRadius: '999px', border: 'none', background: 'rgba(255,255,255,0.14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeftIcon size={18} />
          </button>
        )}

        {isVideo ? (
          <iframe
            title={currentPhoto.fileName}
            src={buildDrivePreviewUrl(currentPhoto.driveFileId)}
            allow="autoplay"
            style={{ width: '100%', minHeight: '50vh', height: '70vh', border: 'none', background: '#000' }}
          />
        ) : (
          <img
            src={buildDriveImageUrl(currentPhoto.driveFileId)}
            alt={currentPhoto.fileName}
            style={{ width: '100%', height: '100%', objectFit: 'contain', minHeight: '50vh' }}
          />
        )}

        {photos.length > 1 && currentIndex < photos.length - 1 && (
          <button
            type="button"
            onClick={() => navigateToIndex(currentIndex + 1)}
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: '40px', height: '40px', borderRadius: '999px', border: 'none', background: 'rgba(255,255,255,0.14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRightIcon size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
