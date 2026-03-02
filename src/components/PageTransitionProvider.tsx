'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

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
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  const startLoading = useCallback(() => {
    // Не показуємо глобальний лоадер при навігації - сторінки мають свої loading стани
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Initial load - показуємо лоадер тільки при першому завантаженні сайту
  useEffect(() => {
    // Затримка для показу лоадера при першому завантаженні
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsInitialLoad(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  // Оновлюємо ref при зміні шляху
  useEffect(() => {
    prevPathRef.current = pathname;
  }, [pathname]);

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
