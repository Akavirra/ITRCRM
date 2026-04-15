'use client';

import { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import NotesModal from '@/components/NotesModal';
import NotesWidget from '@/components/NotesWidget';

interface NotesContextValue {
  notesOpen: boolean;
  notesMinimized: boolean;
  toggleNotes: () => void;
  openNotes: () => void;
  closeNotes: () => void;
}

const STORAGE_KEY = 'itrobot-notes-state';

const NotesContext = createContext<NotesContextValue>({
  notesOpen: false,
  notesMinimized: false,
  toggleNotes: () => {},
  openNotes: () => {},
  closeNotes: () => {},
});

function loadState(): { isOpen: boolean; isMinimized: boolean } | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return {
      isOpen: Boolean(parsed?.isOpen),
      isMinimized: Boolean(parsed?.isMinimized),
    };
  } catch {
    return null;
  }
}

function saveState(state: { isOpen: boolean; isMinimized: boolean }) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage write errors */
  }
}

export function useNotes() {
  return useContext(NotesContext);
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesMinimized, setNotesMinimized] = useState(false);

  // Background reminder polling runs only while the tab is visible.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setNotesOpen(saved.isOpen);
      setNotesMinimized(saved.isOpen ? saved.isMinimized : false);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState({
      isOpen: notesOpen,
      isMinimized: notesOpen ? notesMinimized : false,
    });
  }, [hydrated, notesOpen, notesMinimized]);

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

  const openNotes = () => {
    setNotesOpen(true);
    setNotesMinimized(false);
  };

  const minimizeNotes = () => {
    setNotesOpen(true);
    setNotesMinimized(true);
  };

  const restoreNotes = () => {
    setNotesOpen(true);
    setNotesMinimized(false);
  };

  const closeNotes = () => {
    setNotesOpen(false);
    setNotesMinimized(false);
  };

  const toggleNotes = () => {
    if (notesOpen && !notesMinimized) {
      closeNotes();
      return;
    }

    openNotes();
  };

  const value = useMemo(() => ({
    notesOpen,
    notesMinimized,
    toggleNotes,
    openNotes,
    closeNotes,
  }), [notesOpen, notesMinimized]);

  return (
    <NotesContext.Provider value={value}>
      {children}
      {hydrated && notesOpen && !notesMinimized && (
        <NotesModal
          isOpen={notesOpen}
          onClose={closeNotes}
          onMinimize={minimizeNotes}
        />
      )}
      {hydrated && notesOpen && notesMinimized && (
        <NotesWidget
          onRestore={restoreNotes}
          onClose={closeNotes}
        />
      )}
    </NotesContext.Provider>
  );
}
