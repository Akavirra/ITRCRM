import { ReactNode } from 'react';
import Link from 'next/link';

interface Props {
  title: ReactNode;
  link?: { href: string; label: string };
  className?: string;
}

/**
 * Маленький заголовок секції: всі-caps мутений текст + опційне посилання праворуч.
 * Замінює `<div className="student-section-header">…</div>`.
 */
export function SectionHeader({ title, link, className }: Props) {
  if (!link) {
    return <div className={className ? `student-section-header ${className}` : 'student-section-header'}>{title}</div>;
  }

  return (
    <div
      className={className ? `student-section-header ${className}` : 'student-section-header'}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
    >
      <span>{title}</span>
      <Link href={link.href} className="student-dashboard-card__link" style={{ textTransform: 'none', letterSpacing: 0 }}>
        {link.label}
      </Link>
    </div>
  );
}
