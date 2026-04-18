'use client';

import dynamic from 'next/dynamic';

const CampModalsManager = dynamic(() => import('./CampModalsManager'), {
  ssr: false,
  loading: () => null,
});

export default function CampModalsWrapper() {
  return <CampModalsManager />;
}
