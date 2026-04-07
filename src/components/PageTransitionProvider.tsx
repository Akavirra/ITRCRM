'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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

  const startLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

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
