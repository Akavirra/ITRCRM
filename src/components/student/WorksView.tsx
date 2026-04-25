/**
 * /works — глобальний огляд усіх робіт учня (read-only за замовчуванням).
 *
 * Phase B: Upload UI перенесено на сторінку конкретного заняття
 * (`/groups/[id]` → LessonWorksPanel). Тут учень може лише:
 *   - переглядати / скачувати всі свої роботи
 *   - видалити роботу, ЯКЩО вікно завантаження її заняття ще відкрите
 *
 * Цей компонент рендериться в client mode, бо має інтерактивний стан
 * (очікуємо fetch + optimistic delete).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

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
  lessonStartAt: string | null;
  lessonEndAt: string | null;
  lessonTopic: string | null;
  uploadWindowOpen: boolean;
  uploadWindowClosesAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function WorksView() {
  const [works, setWorks] = useState<StudentWorkView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch('/api/student/works', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setWorks(Array.isArray(data.works) ? data.works : []);
    } catch {
      setLoadError('Не вдалося завантажити список робіт. Перевірте зʼєднання.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Не вдалося видалити');
    } finally {
      setDeletingId(null);
    }
  }

  // Групуємо роботи за lesson_id для чистішого UX
  const grouped = groupByLesson(works);

  return (
    <>
      <h1 className="student-page-title">Мої роботи</h1>
      <p className="student-page-subtitle">
        Усі файли, які ти завантажив(ла). Нові роботи додаються зі сторінки активного заняття.
      </p>

      <div className="student-card" style={{ background: '#f0f5ff', borderColor: '#dbeafe' }}>
        <div style={{ fontSize: 13, color: '#1e40af' }}>
          💡 Щоб додати нову роботу — відкрий <Link href="/dashboard" style={{ color: '#1d4ed8', fontWeight: 600 }}>сторінку активного заняття</Link>.
          Завантажувати можна під час заняття та ще годину після.
        </div>
      </div>

      {loading ? (
        <div className="student-empty">Завантаження…</div>
      ) : loadError ? (
        <div className="student-empty">{loadError}</div>
      ) : works.length === 0 ? (
        <div className="student-empty">
          Ти ще не завантажував(ла) жодної роботи.
        </div>
      ) : (
        grouped.map((bucket) => (
          <div key={bucket.key} style={{ marginBottom: 24 }}>
            <div className="student-section-header student-works-bucket-header">
              <span>{bucket.label}</span>
              <WindowChip open={bucket.uploadWindowOpen} closesAt={bucket.uploadWindowClosesAt} />
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {bucket.works.map((w) => (
                <WorkRow
                  key={w.id}
                  work={w}
                  deleting={deletingId === w.id}
                  onDelete={() => deleteWork(w.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}

function WindowChip({ open, closesAt }: { open: boolean; closesAt: string | null }) {
  if (open) {
    return (
      <span className="student-badge student-works-window-chip student-works-window-chip--open">
        Вікно відкрите{closesAt ? ` · до ${formatShort(closesAt)}` : ''}
      </span>
    );
  }
  return (
    <span className="student-badge student-works-window-chip student-works-window-chip--closed">
      Read-only
    </span>
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
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={contentHref} target="_blank" rel="noreferrer" className="student-secondary-btn">
          Переглянути
        </a>
        <a href={downloadHref} className="student-secondary-btn">
          Скачати
        </a>
        {work.uploadWindowOpen && (
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

interface Bucket {
  key: string;
  label: string;
  uploadWindowOpen: boolean;
  uploadWindowClosesAt: string | null;
  works: StudentWorkView[];
}

function groupByLesson(works: StudentWorkView[]): Bucket[] {
  const buckets = new Map<string, Bucket>();
  for (const w of works) {
    const key = w.lessonId ? `lesson:${w.lessonId}` : 'no-lesson';
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: w.lessonId
          ? buildLessonLabel(w)
          : 'Без прив\'язки до заняття',
        uploadWindowOpen: w.uploadWindowOpen,
        uploadWindowClosesAt: w.uploadWindowClosesAt,
        works: [],
      });
    }
    buckets.get(key)!.works.push(w);
  }
  // Сортуємо: спочатку з відкритим вікном, потім за датою (новіші вище)
  return Array.from(buckets.values()).sort((a, b) => {
    if (a.uploadWindowOpen !== b.uploadWindowOpen) {
      return a.uploadWindowOpen ? -1 : 1;
    }
    const aDate = a.works[0]?.lessonStartAt || a.works[0]?.createdAt || '';
    const bDate = b.works[0]?.lessonStartAt || b.works[0]?.createdAt || '';
    return bDate.localeCompare(aDate);
  });
}

function buildLessonLabel(w: StudentWorkView): string {
  const parts: string[] = [];
  if (w.courseTitle) parts.push(w.courseTitle);
  if (w.lessonStartAt) {
    parts.push(formatDate(w.lessonStartAt));
  } else if (w.lessonDate) {
    parts.push(w.lessonDate);
  }
  if (w.lessonTopic) parts.push(w.lessonTopic);
  return parts.length > 0 ? parts.join(' · ') : `Заняття №${w.lessonId}`;
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

function formatShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Kyiv',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
