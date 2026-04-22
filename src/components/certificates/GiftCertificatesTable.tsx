'use client';

import { Download, Plus, Printer, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import CertificatesEmptyState from '@/components/certificates/CertificatesEmptyState';

export interface GiftCertificateListItem {
  id: number;
  public_id: string;
  amount: number;
  status: 'active' | 'used' | 'expired' | 'canceled';
  issued_at: string;
  printed_at: string | null;
  creator_name: string | null;
}

interface GiftCertificatesTableProps {
  certificates: GiftCertificateListItem[];
  loading: boolean;
  showArchived: boolean;
  getStatusBadge: (certificate: GiftCertificateListItem) => ReactNode;
  formatIssuedAt: (value: string) => string;
  onTogglePrinted: (id: number, isPrinted: boolean) => void;
  onDownload: (id: number) => void;
  onDelete: (id: number) => void;
  onCreate: () => void;
  emptyTitle: string;
  emptyDescription: string;
}

export default function GiftCertificatesTable({
  certificates,
  loading,
  showArchived,
  getStatusBadge,
  formatIssuedAt,
  onTogglePrinted,
  onDownload,
  onDelete,
  onCreate,
  emptyTitle,
  emptyDescription,
}: GiftCertificatesTableProps) {
  if (loading) {
    return (
      <CertificatesEmptyState
        title="Завантажуємо сертифікати…"
        description="Каркас сторінки вже доступний, список з'явиться одразу після відповіді API."
      />
    );
  }

  if (!certificates.length) {
    return (
      <CertificatesEmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={!showArchived ? 'Створити сертифікат' : undefined}
        onAction={!showArchived ? onCreate : undefined}
      />
    );
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Номінал</th>
          <th>Статус</th>
          <th>Дата видачі</th>
          <th>Ким видано</th>
          <th style={{ textAlign: 'right' }}>Дії</th>
        </tr>
      </thead>
      <tbody>
        {certificates.map((certificate) => (
          <tr key={certificate.id}>
            <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280' }}>{certificate.public_id}</td>
            <td style={{ fontWeight: 600 }}>{certificate.amount} грн</td>
            <td>{getStatusBadge(certificate)}</td>
            <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{formatIssuedAt(certificate.issued_at)}</td>
            <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{certificate.creator_name || '—'}</td>
            <td style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', gap: '6px' }}>
                <button
                  className="btn btn-sm"
                  onClick={() => onTogglePrinted(certificate.id, Boolean(certificate.printed_at))}
                  title={certificate.printed_at ? 'Надруковано' : 'Позначити як надруковано'}
                  style={{
                    padding: '6px 10px',
                    background: certificate.printed_at ? '#dcfce7' : 'transparent',
                    color: certificate.printed_at ? '#16a34a' : 'var(--gray-500)',
                    border: certificate.printed_at ? '1px solid #16a34a' : '1px solid var(--gray-300)',
                  }}
                >
                  <Printer size={16} />
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => onDownload(certificate.id)} title="Завантажити PDF" style={{ padding: '6px 10px' }}>
                  <Download size={16} />
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(certificate.id)} title="Видалити" style={{ padding: '6px 10px' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
