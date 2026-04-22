'use client';

import { Award, Plus } from 'lucide-react';

interface CertificatesEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  centered?: boolean;
}

export default function CertificatesEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  centered = false,
}: CertificatesEmptyStateProps) {
  return (
    <div className="empty-state" style={centered ? { padding: '48px 24px' } : undefined}>
      <div className="empty-state-icon">
        <Award size={48} strokeWidth={1.5} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-text" style={{ maxWidth: '360px', margin: '0 auto 16px' }}>{description}</p>
      {actionLabel && onAction ? (
        <button className="btn btn-primary" onClick={onAction}>
          <Plus size={16} strokeWidth={1.75} />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
