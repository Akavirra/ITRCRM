'use client';

type CertificatesTabKey = 'gift' | 'completion';

interface CertificatesTabsProps {
  active: CertificatesTabKey;
  onChange: (tab: CertificatesTabKey) => void;
}

const tabs: Array<{ key: CertificatesTabKey; label: string }> = [
  { key: 'gift', label: 'Подарункові' },
  { key: 'completion', label: 'Про закінчення' },
];

export default function CertificatesTabs({ active, onChange }: CertificatesTabsProps) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.5rem' }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;

        return (
          <button
            key={tab.key}
            className="btn btn-sm"
            onClick={() => {
              if (!isActive) {
                onChange(tab.key);
              }
            }}
            style={{
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#111827' : '#6b7280',
              borderBottom: isActive ? '2px solid #111827' : '2px solid transparent',
              borderRadius: 0,
              background: 'transparent',
              padding: '0.5rem 0.75rem',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
