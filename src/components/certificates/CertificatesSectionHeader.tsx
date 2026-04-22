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
    <div
      className="card-header"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '16px',
      }}
    >
      {/* Top row: title + add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'grid', gap: '4px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>{title}</h3>
          {subtitle ? (
            <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
              {subtitle}
            </span>
          ) : null}
        </div>

        {actionLabel && onAction ? (
          <button className="btn btn-primary" onClick={onAction} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            <Plus size={16} strokeWidth={1.75} />
            {actionLabel}
          </button>
        ) : null}
      </div>

      {/* Controls row: filters, search, toggle */}
      {controls ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          {controls}
        </div>
      ) : null}
    </div>
  );
}
