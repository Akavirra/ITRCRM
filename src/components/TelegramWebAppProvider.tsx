'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';

// Telegram WebApp types
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    query_id?: string;
    auth_date?: number;
  };
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color: string;
    text_color: string;
    hint_color: string;
    link_color: string;
    button_color: string;
    button_text_color: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    isVisible: boolean;
  };
  MainButton: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    isVisible: boolean;
    isEnabled: boolean;
    text: string;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'success' | 'error' | 'warning') => void;
    selectionChanged: () => void;
  };
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel';
      text: string;
    }>;
  }) => Promise<string>;
  showAlert: (message: string) => Promise<void>;
  showConfirm: (message: string) => Promise<boolean>;
}

interface TelegramWebAppContextType {
  isReady: boolean;
  isLoading: boolean;
  isInWebView: boolean;
  webApp: TelegramWebApp | null;
  initData: string | null;
  user: TelegramUser | null;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramWebApp['themeParams'];
  error: string | null;
  retryCount: number;
  refreshWebApp: () => Promise<void>;
  mounted?: boolean;
}

const TelegramWebAppContext = createContext<TelegramWebAppContextType | null>(null);

// Check if running in Telegram WebView
const checkIsTelegramWebView = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check for Telegram-related user agents
  const telegramPatterns = [
    /telegram/i,
    /webview/i,
    /tdesktop/i,
  ];
  
  // Also check for Telegram-specific URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const hasTelegramParams = urlParams.has('tgWebAppData') || 
                            urlParams.has('tgWebAppVersion') ||
                            urlParams.has('tgwa_data');
  
  return telegramPatterns.some(pattern => pattern.test(userAgent)) || hasTelegramParams;
};

// Parse initData from URL
const parseInitDataFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  const possibleParams = ['tgWebAppData', 'tgwa_data', 'initData'];
  
  for (const param of possibleParams) {
    const value = urlParams.get(param);
    if (value) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  
  const hash = window.location.hash;
  if (hash) {
    const match = hash.match(/tgWebAppData=([^&]+)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }
  
  return null;
};

const TELEGRAM_SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js';

const loadTelegramScript = (): Promise<void> => {
  return new Promise((resolve) => {
    const win = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
    if (win.Telegram?.WebApp) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src*="telegram-web-app"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => resolve()); // Resolve even on error
      return;
    }

    const script = document.createElement('script');
    script.src = TELEGRAM_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      console.warn('Failed to load Telegram WebApp script');
      resolve(); // Don't reject, just continue
    };
    document.head.appendChild(script);
  });
};

interface TelegramWebAppProviderProps {
  children: ReactNode;
}

export function TelegramWebAppProvider({ children }: TelegramWebAppProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInWebView, setIsInWebView] = useState(false);
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [initData, setInitData] = useState<string | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');
  const [themeParams, setThemeParams] = useState<TelegramWebApp['themeParams']>({
    bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#999999',
    link_color: '#2481cc',
    button_color: '#2481cc',
    button_text_color: '#ffffff',
  });
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  const initializedRef = useRef(false);

  const initializeWebApp = useCallback(async () => {
    // Prevent multiple initializations
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;
    
    setIsLoading(true);
    setError(null);

    const win = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
    const startTime = Date.now();
    const MAX_TIME = 5000; // 5 seconds max
    
    // Quick check for existing Telegram
    const tg = win.Telegram?.WebApp;
    if (tg) {
      if (tg.initData) {
        setWebApp(tg);
        setInitData(tg.initData);
        setIsInWebView(true);
        setColorScheme(tg.colorScheme || 'light');
        if (tg.themeParams) setThemeParams(tg.themeParams);
        if (tg.initDataUnsafe?.user) setUser(tg.initDataUnsafe.user);
        tg.ready();
        tg.expand();
        setIsReady(true);
        setIsLoading(false);
        return;
      }
    }

    // Try URL fallback first (fast)
    const urlData = parseInitDataFromUrl();
    if (urlData) {
      setInitData(urlData);
      setIsInWebView(true);
      setIsReady(true);
      setIsLoading(false);
      return;
    }

    // Try to load script and get Telegram
    await loadTelegramScript();
    
    const tg2 = win.Telegram?.WebApp;
    if (tg2 && tg2.initData) {
      setWebApp(tg2);
      setInitData(tg2.initData);
      setIsInWebView(true);
      setColorScheme(tg2.colorScheme || 'light');
      if (tg2.themeParams) setThemeParams(tg2.themeParams);
      if (tg2.initDataUnsafe?.user) setUser(tg2.initDataUnsafe.user);
      tg2.ready();
      tg2.expand();
      setIsReady(true);
      setIsLoading(false);
      return;
    }

    // Check if we're in Telegram
    const inWebView = checkIsTelegramWebView();
    setIsInWebView(inWebView);
    
    // If in WebView but no initData, still allow to proceed
    // The auth will handle the error
    if (inWebView) {
      setIsReady(true); // Allow to proceed, auth will fail
      setError('Telegram WebApp loaded but no initData');
    } else {
      setError('Not running in Telegram Mini App');
    }
    
    setIsLoading(false);
  }, []);

  const refreshWebApp = useCallback(() => {
    initializedRef.current = false;
    return initializeWebApp();
  }, [initializeWebApp]);

  useEffect(() => {
    // Set mounted to true after hydration
    setMounted(true);
    
    // Timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.warn('Telegram WebApp initialization timeout');
        setIsLoading(false);
        setIsReady(true); // Allow app to proceed
      }
    }, 5000);

    initializeWebApp();

    return () => clearTimeout(timeoutId);
  }, [initializeWebApp, isLoading]);

  // Apply theme based on color scheme
  useEffect(() => {
    if (colorScheme) {
      document.documentElement.classList.toggle('dark', colorScheme === 'dark');
    }
  }, [colorScheme]);

  const value: TelegramWebAppContextType & { mounted: boolean } = {
    isReady,
    isLoading,
    isInWebView,
    webApp,
    initData,
    user,
    colorScheme,
    themeParams,
    error,
    retryCount,
    refreshWebApp,
    mounted,
  };

  return (
    <TelegramWebAppContext.Provider value={value}>
      {children}
    </TelegramWebAppContext.Provider>
  );
}

// Hook to use Telegram WebApp context
export function useTelegramWebApp() {
  const context = useContext(TelegramWebAppContext) as TelegramWebAppContextType & { mounted: boolean };
  
  if (!context) {
    throw new Error('useTelegramWebApp must be used within a TelegramWebAppProvider');
  }
  
  return context;
}

// Hook to get initData with automatic loading handling
export function useTelegramInitData() {
  const { initData, isLoading, error, refreshWebApp } = useTelegramWebApp();
  
  return {
    initData,
    isLoading,
    error,
    refresh: refreshWebApp,
  };
}
