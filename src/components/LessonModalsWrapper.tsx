'use client';

import dynamic from 'next/dynamic';

const LessonModalsManager = dynamic(() => import('./LessonModalsManager'), {
  ssr: false,
  loading: () => null,
});

export default function LessonModalsWrapper() {
  return <LessonModalsManager />;
}
