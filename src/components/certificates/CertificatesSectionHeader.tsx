'use client';

import { Plus } from 'lucide-react';
import { ReactNode } from 'react';

interface CertificatesSectionHeaderProps {
  title: string;
  subtitle?: string;
  controls?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export default function CertificatesSectionHeader({
  title,
  subtitle,
  controls,
  actionLabel,
  onAction,
}: CertificatesSectionHeaderProps) {
  return (
    <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
      <div style={{ display: 'grid', gap: '4px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>{title}</h3>
        {subtitle ? (
          <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
            {subtitle}
          </span>
        ) : null}
      </div>

      {controls}

      {actionLabel && onAction ? (
        <button className="btn btn-primary" onClick={onAction}>
          <Plus size={18} style={{ marginRight: '8px' }} />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
