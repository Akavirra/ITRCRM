'use client';

import { LessonModalsProvider as Provider } from './LessonModalsContext';

export function LessonModalsProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
