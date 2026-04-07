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

  // Background reminder polling runs only while the tab is visible.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const checkReminders = () => {
      if (document.hidden) {
        return;
      }

      fetch('/api/notes/check-reminders', { method: 'POST' }).catch(() => {});
    };

    intervalRef.current = setInterval(checkReminders, 90000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkReminders();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
