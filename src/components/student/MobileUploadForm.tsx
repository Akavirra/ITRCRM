'use client';

/**
 * MobileUploadForm — клієнтський компонент мобільної сторінки QR-Upload.
 *
 * Phase C.2: учень відкриває /m/[token] на телефоні (без cookie auth),
 * вибирає файл (фото/відео з камери чи галереї) → ми робимо POST на
 * /api/student/works/direct-mobile з QR-токеном у Authorization header.
 * Відповідь — той же контракт, що й у звичайного direct: {uploadUrl, token}.
 * Далі XHR multipart на upload-service з прогресом.
 *
 * Мобільні особливості:
 *   - <input accept="image/*,video/*" capture> — щоб телефон одразу запропонував камеру.
 *   - Великі target-area для пальців.
 *   - Після успіху: показуємо ✅ і даємо кнопку "Завантажити ще" або "Готово".
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  token: string;
  tokenExpiresAt: string;
  lessonId: number;
}

const MAX_FILE_BYTES = 512 * 1024 * 1024;

interface UploadStartResponse {
  uploadUrl?: string;
  token?: string;
  error?: string;
  closesAt?: string;
}

export default function MobileUploadForm({ token, tokenExpiresAt }: Props) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [doneList, setDoneList] = useState<{ name: string; at: string }[]>([]);
  const [tokenExpired, setTokenExpired] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Показуємо повідомлення коли токен прострочиться (uses tokenExpiresAt)
  useEffect(() => {
    const exp = new Date(tokenExpiresAt).getTime();
    const ms = exp - Date.now();
    if (ms <= 0) {
      setTokenExpired(true);
      return;
    }
    const t = setTimeout(() => setTokenExpired(true), ms);
    return () => clearTimeout(t);
  }, [tokenExpiresAt]);

  const onPickFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`Файл завеликий: ${formatSize(file.size)} > ${formatSize(MAX_FILE_BYTES)}`);
      e.target.value = '';
      return;
    }
    setUploadError(null);
    setPendingFile(file);
    setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 200));
    setDescription('');
    e.target.value = '';
  }, []);

  function cancelPending() {
    setPendingFile(null);
    setTitle('');
    setDescription('');
    setUploadError(null);
    setProgress(null);
  }

  async function confirmUpload() {
    if (!pendingFile || uploading || tokenExpired) return;
    setUploading(true);
    setProgress(0);
    setUploadError(null);
    try {
      const startRes = await fetch('/api/student/works/direct-mobile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });
      const startBody: UploadStartResponse = await startRes.json().catch(() => ({}));
      if (!startRes.ok) {
        if (startRes.status === 401) {
          setTokenExpired(true);
        }
        throw new Error(startBody?.error || `start failed: ${startRes.status}`);
      }
      const { uploadUrl, token: uploadToken } = startBody;
      if (!uploadUrl || !uploadToken) throw new Error('Некоректна відповідь сервера');

      await uploadViaXhr(uploadUrl, uploadToken, pendingFile, (p) => setProgress(p));

      setDoneList((prev) => [
        { name: pendingFile.name, at: new Date().toISOString() },
        ...prev,
      ]);
      cancelPending();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Не вдалося завантажити файл');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  if (tokenExpired) {
    return (
      <div className="student-card student-mobile-expired">
        <div className="student-mobile-expired__icon">⏱️</div>
        <div className="student-mobile-expired__title">Сесія завершилась</div>
        <p className="student-mobile-expired__text">
          Поверніться до комп&apos;ютера й згенеруйте новий QR-код.
        </p>
        {doneList.length > 0 && (
          <div className="student-mobile-expired__done">
            Встигли завантажити: <strong>{doneList.length}</strong>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="student-mobile-form">
      {!pendingFile && (
        <>
          <button
            type="button"
            className="student-mobile-pick-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <span className="student-mobile-pick-btn__icon">📷</span>
            <span className="student-mobile-pick-btn__label">Зробити фото / Вибрати файл</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={onPickFile}
            style={{ display: 'none' }}
          />
        </>
      )}

      {pendingFile && (
        <div className="student-card student-mobile-pending">
          <div className="student-mobile-pending__filename">{pendingFile.name}</div>
          <div className="student-mobile-pending__meta">
            {formatSize(pendingFile.size)} · {pendingFile.type || 'unknown'}
          </div>

          <label className="student-mobile-label">Назва роботи</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
            maxLength={200}
            className="student-mobile-input"
          />

          <label className="student-mobile-label">Опис (необов&apos;язково)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={uploading}
            maxLength={2000}
            rows={3}
            className="student-mobile-input student-mobile-input--textarea"
          />

          {uploadError && <div className="student-mobile-error">{uploadError}</div>}

          {uploading && progress !== null && (
            <div className="student-mobile-progress">
              <div className="student-mobile-progress__label">
                Завантаження: {Math.round(progress)}%
              </div>
              <div className="student-mobile-progress__bar">
                <div
                  className="student-mobile-progress__fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="student-mobile-actions">
            <button
              type="button"
              className="student-primary-btn student-mobile-btn-primary"
              onClick={confirmUpload}
              disabled={uploading || !title.trim()}
            >
              {uploading ? 'Завантаження…' : 'Завантажити'}
            </button>
            <button
              type="button"
              className="student-secondary-btn"
              onClick={cancelPending}
              disabled={uploading}
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      {doneList.length > 0 && (
        <div className="student-card student-mobile-done">
          <div className="student-mobile-done__title">
            Завантажено: {doneList.length}
          </div>
          <ul className="student-mobile-done__list">
            {doneList.map((d, idx) => (
              <li key={`${d.at}-${idx}`}>
                <span className="student-mobile-done__check" aria-hidden="true">✓</span>
                {d.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function uploadViaXhr(
  url: string,
  token: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onerror = () => reject(new Error('Мережева помилка під час завантаження'));
    xhr.onabort = () => reject(new Error('Завантаження скасовано'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      try {
        const parsed = JSON.parse(xhr.responseText);
        reject(new Error(parsed?.error || `Помилка ${xhr.status}`));
      } catch {
        reject(new Error(`Помилка завантаження (${xhr.status})`));
      }
    };
    const formData = new FormData();
    formData.append('token', token);
    formData.append('file', file);
    xhr.send(formData);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
}
