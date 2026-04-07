'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import NotesModal from '@/components/NotesModal';

interface NotesContextValue {
  notesOpen: boolean;
  toggleNotes: () => void;
}

const NotesContext = createContext<NotesContextValue>({
  notesOpen: false,
  toggleNotes: () => {},
});

export function useNotes() {
  return useContext(NotesContext);
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const toggleNotes = () => setNotesOpen(v => !v);

  // Background reminder polling (every 90s)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetch('/api/notes/check-reminders', { method: 'POST' }).catch(() => {});
    }, 90000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <NotesContext.Provider value={{ notesOpen, toggleNotes }}>
      {children}
      {notesOpen && (
        <NotesModal isOpen={notesOpen} onClose={() => setNotesOpen(false)} />
      )}
    </NotesContext.Provider>
  );
}
