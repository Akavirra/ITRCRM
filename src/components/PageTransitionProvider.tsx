'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPathRef = useRef(pathname);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = useCallback(() => {
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    setIsLoading(false);
  }, []);

  // Auto-stop loading when route changes
  useEffect(() => {
    const currentPath = pathname + (searchParams.toString() ? '?' + searchParams.toString() : '');
    
    if (isLoading && prevPathRef.current !== currentPath) {
      // Route has changed, stop loading with a small delay for smooth transition
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        prevPathRef.current = currentPath;
      }, 300);
    }
    
    prevPathRef.current = currentPath;
  }, [pathname, searchParams, isLoading]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <PageTransitionContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      {children}
    </PageTransitionContext.Provider>
  );
};

// Hook to trigger loading on navigation - use this with useRouter
export const useNavigationLoader = () => {
  const { startLoading } = usePageTransition();
  const router = useRouter();
  
  const navigate = useCallback((href: string) => {
    startLoading();
    router.push(href);
  }, [startLoading, router]);

  return { navigate, startLoading };
};

export default PageTransitionProvider;
