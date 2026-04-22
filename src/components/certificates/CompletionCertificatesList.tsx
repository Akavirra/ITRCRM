'use client';

import { Download, Trash2 } from 'lucide-react';
import CertificatesEmptyState from '@/components/certificates/CertificatesEmptyState';

export interface CompletionCertificateListItem {
  id: number;
  student_name: string;
  course_title: string | null;
  group_title?: string | null;
  issue_date: string;
}

interface CompletionCertificatesListProps {
  certificates: CompletionCertificateListItem[];
  groupedCertificates: Record<string, CompletionCertificateListItem[]>;
  loading: boolean;
  formatIssuedAt: (value: string) => string;
  onDownload: (id: number) => void;
  onDelete: (id: number) => void;
  onCreate: () => void;
}

export default function CompletionCertificatesList({
  certificates,
  groupedCertificates,
  loading,
  formatIssuedAt,
  onDownload,
  onDelete,
  onCreate,
}: CompletionCertificatesListProps) {
  if (loading) {
    return (
      <CertificatesEmptyState
        title="Завантажуємо сертифікати…"
        description="Список з'явиться одразу після відповіді API."
        centered
      />
    );
  }

  if (!certificates.length) {
    return (
      <CertificatesEmptyState
        title="Сертифікатів про закінчення ще немає"
        description="Створіть перший сертифікат і він з'явиться в цьому списку."
        actionLabel="Створити перший сертифікат"
        onAction={onCreate}
        centered
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: '16px', padding: '8px 0' }}>
      {Object.entries(groupedCertificates).map(([groupTitle, items]) => (
        <div
          key={groupTitle}
          style={{
            border: '1px solid var(--gray-200)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--gray-200)',
              background: 'var(--gray-50)',
              fontWeight: 600,
              fontSize: '14px',
              color: 'var(--gray-700)',
            }}
          >
            {groupTitle}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Учень</th>
                <th>Курс</th>
                <th>Дата видачі</th>
                <th style={{ textAlign: 'right' }}>Дії</th>
              </tr>
            </thead>
            <tbody>
              {items.map((certificate) => (
                <tr key={certificate.id}>
                  <td style={{ fontWeight: 600 }}>{certificate.student_name}</td>
                  <td style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                    {certificate.course_title || '—'}
                  </td>
                  <td style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                    {formatIssuedAt(certificate.issue_date)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onDownload(certificate.id)}
                        title="Завантажити PDF"
                        style={{ padding: '6px 8px' }}
                      >
                        <Download size={16} strokeWidth={1.75} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(certificate.id)}
                        title="Видалити"
                        style={{ padding: '6px 8px' }}
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
