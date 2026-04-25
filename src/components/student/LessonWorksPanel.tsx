'use client';

/**
 * LessonWorksPanel — секція на сторінці групи (`/groups/[id]`).
 *
 * Показує роботи учня, прив'язані саме до конкретного заняття.
 * Якщо upload-вікно відкрите → можна додати/видалити.
 * Якщо закрите → read-only (переглянути/скачати).
 *
 * Props:
 *   - lessonId: обов'язковий, id заняття
 *   - uploadWindowOpen: серверний snapshot (SSR) — показує UI одразу;
 *     клієнт підтягує актуальні дані через /api/student/works?lessonId=…
 *     і використовує uploadWindowOpen з відповіді кожної роботи.
 *   - lessonClosesAt: ISO часу закриття вікна — показуємо міні-таймер
 *   - lessonTitle: опційна назва (для pending-стану перед першим fetch)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import CountdownTimer from './CountdownTimer';
import QrUploadButton from './QrUploadButton';

interface Work {
  id: number;
  title: string;
  description: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  lessonId: number | null;
  createdAt: string;
  uploadWindowOpen: boolean;
  uploadWindowClosesAt: string | null;
}

interface LessonWorksPanelProps {
  lessonId: number;
  uploadWindowOpen: boolean;
  uploadWindowClosesAt: string | null;
  lessonTitle?: string;
}

const MAX_FILE_BYTES = 512 * 1024 * 1024;

export default function LessonWorksPanel({
  lessonId,
  uploadWindowOpen: initialWindowOpen,
  uploadWindowClosesAt,
  lessonTitle,
}: LessonWorksPanelProps) {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [windowOpen, setWindowOpen] = useState(initialWindowOpen);

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
      const r = await fetch(`/api/student/works?lessonId=${lessonId}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const list: Work[] = Array.isArray(data.works) ? data.works : [];
      setWorks(list);
      // Актуалізуємо window-open, виходячи з першої роботи (усі з того ж lesson_id)
      if (list.length > 0) {
        setWindowOpen(list[0].uploadWindowOpen);
      }
    } catch {
      setLoadError('Не вдалося завантажити список робіт.');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

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
      const startRes = await fetch('/api/student/works/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          lessonId,
        }),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err?.error || `start failed: ${startRes.status}`);
      }
      const { uploadUrl, token } = await startRes.json();
      if (!uploadUrl || !token) throw new Error('Некоректна відповідь від сервера');

      await uploadViaXhr(uploadUrl, token, pendingFile, (p) => setProgress(p));
      await reload();
      cancelPending();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Не вдалося завантажити файл');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function deleteWork(id: number) {
    if (!confirm('Видалити цю роботу?')) return;
    setDeletingId(id);
    try {
      const r = await fetch(`/api/student/works/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || `delete failed: ${r.status}`);
      }
      setWorks((prev) => prev.filter((w) => w.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Не вдалося видалити');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="student-card student-works-panel">
      <div className="student-works-panel__header">
        <div>
          <div className="student-works-panel__title">Мої роботи з цього заняття</div>
          {lessonTitle && <div className="student-works-panel__subtitle">{lessonTitle}</div>}
        </div>
        <WindowStatus open={windowOpen} closesAt={uploadWindowClosesAt} />
      </div>

      {windowOpen ? (
        <>
          <div className="student-works-panel__actions">
            <button
              type="button"
              className="student-primary-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              + Додати роботу
            </button>
            <QrUploadButton lessonId={lessonId} lessonLabel={lessonTitle} />
            <input
              ref={fileInputRef}
              type="file"
              onChange={onPickFile}
              style={{ display: 'none' }}
            />
          </div>

          {pendingFile && (
            <div
              className="student-card"
              style={{ border: '2px solid #2160d0', marginBottom: 16 }}
            >
              <div style={{ marginBottom: 8, fontWeight: 600 }}>{pendingFile.name}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                {formatSize(pendingFile.size)} · {pendingFile.type || 'unknown'}
              </div>

              <label style={labelStyle}>Назва роботи</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                maxLength={200}
                style={inputStyle}
              />

              <label style={{ ...labelStyle, marginTop: 12 }}>Опис (необов&apos;язково)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={uploading}
                maxLength={2000}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />

              {uploadError && <div style={errorBoxStyle}>{uploadError}</div>}

              {uploading && progress !== null && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                    Завантаження: {Math.round(progress)}%
                  </div>
                  <div style={progressBarStyle}>
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
        </>
      ) : (
        <div className="student-works-panel__closed-hint">
          Завантаження закрито. Можна лише переглядати та скачувати свої роботи.
        </div>
      )}

      {loading ? (
        <div className="student-empty" style={{ padding: 20 }}>
          Завантаження…
        </div>
      ) : loadError ? (
        <div className="student-empty" style={{ padding: 20 }}>
          {loadError}
        </div>
      ) : works.length === 0 ? (
        <div className="student-empty" style={{ padding: 20 }}>
          {windowOpen ? 'Поки порожньо. Додай свою роботу.' : 'Ти не завантажив(ла) робіт з цього заняття.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
          {works.map((w) => (
            <WorkRow
              key={w.id}
              work={w}
              canDelete={windowOpen}
              deleting={deletingId === w.id}
              onDelete={() => deleteWork(w.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WindowStatus({ open, closesAt }: { open: boolean; closesAt: string | null }) {
  if (open && closesAt) {
    return (
      <div className="student-works-panel__window-open">
        <CountdownTimer
          targetIso={closesAt}
          label="Вікно закриється через"
          reachedLabel="Вікно закрилось"
          compact
        />
      </div>
    );
  }
  return (
    <div className="student-works-panel__window-closed">
      <span className="student-live-badge__dot" />
      Вікно закрито
    </div>
  );
}

function WorkRow({
  work,
  canDelete,
  deleting,
  onDelete,
}: {
  work: Work;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const contentHref = `/api/student/works/${work.id}/content`;
  const downloadHref = `${contentHref}?download=1`;

  return (
    <div className="student-card">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
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
            <div
              style={{ fontSize: 13, color: '#475569', marginTop: 6, overflowWrap: 'anywhere' }}
            >
              {work.description}
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
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="student-secondary-btn"
            style={{ color: '#dc2626', borderColor: '#fecaca' }}
          >
            {deleting ? 'Видалення…' : 'Видалити'}
          </button>
        )}
      </div>
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

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'long',
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 4,
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

const progressBarStyle: React.CSSProperties = {
  height: 6,
  background: '#e2e8f0',
  borderRadius: 3,
  overflow: 'hidden',
};
