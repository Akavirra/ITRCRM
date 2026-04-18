'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface StoredModal {
  id: number;
  title: string;
  isOpen: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface CampModalsContextType {
  openModals: StoredModal[];
  openCampModal: (campId: number, title: string) => void;
  closeCampModal: (campId: number) => void;
  updateModalState: (campId: number, state: Partial<Omit<StoredModal, 'id' | 'title' | 'isOpen'>>) => void;
  isModalOpen: (campId: number) => boolean;
}

const CampModalsContext = createContext<CampModalsContextType | undefined>(undefined);

const STORAGE_KEY = 'itrobot-camp-modals';

export function CampModalsProvider({ children }: { children: ReactNode }) {
  const [openModals, setOpenModals] = useState<StoredModal[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setOpenModals(parsed.filter((m: StoredModal) => m.isOpen));
        }
      }
    } catch (e) {
      console.error('Error loading camp modal state:', e);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(openModals));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('itrobot-camp-modal-update'));
        }
      } catch (e) {
        console.error('Error saving camp modal state:', e);
      }
    }
  }, [openModals, isHydrated]);

  const openCampModal = useCallback((campId: number, title: string) => {
    setOpenModals(prev => {
      const existing = prev.find(m => m.id === campId);
      if (existing) {
        return prev.map(m => (m.id === campId ? { ...m, isOpen: true, title } : m));
      }
      return [
        ...prev,
        {
          id: campId,
          title,
          isOpen: true,
          position: { x: 80 + Math.random() * 100, y: 80 + Math.random() * 80 },
          size: { width: 860, height: 640 },
        },
      ];
    });
  }, []);

  const closeCampModal = useCallback((campId: number) => {
    setOpenModals(prev => prev.filter(m => m.id !== campId));
  }, []);

  const updateModalState = useCallback(
    (campId: number, state: Partial<Omit<StoredModal, 'id' | 'title' | 'isOpen'>>) => {
      setOpenModals(prev => prev.map(m => (m.id === campId ? { ...m, ...state } : m)));
    },
    []
  );

  const isModalOpen = useCallback(
    (campId: number) => openModals.some(m => m.id === campId && m.isOpen),
    [openModals]
  );

  return (
    <CampModalsContext.Provider value={{ openModals, openCampModal, closeCampModal, updateModalState, isModalOpen }}>
      {children}
    </CampModalsContext.Provider>
  );
}

export function useCampModals() {
  const context = useContext(CampModalsContext);
  if (!context) {
    throw new Error('useCampModals must be used within CampModalsProvider');
  }
  return context;
}
