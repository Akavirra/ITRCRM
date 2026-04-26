'use client';

/**
 * Прев'ю останніх робіт учня на dashboard.
 * Client-side fetch, щоб не блокувати SSR.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2 } from 'lucide-react';

interface StudentWorkView {
  id: number;
  title: string;
  description: string | null;
  courseTitle: string | null;
  lessonTopic: string | null;
  createdAt: string;
  updatedAt: string;
  uploadWindowOpen: boolean;
}

export default function DashboardRecentWorks() {
  const [works, setWorks] = useState<StudentWorkView[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/student/works')
      .then((r) => (r.ok ? r.json() : { works: [] }))
      .then((data) => setWorks((Array.isArray(data.works) ? data.works : []).slice(0, 3)))
      .catch(() => setWorks([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="student-dashboard-card">
        <div className="student-dashboard-card__header">
          <div className="student-dashboard-card__title">
            <FileText />
            Останні роботи
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#9CA3AF', fontSize: 13 }}>
          <Loader2 size={16} className="student-spin" />
          Завантаження…
        </div>
      </div>
    );
  }

  if (!works || works.length === 0) {
    return null;
  }

  return (
    <div className="student-dashboard-card">
      <div className="student-dashboard-card__header">
        <div className="student-dashboard-card__title">
          <FileText />
          Останні роботи
        </div>
        <Link href="/works" className="student-dashboard-card__link">
          Всі роботи
        </Link>
      </div>

      <div className="student-dashboard-works">
        {works.map((work) => (
          <div key={work.id} className="student-dashboard-work">
            <div className="student-dashboard-work__icon">
              <FileText size={16} />
            </div>
            <div className="student-dashboard-work__body">
              <div className="student-dashboard-work__title">{work.title}</div>
              <div className="student-dashboard-work__meta">
                {work.courseTitle || work.lessonTopic || 'Робота'}
                {' · '}
                {formatDate(work.updatedAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Kyiv',
  }).format(d);
}
