'use client';

import dynamic from 'next/dynamic';

const StudentModalsManager = dynamic(() => import('./StudentModalsManager'), {
  ssr: false,
  loading: () => null,
});

export default function StudentModalsWrapper() {
  return <StudentModalsManager />;
}
