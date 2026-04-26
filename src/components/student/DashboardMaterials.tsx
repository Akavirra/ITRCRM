'use client';

/**
 * Прев'ю матеріалів для найближчого заняття на dashboard.
 * Client-side fetch, щоб не блокувати SSR і не змінювати бізнес-логіку.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Image, Link2, ExternalLink, Loader2 } from 'lucide-react';

interface Shortcut {
  id: number;
  label: string;
  url?: string;
  app_url?: string;
  kind: 'url' | 'app';
}

interface GalleryItem {
  id: number;
  filename: string;
  thumbnailUrl: string;
  url: string;
  mimeType: string;
  isVideo: boolean;
}

interface DashboardMaterialsProps {
  lessonId: number | null;
  groupId: number | string | null;
}

export default function DashboardMaterials({ lessonId, groupId }: DashboardMaterialsProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[] | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lessonId) {
      setShortcuts([]);
      setGallery([]);
      return;
    }
    setLoading(true);

    Promise.all([
      fetch(`/api/student/lessons/${lessonId}/shortcuts`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => (Array.isArray(d.items) ? d.items : [])),
      fetch(`/api/student/lessons/${lessonId}/gallery`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => (Array.isArray(d.items) ? d.items : [])),
    ])
      .then(([s, g]) => {
        setShortcuts(s ?? []);
        setGallery(g ?? []);
      })
      .catch(() => {
        setShortcuts([]);
        setGallery([]);
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  if (!lessonId) {
    return (
      <div className="student-dashboard-card">
        <div className="student-dashboard-card__header">
          <div className="student-dashboard-card__title">
            <BookOpen />
            Матеріали до заняття
          </div>
        </div>
        <p className="student-dashboard-materials__empty">Матеріали з&apos;являться перед заняттям</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="student-dashboard-card">
        <div className="student-dashboard-card__header">
          <div className="student-dashboard-card__title">
            <BookOpen />
            Матеріали до заняття
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#9CA3AF', fontSize: 13 }}>
          <Loader2 size={16} className="student-spin" />
          Завантаження…
        </div>
      </div>
    );
  }

  const allItems: { type: 'shortcut' | 'gallery'; data: Shortcut | GalleryItem }[] = [];

  (shortcuts ?? []).slice(0, 3).forEach((s) => allItems.push({ type: 'shortcut', data: s }));
  (gallery ?? []).slice(0, Math.max(0, 4 - allItems.length)).forEach((g) => allItems.push({ type: 'gallery', data: g }));

  const totalCount = (shortcuts ?? []).length + (gallery ?? []).length;

  if (allItems.length === 0) {
    return (
      <div className="student-dashboard-card">
        <div className="student-dashboard-card__header">
          <div className="student-dashboard-card__title">
            <BookOpen />
            Матеріали до заняття
          </div>
        </div>
        <p className="student-dashboard-materials__empty">Матеріали з&apos;являться перед заняттям</p>
      </div>
    );
  }

  return (
    <div className="student-dashboard-card">
      <div className="student-dashboard-card__header">
        <div className="student-dashboard-card__title">
          <BookOpen />
          Матеріали до заняття
        </div>
        {totalCount > allItems.length && groupId && (
          <Link
            href={groupId === 'individual' ? '/groups/individual' : `/groups/${groupId}`}
            className="student-dashboard-card__link"
          >
            Переглянути всі
          </Link>
        )}
      </div>

      <div className="student-dashboard-materials">
        {allItems.map((item, idx) =>
          item.type === 'shortcut' ? (
            <ShortcutItem key={`s-${idx}`} shortcut={item.data as Shortcut} />
          ) : (
            <GalleryItemRow key={`g-${idx}`} item={item.data as GalleryItem} />
          )
        )}
      </div>
    </div>
  );
}

function ShortcutItem({ shortcut }: { shortcut: Shortcut }) {
  const href = shortcut.url || shortcut.app_url || '#';
  const isExternal = href.startsWith('http');

  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="student-dashboard-material"
    >
      <span className="student-dashboard-material__icon">
        {shortcut.kind === 'app' ? <BookOpen size={16} /> : <Link2 size={16} />}
      </span>
      <span className="student-dashboard-material__label">{shortcut.label}</span>
      {isExternal && (
        <span className="student-dashboard-material__arrow">
          <ExternalLink size={14} />
        </span>
      )}
    </a>
  );
}

function GalleryItemRow({ item }: { item: GalleryItem }) {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="student-dashboard-material">
      <span className="student-dashboard-material__icon">
        <Image size={16} />
      </span>
      <span className="student-dashboard-material__label">{item.filename}</span>
      <span className="student-dashboard-material__arrow">
        <ExternalLink size={14} />
      </span>
    </a>
  );
}
