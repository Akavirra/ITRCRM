'use client';

import { Award, Gift } from 'lucide-react';

type CertificatesTabKey = 'gift' | 'completion';

interface CertificatesTabsProps {
  active: CertificatesTabKey;
  onChange: (tab: CertificatesTabKey) => void;
}

const tabs: Array<{ key: CertificatesTabKey; label: string; icon: typeof Gift }> = [
  { key: 'gift', label: 'Подарункові', icon: Gift },
  { key: 'completion', label: 'Про закінчення', icon: Award },
];

export default function CertificatesTabs({ active, onChange }: CertificatesTabsProps) {
  return (
    <div className="tabs" style={{ marginBottom: '24px', gap: '4px' }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            className={`tab${isActive ? ' active' : ''}`}
            onClick={() => {
              if (!isActive) {
                onChange(tab.key);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
            }}
          >
            <Icon size={16} strokeWidth={1.75} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
