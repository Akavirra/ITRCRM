'use client';

import { Plus } from 'lucide-react';

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
  const content = (
    <>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {actionLabel && onAction ? (
        <button className="btn btn-primary" onClick={onAction} style={{ marginTop: '16px' }}>
          <Plus size={18} style={{ marginRight: '8px' }} />
          {actionLabel}
        </button>
      ) : null}
    </>
  );

  if (centered) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        {content}
      </div>
    );
  }

  return <div className="empty-state">{content}</div>;
}
