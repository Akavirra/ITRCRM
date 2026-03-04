'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface StoredModal {
  id: number;
  title: string;
  isOpen: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface TeacherModalsContextType {
  openModals: StoredModal[];
  openTeacherModal: (teacherId: number, title: string) => void;
  closeTeacherModal: (teacherId: number) => void;
  updateModalState: (teacherId: number, state: Partial<Omit<StoredModal, 'id' | 'title' | 'isOpen'>>) => void;
  isModalOpen: (teacherId: number) => boolean;
}

const TeacherModalsContext = createContext<TeacherModalsContextType | undefined>(undefined);

const STORAGE_KEY = 'itrobot-teacher-modals';

export function TeacherModalsProvider({ children }: { children: ReactNode }) {
  const [openModals, setOpenModals] = useState<StoredModal[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Handle both array and object formats for backwards compatibility
        if (Array.isArray(parsed)) {
          // Filter to only keep open modals
          const openOnly = parsed.filter((m: StoredModal) => m.isOpen);
          setOpenModals(openOnly);
        } else if (typeof parsed === 'object') {
          // Convert old object format to array
          const openOnly: StoredModal[] = Object.entries(parsed)
            .filter(([_, value]: [string, any]) => value.isOpen)
            .map(([key, value]: [string, any]) => ({
              id: parseInt(key),
              title: value.title,
              isOpen: true,
              position: value.position,
              size: value.size,
            }));
          setOpenModals(openOnly);
        }
      }
    } catch (e) {
      console.error('Error loading teacher modal state:', e);
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(openModals));
        // Dispatch event to notify other components in same window
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('itrobot-teacher-modal-update'));
        }
      } catch (e) {
        console.error('Error saving teacher modal state:', e);
      }
    }
  }, [openModals, isHydrated]);

  const openTeacherModal = useCallback((teacherId: number, title: string) => {
    setOpenModals(prev => {
      // Check if modal already exists - don't duplicate
      const existingModal = prev.find(m => m.id === teacherId);
      if (existingModal) {
        // Modal already open - just ensure it's marked as open
        return prev.map(m => 
          m.id === teacherId ? { ...m, isOpen: true } : m
        );
      }
      // Add new modal with random position to avoid overlapping
      return [
        ...prev,
        {
          id: teacherId,
          title,
          isOpen: true,
          position: { x: 150 + Math.random() * 100, y: 100 + Math.random() * 100 },
          size: { width: 520, height: 520 },
        },
      ];
    });
  }, []);

  const closeTeacherModal = useCallback((teacherId: number) => {
    setOpenModals(prev => prev.filter(m => m.id !== teacherId));
  }, []);

  const updateModalState = useCallback((teacherId: number, state: Partial<Omit<StoredModal, 'id' | 'title' | 'isOpen'>>) => {
    setOpenModals(prev => prev.map(m => 
      m.id === teacherId ? { ...m, ...state } : m
    ));
  }, []);

  const isModalOpen = useCallback((teacherId: number) => {
    return openModals.some(m => m.id === teacherId && m.isOpen);
  }, [openModals]);

  return (
    <TeacherModalsContext.Provider value={{ openModals, openTeacherModal, closeTeacherModal, updateModalState, isModalOpen }}>
      {children}
    </TeacherModalsContext.Provider>
  );
}

export function useTeacherModals() {
  const context = useContext(TeacherModalsContext);
  if (!context) {
    throw new Error('useTeacherModals must be used within TeacherModalsProvider');
  }
  return context;
}
