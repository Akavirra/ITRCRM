'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CertificatesPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  visibleItems: number;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export default function CertificatesPagination({
  page,
  totalPages,
  totalItems,
  visibleItems,
  loading = false,
  onPrev,
  onNext,
}: CertificatesPaginationProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        padding: '12px 24px',
        borderTop: '1px solid var(--gray-200)',
      }}
    >
      <span style={{ color: 'var(--gray-500)', fontSize: '13px' }}>
        {totalItems > 0 ? `Показано ${visibleItems} з ${totalItems}` : 'Немає записів'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onPrev}
          disabled={page <= 1 || loading}
          style={{ padding: '6px 8px' }}
          aria-label="Попередня сторінка"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <span
          style={{
            minWidth: '72px',
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--gray-500)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {page} / {totalPages}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onNext}
          disabled={page >= totalPages || loading}
          style={{ padding: '6px 8px' }}
          aria-label="Наступна сторінка"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
