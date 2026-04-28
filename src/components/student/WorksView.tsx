/**
 * /works — глобальний огляд усіх робіт учня (read-only за замовчуванням).
 *
 * Phase B: Upload UI перенесено на сторінку конкретного заняття
 * (`/groups/[id]` → LessonWorksPanel). Тут учень може:
 *   - переглядати / скачувати всі свої роботи
 *   - видалити роботу, ЯКЩО вікно завантаження її заняття ще відкрите
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Inbox, Info, Loader2, AlertCircle } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';

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
      setLoadError("Не вдалося завантажити список робіт. Перевірте з'єднання.");
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

  const grouped = groupByLesson(works);

  return (
    <>
      <div className="student-info-band">
        <span className="student-info-band__icon">
          <Info size={16} strokeWidth={1.75} />
        </span>
        <div>
          Щоб додати нову роботу — відкрий{' '}
          <Link href="/dashboard">сторінку активного заняття</Link>. Завантажувати можна
          під час заняття та ще годину після.
        </div>
      </div>

      {loading ? (
        <EmptyState
          icon={<Loader2 size={28} strokeWidth={1.75} className="student-spin" />}
          title="Завантаження…"
        />
      ) : loadError ? (
        <EmptyState
          icon={<AlertCircle size={28} strokeWidth={1.75} />}
          title="Не вдалося завантажити"
          hint={loadError}
        />
      ) : works.length === 0 ? (
        <EmptyState
          icon={<Inbox size={28} strokeWidth={1.75} />}
          title="Поки що немає завантажених робіт"
          hint="Файли з'являтимуться тут після того, як ти завантажиш їх на сторінці заняття."
        />
      ) : (
        grouped.map((bucket) => (
          <div key={bucket.key} className="student-works-bucket">
            <div className="student-section-header student-works-bucket-header">
              <span>{bucket.label}</span>
              <WindowChip open={bucket.uploadWindowOpen} closesAt={bucket.uploadWindowClosesAt} />
            </div>
            <div className="student-works-bucket__list">
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
    <article className="student-work-card">
      <div className="student-work-card__header">
        <div className="student-work-card__icon">
          <FileText size={18} strokeWidth={1.75} />
        </div>
        <div className="student-work-card__body">
          <div className="student-work-card__title">{work.title}</div>
          <div className="student-work-card__meta">
            {formatDate(work.createdAt)}
            {work.sizeBytes ? ` · ${formatSize(work.sizeBytes)}` : ''}
            {work.mimeType ? ` · ${work.mimeType}` : ''}
          </div>
          {work.description && (
            <div className="student-work-card__description">{work.description}</div>
          )}
        </div>
      </div>

      <div className="student-work-card__actions">
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
            data-danger
          >
            {deleting ? 'Видалення…' : 'Видалити'}
          </button>
        )}
      </div>
    </article>
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
        label: w.lessonId ? buildLessonLabel(w) : "Без прив'язки до заняття",
        uploadWindowOpen: w.uploadWindowOpen,
        uploadWindowClosesAt: w.uploadWindowClosesAt,
        works: [],
      });
    }
    buckets.get(key)!.works.push(w);
  }
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
