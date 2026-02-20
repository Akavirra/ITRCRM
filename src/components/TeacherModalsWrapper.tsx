'use client';

import dynamic from 'next/dynamic';

const TeacherModalsManager = dynamic(() => import('./TeacherModalsManager'), {
  ssr: false,
  loading: () => null,
});

export default function TeacherModalsWrapper() {
  return <TeacherModalsManager />;
}
