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
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPathRef = useRef<string | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimeouts = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  const startLoading = useCallback(() => {
    clearAllTimeouts();
    setIsLoading(true);
  }, [clearAllTimeouts]);

  const stopLoading = useCallback(() => {
    clearAllTimeouts();
    setIsLoading(false);
  }, [clearAllTimeouts]);

  // Initial load - показуємо лоадер тільки при першому завантаженні
  useEffect(() => {
    if (isInitialLoad) {
      setIsLoading(true);
      const timer = setTimeout(() => {
        setIsLoading(false);
        setIsInitialLoad(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isInitialLoad]);

  // Monitor pathname changes - зупиняємо завантаження коли шлях змінився
  useEffect(() => {
    if (isInitialLoad) return;

    const currentPath = pathname + (searchParams?.toString() ? '?' + searchParams.toString() : '');
    
    // Якщо шлях змінився
    if (prevPathRef.current !== null && prevPathRef.current !== currentPath) {
      // Зупиняємо завантаження з невеликою затримкою для плавності
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
      }, 100);
    }
    
    prevPathRef.current = currentPath;
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [pathname, searchParams, isInitialLoad]);

  // Handle browser back/forward buttons
  useEffect(() => {
    if (isInitialLoad) return;

    const handlePopState = () => {
      setIsLoading(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isInitialLoad]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

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
