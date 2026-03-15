'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import CreateLessonModal from './CreateLessonModal';

const LessonModalsManager = dynamic(() => import('./LessonModalsManager'), {
  ssr: false,
  loading: () => null,
});

interface CreateLessonPreFill {
  tab: 'lesson' | 'makeup';
  teacherId?: number | null;
  courseId?: number | null;
  studentIds?: number[];
  absenceIds?: number[];
}

export default function LessonModalsWrapper() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [preFill, setPreFill] = useState<CreateLessonPreFill | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CreateLessonPreFill>).detail;
      setPreFill(detail);
      setCreateModalOpen(true);
    };
    window.addEventListener('itrobot-open-create-lesson', handler);
    return () => window.removeEventListener('itrobot-open-create-lesson', handler);
  }, []);

  const handleClose = () => {
    setCreateModalOpen(false);
    setPreFill(null);
  };

  const handleSuccess = () => {
    setCreateModalOpen(false);
    setPreFill(null);
    window.dispatchEvent(new Event('itrobot-lesson-updated'));
  };

  return (
    <>
      <LessonModalsManager />
      {createModalOpen && (
        <CreateLessonModal
          isOpen={createModalOpen}
          onClose={handleClose}
          onSuccess={handleSuccess}
          initialTab={preFill?.tab}
          initialTeacherId={preFill?.teacherId}
          initialCourseId={preFill?.courseId}
          initialStudentIds={preFill?.studentIds}
          initialAbsenceIds={preFill?.absenceIds}
        />
      )}
    </>
  );
}
