'use client';

/**
 * Прев'ю останніх робіт учня на dashboard.
 * Client-side fetch, щоб не блокувати SSR.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Skeleton } from './ui/Skeleton';

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
        <div className="student-dashboard-works">
          {[0, 1, 2].map((i) => (
            <div key={i} className="student-dashboard-work">
              <Skeleton width={32} height={32} radius={10} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skeleton width="70%" height={12} radius={4} />
                <Skeleton width="40%" height={10} radius={4} />
              </div>
            </div>
          ))}
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
