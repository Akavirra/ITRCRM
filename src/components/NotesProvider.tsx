'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
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

  return (
    <NotesContext.Provider value={{ notesOpen, toggleNotes }}>
      {children}
      <NotesModal isOpen={notesOpen} onClose={() => setNotesOpen(false)} />
    </NotesContext.Provider>
  );
}
