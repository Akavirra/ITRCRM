'use client';

import type { ReactNode } from 'react';
import CertificatesTabs from '@/components/certificates/CertificatesTabs';

type CertificatesTab = 'gift' | 'completion';

interface CertificatesPageShellProps {
  activeTab: CertificatesTab;
  onTabChange: (tab: CertificatesTab) => void;
  children: ReactNode;
}

export default function CertificatesPageShell({
  activeTab,
  onTabChange,
  children,
}: CertificatesPageShellProps) {
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <div className="card">
        <CertificatesTabs active={activeTab} onChange={onTabChange} />
        {children}
      </div>
    </div>
  );
}
