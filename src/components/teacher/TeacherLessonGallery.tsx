/**
 * TeacherLessonGallery — server component для перегляду фото/відео заняття.
 *
 * Phase E.1.5 (view-only): викладач бачить медіа з lesson_photo_files —
 * фото яких залив адмін (через CRM) або сам викладач (через Telegram WebApp).
 *
 * Тут НЕ редагуємо й не вантажимо нові — тільки показ. Аплоад з web-портaла
 * додамо окремою ітерацією, бо він потребує два-стадійного flow з upload-service.
 *
 * Drive-файли публічні (через makeFilePublic) — віддаємо прямі URL.
 */

import {
  getDriveViewUrl,
  getDriveThumbnailUrl,
} from '@/lib/google-drive';

interface PhotoRow {
  id: number;
  drive_file_id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by_name: string | null;
  uploaded_via: string;
  created_at: string;
}

interface Props {
  photos: PhotoRow[];
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
}

function isVideo(mime: string | null): boolean {
  return typeof mime === 'string' && mime.toLowerCase().startsWith('video/');
}

export default function TeacherLessonGallery({ photos }: Props) {
  if (photos.length === 0) {
    return (
      <div className="teacher-empty">
        Поки фото немає. Додавати можна через Telegram-бот або CRM (адмін).
      </div>
    );
  }

  return (
    <div>
      <div className="teacher-gallery-grid">
        {photos.map((p) => {
          const video = isVideo(p.mime_type);
          return (
            <a
              key={p.id}
              href={getDriveViewUrl(p.drive_file_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="teacher-gallery-item"
              title={p.file_name}
            >
              <div className="teacher-gallery-item__thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getDriveThumbnailUrl(p.drive_file_id)}
                  alt={p.file_name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                {video && (
                  <span className="teacher-gallery-item__play" aria-hidden="true">
                    ▶
                  </span>
                )}
              </div>
              <div className="teacher-gallery-item__caption">
                <div className="teacher-gallery-item__filename">{p.file_name}</div>
                <div className="teacher-gallery-item__meta">
                  {p.uploaded_by_name && <span>{p.uploaded_by_name}</span>}
                  {p.file_size != null && p.file_size > 0 && (
                    <span>· {formatSize(p.file_size)}</span>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
