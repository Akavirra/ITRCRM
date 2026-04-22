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
  const hasActionsRow = Boolean(controls || (actionLabel && onAction));

  return (
    <div
      className="card-header"
      style={{
        display: 'grid',
        gap: hasActionsRow ? '1rem' : '0.25rem',
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'grid', gap: '4px', maxWidth: '720px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>{title}</h3>
        {subtitle ? (
          <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--gray-500)' }}>
            {subtitle}
          </span>
        ) : null}
      </div>

      {hasActionsRow ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          {controls ? (
            <div
              style={{
                display: 'flex',
                flex: '1 1 720px',
                flexWrap: 'wrap',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              {controls}
            </div>
          ) : (
            <div style={{ flex: '1 1 auto' }} />
          )}

          {actionLabel && onAction ? (
            <button className="btn btn-primary" onClick={onAction}>
              <Plus size={18} style={{ marginRight: '8px' }} />
              {actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
