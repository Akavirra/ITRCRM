'use client';

import { CampModalsProvider as Provider } from './CampModalsContext';

export function CampModalsProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
