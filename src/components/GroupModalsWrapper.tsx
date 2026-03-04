'use client';

import dynamic from 'next/dynamic';

const GroupModalsManager = dynamic(() => import('./GroupModalsManager'), {
  ssr: false,
  loading: () => null,
});

export default function GroupModalsWrapper() {
  return <GroupModalsManager />;
}
