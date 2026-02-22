'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
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
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const prevPathRef = useRef(pathname);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingRef = useRef(false);

  const startLoading = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsLoading(true);
    isNavigatingRef.current = true;
  }, []);

  const stopLoading = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsLoading(false);
    isNavigatingRef.current = false;
  }, []);

  // Stop loading after initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        stopLoading();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Use router events to detect navigation
  useEffect(() => {
    const handleRouteChangeStart = () => {
      startLoading();
    };

    const handleRouteChangeComplete = () => {
      if (isNavigatingRef.current) {
        timeoutRef.current = setTimeout(() => {
          stopLoading();
          isNavigatingRef.current = false;
        }, 1000);
      }
    };

    // These events might not be available in newer Next.js, but let's try
    // @ts-ignore
    if (router.events) {
      // @ts-ignore
      router.events.on('routeChangeStart', handleRouteChangeStart);
      // @ts-ignore
      router.events.on('routeChangeComplete', handleRouteChangeComplete);
      // @ts-ignore
      router.events.on('routeChangeError', handleRouteChangeComplete);
    }

    return () => {
      // @ts-ignore
      if (router.events) {
        // @ts-ignore
        router.events.off('routeChangeStart', handleRouteChangeStart);
        // @ts-ignore
        router.events.off('routeChangeComplete', handleRouteChangeComplete);
        // @ts-ignore
        router.events.off('routeChangeError', handleRouteChangeComplete);
      }
    };
  }, [router, startLoading, stopLoading]);

  // Fallback: also monitor pathname changes
  useEffect(() => {
    const currentPath = pathname + (searchParams.toString() ? '?' + searchParams.toString() : '');
    
    // If we were navigating and path changed, stop loading
    if (isLoading && isNavigatingRef.current && prevPathRef.current !== currentPath) {
      timeoutRef.current = setTimeout(() => {
        stopLoading();
        prevPathRef.current = currentPath;
      }, 800);
    }
    
    prevPathRef.current = currentPath;
  }, [pathname, searchParams, isLoading, stopLoading]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      isNavigatingRef.current = true;
      startLoading();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [startLoading]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <PageTransitionContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      {children}
    </PageTransitionContext.Provider>
  );
};

export default PageTransitionProvider;
