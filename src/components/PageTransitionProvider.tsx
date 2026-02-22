'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface PageTransitionContextType {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
}

const PageTransitionContext = createContext<PageTransitionContextType | undefined>(undefined);

export const usePageTransition = () => {
  const context = useContext(PageTransitionContext);
  if (!context) {
    throw new Error('usePageTransition must be used within a PageTransitionProvider');
  }
  return context;
};

interface PageTransitionProviderProps {
  children: ReactNode;
}

export const PageTransitionProvider = ({ children }: PageTransitionProviderProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPathRef = useRef(pathname);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const minDisplayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingStartTimeRef = useRef<number>(0);

  const MIN_DISPLAY_TIME = 300; // Мінімальний час показу лоадера
  const MAX_LOADING_TIME = 5000; // Максимум 5 секунд

  const clearAllTimeouts = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    if (minDisplayTimeoutRef.current) {
      clearTimeout(minDisplayTimeoutRef.current);
      minDisplayTimeoutRef.current = null;
    }
  }, []);

  const startLoading = useCallback(() => {
    clearAllTimeouts();
    loadingStartTimeRef.current = Date.now();
    setIsLoading(true);

    // Failsafe - зняти завантаження через MAX_LOADING_TIME
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
    }, MAX_LOADING_TIME);
  }, [clearAllTimeouts]);

  const stopLoading = useCallback(() => {
    clearAllTimeouts();
    
    const elapsed = Date.now() - loadingStartTimeRef.current;
    const remainingTime = MIN_DISPLAY_TIME - elapsed;

    if (remainingTime > 0) {
      // Дочекатися мінімального часу показу
      minDisplayTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
      }, remainingTime);
    } else {
      setIsLoading(false);
    }
  }, [clearAllTimeouts]);

  // Initial mount
  useEffect(() => {
    setIsMounted(true);
    loadingStartTimeRef.current = Date.now();
    
    // Показуємо лоадер при першому завантаженні
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    
    return () => clearTimeout(timer);
  }, []);

  // Monitor pathname changes for navigation
  useEffect(() => {
    if (!isMounted) return;

    const currentPath = pathname + (searchParams?.toString() ? '?' + searchParams.toString() : '');
    
    // Якщо шлях змінився і ми не на початковому завантаженні
    if (prevPathRef.current !== currentPath && prevPathRef.current !== pathname) {
      // Зупиняємо завантаження після зміни шляху
      stopLoading();
    }
    
    prevPathRef.current = currentPath;
  }, [pathname, searchParams, isMounted, stopLoading]);

  // Handle browser back/forward buttons
  useEffect(() => {
    if (!isMounted) return;

    const handlePopState = () => {
      startLoading();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMounted, startLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

  // Expose methods for manual control
  const contextValue: PageTransitionContextType = {
    isLoading,
    startLoading,
    stopLoading,
  };

  return (
    <PageTransitionContext.Provider value={contextValue}>
      {children}
    </PageTransitionContext.Provider>
  );
};

export default PageTransitionProvider;
