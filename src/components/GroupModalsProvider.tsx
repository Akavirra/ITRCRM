'use client';

import { GroupModalsProvider as Provider } from './GroupModalsContext';

export function GroupModalsProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
