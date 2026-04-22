'use client';

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
    <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
        {totalItems > 0 ? `Показано ${visibleItems} з ${totalItems}` : 'Немає записів'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button className="btn btn-secondary btn-sm" onClick={onPrev} disabled={page <= 1 || loading}>
          Назад
        </button>
        <span style={{ minWidth: '88px', textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)' }}>
          {page} / {totalPages}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={onNext} disabled={page >= totalPages || loading}>
          Далі
        </button>
      </div>
    </div>
  );
}
