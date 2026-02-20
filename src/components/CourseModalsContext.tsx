'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface StoredModal {
  id: number;
  title: string;
  isOpen: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface CourseModalsContextType {
  openModals: StoredModal[];
  openCourseModal: (courseId: number, title: string) => void;
  closeCourseModal: (courseId: number) => void;
  updateModalState: (courseId: number, state: Partial<Omit<StoredModal, 'id' | 'title' | 'isOpen'>>) => void;
  isModalOpen: (courseId: number) => boolean;
}

const CourseModalsContext = createContext<CourseModalsContextType | undefined>(undefined);

const STORAGE_KEY = 'itrobot-course-modals';

export function CourseModalsProvider({ children }: { children: ReactNode }) {
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
      console.error('Error loading course modal state:', e);
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
          window.dispatchEvent(new Event('itrobot-course-modal-update'));
        }
      } catch (e) {
        console.error('Error saving course modal state:', e);
      }
    }
  }, [openModals, isHydrated]);

  const openCourseModal = useCallback((courseId: number, title: string) => {
    setOpenModals(prev => {
      // Check if modal already exists - don't duplicate
      const existingModal = prev.find(m => m.id === courseId);
      if (existingModal) {
        // Modal already open - just ensure it's marked as open
        return prev.map(m => 
          m.id === courseId ? { ...m, isOpen: true } : m
        );
      }
      // Add new modal with random position to avoid overlapping
      return [
        ...prev,
        {
          id: courseId,
          title,
          isOpen: true,
          position: { x: 120 + Math.random() * 100, y: 100 + Math.random() * 100 },
          size: { width: 520, height: 480 },
        },
      ];
    });
  }, []);

  const closeCourseModal = useCallback((courseId: number) => {
    setOpenModals(prev => prev.filter(m => m.id !== courseId));
  }, []);

  const updateModalState = useCallback((courseId: number, state: Partial<Omit<StoredModal, 'id' | 'title' | 'isOpen'>>) => {
    setOpenModals(prev => prev.map(m => 
      m.id === courseId ? { ...m, ...state } : m
    ));
  }, []);

  const isModalOpen = useCallback((courseId: number) => {
    return openModals.some(m => m.id === courseId && m.isOpen);
  }, [openModals]);

  return (
    <CourseModalsContext.Provider value={{ openModals, openCourseModal, closeCourseModal, updateModalState, isModalOpen }}>
      {children}
    </CourseModalsContext.Provider>
  );
}

export function useCourseModals() {
  const context = useContext(CourseModalsContext);
  if (!context) {
    throw new Error('useCourseModals must be used within CourseModalsProvider');
  }
  return context;
}
