'use client';

import { CourseModalsProvider as Provider } from './CourseModalsContext';

export function CourseModalsProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
