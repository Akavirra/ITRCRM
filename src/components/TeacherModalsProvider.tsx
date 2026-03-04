'use client';

import { TeacherModalsProvider as Provider } from './TeacherModalsContext';

export function TeacherModalsProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
