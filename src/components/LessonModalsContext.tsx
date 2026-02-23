'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface StoredModal {
  id: number;
  title: string;
  isOpen: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  lessonData?: {
    id: number;
    groupId: number;
    groupTitle: string;
    courseTitle: string;
    courseId: number;
    teacherId: number;
    teacherName: string;
    originalTeacherId?: number;
    isReplaced?: boolean;
    startTime: string;
    endTime: string;
    status: 'scheduled' | 'done' | 'canceled';
    topic: string | null;
    notes?: string | null;
  };
}

interface LessonModalsContextType {
  openModals: StoredModal[];
  openLessonModal: (lessonId: number, title: string, lessonData: StoredModal['lessonData']) => void;
  closeLessonModal: (lessonId: number) => void;
  updateModalState: (lessonId: number, state: Partial<Omit<StoredModal, 'id' | 'title' | 'isOpen'>>) => void;
  isModalOpen: (lessonId: number) => boolean;
}

const LessonModalsContext = createContext<LessonModalsContextType | undefined>(undefined);

const STORAGE_KEY = 'itrobot-lesson-modals';

export function LessonModalsProvider({ children }: { children: ReactNode }) {
  const [openModals, setOpenModals] = useState<StoredModal[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filter to only keep open modals
          const openOnly = parsed.filter((m: StoredModal) => m.isOpen);
          setOpenModals(openOnly);
        }
      }
    } catch (e) {
      console.error('Error loading lesson modal state:', e);
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
          window.dispatchEvent(new Event('itrobot-lesson-modal-update'));
        }
      } catch (e) {
        console.error('Error saving lesson modal state:', e);
      }
    }
  }, [openModals, isHydrated]);

  const openLessonModal = useCallback((lessonId: number, title: string, lessonData?: StoredModal['lessonData']) => {
    setOpenModals(prev => {
      // Check if modal already exists - don't duplicate
      const existingModal = prev.find(m => m.id === lessonId);
      if (existingModal) {
        // Modal already open - just ensure it's marked as open and update data
        // Only update lessonData if new data is provided
        const newLessonData = lessonData && Object.keys(lessonData).length > 0 
          ? lessonData 
          : existingModal.lessonData;
        return prev.map(m => 
          m.id === lessonId ? { ...m, isOpen: true, lessonData: newLessonData } : m
        );
      }
      // Add new modal with random position to avoid overlapping
      return [
        ...prev,
        {
          id: lessonId,
          title,
          isOpen: true,
          position: { x: 150 + Math.random() * 100, y: 100 + Math.random() * 100 },
          size: { width: 420, height: 480 },
          lessonData,
        },
      ];
    });
  }, []);

  const closeLessonModal = useCallback((lessonId: number) => {
    setOpenModals(prev => prev.filter(m => m.id !== lessonId));
  }, []);

  const updateModalState = useCallback((lessonId: number, state: Partial<Omit<StoredModal, 'id' | 'title' | 'isOpen'>>) => {
    setOpenModals(prev => prev.map(m => 
      m.id === lessonId ? { ...m, ...state } : m
    ));
  }, []);

  const isModalOpen = useCallback((lessonId: number) => {
    return openModals.some(m => m.id === lessonId && m.isOpen);
  }, [openModals]);

  return (
    <LessonModalsContext.Provider value={{ openModals, openLessonModal, closeLessonModal, updateModalState, isModalOpen }}>
      {children}
    </LessonModalsContext.Provider>
  );
}

export function useLessonModals() {
  const context = useContext(LessonModalsContext);
  if (!context) {
    throw new Error('useLessonModals must be used within LessonModalsProvider');
  }
  return context;
}
