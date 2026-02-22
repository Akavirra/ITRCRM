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
  const [isLoading, setIsLoading] = useState(true); // Start with loading true to show animation on page load
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPathRef = useRef(pathname);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLinkClickRef = useRef(false);

  const startLoading = useCallback(() => {
    console.log('[PageTransition] startLoading called');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsLoading(true);
    isLinkClickRef.current = true;
  }, []);

  const stopLoading = useCallback(() => {
    console.log('[PageTransition] stopLoading called');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsLoading(false);
    isLinkClickRef.current = false;
  }, []);

  // Stop loading after initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        stopLoading();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Stop loading when route changes (navigation completed)
  useEffect(() => {
    const currentPath = pathname + (searchParams.toString() ? '?' + searchParams.toString() : '');
    
    // Only auto-stop if we initiated the navigation
    if (isLoading && isLinkClickRef.current && prevPathRef.current !== currentPath) {
      console.log('[PageTransition] Route changed, stopping loader');
      timeoutRef.current = setTimeout(() => {
        stopLoading();
        prevPathRef.current = currentPath;
      }, 1200);
    }
    
    prevPathRef.current = currentPath;
  }, [pathname, searchParams, isLoading, stopLoading]);

  // Intercept all link clicks on the page
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      
      if (!anchor) return;
      
      const href = anchor.getAttribute('href');
      if (!href) return;
      
      console.log('[PageTransition] Link clicked:', href);
      
      // Internal navigation only
      if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('#')) {
        const currentPath = pathname + (searchParams.toString() ? '?' + searchParams.toString() : '');
        
        // Only trigger if navigating to a different page
        if (href !== currentPath && href !== currentPath.split('?')[0] + '/') {
          console.log('[PageTransition] Starting loader for navigation');
          startLoading();
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname, searchParams, startLoading]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      console.log('[PageTransition] Popstate event');
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
