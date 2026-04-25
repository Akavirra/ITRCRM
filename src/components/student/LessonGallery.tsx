'use client';

/**
 * LessonGallery — клієнтський компонент галереї заняття для учня (Phase C.1).
 *
 * Поведінка:
 *   - Згорнутий за замовчуванням → кнопка "📷 Галерея (N)".
 *   - При першому розгортанні робить ОДИН fetch /api/student/lessons/{id}/gallery,
 *     далі кешує результат у стані компонента.
 *   - Грід з мініатюрами; натиск на елемент відкриває URL у новій вкладці.
 *   - Для відео — overlay-іконка ▶ поверх thumbnail (Drive все одно віддає preview).
 *
 * Якщо `count = 0` — нічого не рендеримо (батько мав би не вставляти).
 */

import { useState, useCallback } from 'react';

interface GalleryItem {
  id: number;
  driveFileId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedByName: string | null;
  uploadedVia: 'admin' | 'telegram';
  createdAt: string;
  url: string;
  downloadUrl: string;
  thumbnailUrl: string;
  isImage: boolean;
  isVideo: boolean;
}

interface Props {
  lessonId: number;
  count: number;
  defaultExpanded?: boolean;
}

export default function LessonGallery({ lessonId, count, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const ensureLoaded = useCallback(async () => {
    if (items !== null || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/lessons/${lessonId}/gallery`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завантажити галерею');
    } finally {
      setLoading(false);
    }
  }, [lessonId, items, loading]);

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      void ensureLoaded();
    }
  }, [expanded, ensureLoaded]);

  if (count <= 0) return null;

  return (
    <div className="student-gallery">
      <button
        type="button"
        className="student-gallery__toggle"
        onClick={toggle}
        aria-expanded={expanded}
      >
        <span className="student-gallery__toggle-icon" aria-hidden="true">📷</span>
        <span>Галерея ({count})</span>
        <span className={`student-gallery__chevron${expanded ? ' is-open' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {expanded && (
        <div className="student-gallery__body">
          {loading && <div className="student-gallery__hint">Завантаження…</div>}
          {error && <div className="student-gallery__error">{error}</div>}
          {!loading && !error && items && items.length === 0 && (
            <div className="student-gallery__hint">Файлів ще немає.</div>
          )}
          {!loading && !error && items && items.length > 0 && (
            <div className="student-gallery__grid">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="student-gallery__item"
                  title={item.fileName}
                >
                  <div className="student-gallery__thumb">
                    {/* Drive thumbnail працює і для зображень, і для відео */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbnailUrl}
                      alt={item.fileName}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    {item.isVideo && (
                      <span className="student-gallery__play" aria-hidden="true">
                        ▶
                      </span>
                    )}
                  </div>
                  <div className="student-gallery__caption">
                    <div className="student-gallery__filename">{item.fileName}</div>
                    {item.uploadedByName && (
                      <div className="student-gallery__author">{item.uploadedByName}</div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
