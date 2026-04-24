/**
 * Клієнтський компонент сторінки /works студентського порталу.
 *
 * Показує список власних робіт учня + кнопку завантажити нову.
 * Flow:
 *   1. Користувач обирає файл → відкривається modal з title/description
 *   2. POST /api/student/works/direct → отримуємо { uploadUrl, token }
 *   3. XHR POST multipart/form-data на uploadUrl → upload-service вантажить у Drive
 *      і через X-Internal-Secret викликає finalize → створює запис student_works
 *   4. Локально перезавантажуємо список
 *
 * Передивлятись файл — посилання на /api/student/works/[id]/content,
 * скачати — на /api/student/works/[id]/content?download=1.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface StudentWorkView {
  id: number;
  title: string;
  description: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  courseId: number | null;
  courseTitle: string | null;
  lessonId: number | null;
  lessonDate: string | null;
  createdAt: string;
  updatedAt: string;
}

const MAX_FILE_BYTES = 512 * 1024 * 1024; // має збігатися з MAX_UPLOAD_BYTES на upload-service

export default function WorksView() {
  const [works, setWorks] = useState<StudentWorkView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch('/api/student/works', { cache: 'no-store' });
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}`);
      }
      const data = await r.json();
      setWorks(Array.isArray(data.works) ? data.works : []);
    } catch (e) {
      setLoadError('Не вдалося завантажити список робіт. Перевірте зʼєднання.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
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
  }

  function cancelPending() {
    setPendingFile(null);
    setTitle('');
    setDescription('');
    setUploadError(null);
    setProgress(null);
  }

  async function confirmUpload() {
    if (!pendingFile || uploading) return;

    setUploading(true);
    setProgress(0);
    setUploadError(null);

    try {
      // 1. start — отримуємо token + uploadUrl
      const startRes = await fetch('/api/student/works/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err?.error || `start failed: ${startRes.status}`);
      }
      const { uploadUrl, token } = await startRes.json();
      if (!uploadUrl || !token) {
        throw new Error('Некоректна відповідь від сервера');
      }

      // 2. multipart POST на upload-service
      await uploadViaXhr(uploadUrl, token, pendingFile, (p) => setProgress(p));

      // 3. перезавантажуємо список
      await reload();
      cancelPending();
    } catch (e: any) {
      setUploadError(e?.message || 'Не вдалося завантажити файл');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function deleteWork(id: number) {
    if (!confirm('Видалити цю роботу? Її більше не буде у переліку.')) return;
    setDeletingId(id);
    try {
      const r = await fetch(`/api/student/works/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || `delete failed: ${r.status}`);
      }
      setWorks((prev) => prev.filter((w) => w.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Не вдалося видалити');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <h1 className="student-page-title">Мої роботи</h1>
      <p className="student-page-subtitle">Файли, які ти відправив на перевірку</p>

      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="student-primary-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          + Додати роботу
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={onPickFile}
          style={{ display: 'none' }}
        />
      </div>

      {pendingFile && (
        <div className="student-card" style={{ border: '2px solid #2160d0', marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>{pendingFile.name}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            {formatSize(pendingFile.size)} · {pendingFile.type || 'unknown'}
          </div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            Назва роботи
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
            maxLength={200}
            style={inputStyle}
          />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, margin: '12px 0 4px' }}>
            Опис (необов&apos;язково)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={uploading}
            maxLength={2000}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />

          {uploadError && (
            <div style={errorBoxStyle}>{uploadError}</div>
          )}

          {uploading && progress !== null && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                Завантаження: {Math.round(progress)}%
              </div>
              <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: '#2160d0',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="student-primary-btn"
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

      <div className="student-section-header">Список робіт</div>

      {loading ? (
        <div className="student-empty">Завантаження…</div>
      ) : loadError ? (
        <div className="student-empty">{loadError}</div>
      ) : works.length === 0 ? (
        <div className="student-empty">
          Ти ще не завантажував жодної роботи. Натисни «+ Додати роботу» вище.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {works.map((w) => (
            <WorkRow
              key={w.id}
              work={w}
              deleting={deletingId === w.id}
              onDelete={() => deleteWork(w.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function WorkRow({
  work,
  deleting,
  onDelete,
}: {
  work: StudentWorkView;
  deleting: boolean;
  onDelete: () => void;
}) {
  const contentHref = `/api/student/works/${work.id}/content`;
  const downloadHref = `${contentHref}?download=1`;

  return (
    <div className="student-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 2, overflowWrap: 'anywhere' }}>
            {work.title}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {formatDate(work.createdAt)}
            {work.sizeBytes ? ` · ${formatSize(work.sizeBytes)}` : ''}
            {work.mimeType ? ` · ${work.mimeType}` : ''}
          </div>
          {work.description && (
            <div style={{ fontSize: 13, color: '#475569', marginTop: 6, overflowWrap: 'anywhere' }}>
              {work.description}
            </div>
          )}
          {(work.courseTitle || work.lessonDate) && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
              {work.courseTitle ? `Курс: ${work.courseTitle}` : ''}
              {work.courseTitle && work.lessonDate ? ' · ' : ''}
              {work.lessonDate ? `Урок: ${work.lessonDate}` : ''}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={contentHref} target="_blank" rel="noreferrer" className="student-secondary-btn">
          Переглянути
        </a>
        <a href={downloadHref} className="student-secondary-btn">
          Скачати
        </a>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="student-secondary-btn"
          style={{ color: '#dc2626', borderColor: '#fecaca' }}
        >
          {deleting ? 'Видалення…' : 'Видалити'}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function uploadViaXhr(
  url: string,
  token: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress((e.loaded / e.total) * 100);
      }
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

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Kyiv',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'inherit',
};

const errorBoxStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '8px 10px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 6,
  color: '#b91c1c',
  fontSize: 13,
};
