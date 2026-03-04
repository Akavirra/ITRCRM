'use client';

import { StudentModalsProvider as Provider } from './StudentModalsContext';

export function StudentModalsProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
