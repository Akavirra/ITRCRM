'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface StoredModal {
  id: number;
  title: string;
  isOpen: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface GroupModalsContextType {
  openModals: StoredModal[];
  openGroupModal: (groupId: number, title: string) => void;
  closeGroupModal: (groupId: number) => void;
  updateModalState: (groupId: number, state: Partial<Omit<StoredModal, 'id' | 'title' | 'isOpen'>>) => void;
  isModalOpen: (groupId: number) => boolean;
}

const GroupModalsContext = createContext<GroupModalsContextType | undefined>(undefined);

const STORAGE_KEY = 'itrobot-group-modals';

export function GroupModalsProvider({ children }: { children: ReactNode }) {
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
      console.error('Error loading modal state:', e);
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
          window.dispatchEvent(new Event('itrobot-group-modal-update'));
        }
      } catch (e) {
        console.error('Error saving modal state:', e);
      }
    }
  }, [openModals, isHydrated]);

  const openGroupModal = useCallback((groupId: number, title: string) => {
    setOpenModals(prev => {
      // Check if modal already exists - don't duplicate
      const existingModal = prev.find(m => m.id === groupId);
      if (existingModal) {
        // Modal already open - just ensure it's marked as open
        return prev.map(m => 
          m.id === groupId ? { ...m, isOpen: true } : m
        );
      }
      // Add new modal with random position to avoid overlapping
      return [
        ...prev,
        {
          id: groupId,
          title,
          isOpen: true,
          position: { x: 100 + Math.random() * 100, y: 100 + Math.random() * 100 },
          size: { width: 520, height: 480 },
        },
      ];
    });
  }, []);

  const closeGroupModal = useCallback((groupId: number) => {
    setOpenModals(prev => prev.filter(m => m.id !== groupId));
  }, []);

  const updateModalState = useCallback((groupId: number, state: Partial<Omit<StoredModal, 'id' | 'title' | 'isOpen'>>) => {
    setOpenModals(prev => prev.map(m => 
      m.id === groupId ? { ...m, ...state } : m
    ));
  }, []);

  const isModalOpen = useCallback((groupId: number) => {
    return openModals.some(m => m.id === groupId && m.isOpen);
  }, [openModals]);

  return (
    <GroupModalsContext.Provider value={{ openModals, openGroupModal, closeGroupModal, updateModalState, isModalOpen }}>
      {children}
    </GroupModalsContext.Provider>
  );
}

export function useGroupModals() {
  const context = useContext(GroupModalsContext);
  if (!context) {
    throw new Error('useGroupModals must be used within GroupModalsProvider');
  }
  return context;
}
