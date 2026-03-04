'use client';

import dynamic from 'next/dynamic';

const CourseModalsManager = dynamic(() => import('./CourseModalsManager'), {
  ssr: false,
  loading: () => null,
});

export default function CourseModalsWrapper() {
  return <CourseModalsManager />;
}
