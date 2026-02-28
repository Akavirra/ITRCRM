'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

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
    /tdesktop/i,  // Telegram Desktop
    /macintosh.*mobile/i, // iOS Telegram
    /android.*mobile/i,   // Android Telegram
  ];
  
  // Also check for Telegram-specific URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const hasTelegramParams = urlParams.has('tgWebAppData') || 
                            urlParams.has('tgWebAppVersion') ||
                            urlParams.has('tgwa_data'); // Alternative param
  
  return telegramPatterns.some(pattern => pattern.test(userAgent)) || hasTelegramParams;
};

// Parse initData from URL (Telegram passes it as URL parameter)
const parseInitDataFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  
  // Try different parameter names Telegram might use
  const possibleParams = ['tgWebAppData', 'tgwa_data', 'initData'];
  
  for (const param of possibleParams) {
    const value = urlParams.get(param);
    if (value) {
      try {
        // May be URL encoded
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  
  // Also check hash
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

// Telegram script URL
const TELEGRAM_SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js';

// Load Telegram WebApp script
const loadTelegramScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    const win = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
    if (win.Telegram?.WebApp) {
      resolve();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="telegram-web-app"]');
    if (existingScript) {
      // Wait for existing script to load
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Telegram WebApp script')));
      return;
    }

    const script = document.createElement('script');
    script.src = TELEGRAM_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Telegram WebApp script'));
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

  const initializeWebApp = useCallback(async (maxRetries: number = 20, delay: number = 300) => {
    setIsLoading(true);
    setError(null);
    
    const win = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
    
    let attempts = 0;
    
    while (attempts < maxRetries) {
      attempts++;
      setRetryCount(attempts);
      
      try {
        // Try to load the script
        await loadTelegramScript();
        
        // Small delay to ensure full initialization
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const tg = win.Telegram?.WebApp;
        
        if (tg) {
          // Initialize the WebApp
          tg.ready();
          tg.expand();
          
          // Get initData
          let data: string | null = tg.initData || null;
          
          // If no initData from SDK, try URL fallback
          if (!data) {
            data = parseInitDataFromUrl();
          }
          
          if (data) {
            setWebApp(tg);
            setInitData(data);
            setIsInWebView(true);
            setColorScheme(tg.colorScheme || 'light');
            
            if (tg.themeParams) {
              setThemeParams(tg.themeParams);
            }
            
            if (tg.initDataUnsafe?.user) {
              setUser(tg.initDataUnsafe.user);
            }
            
            setIsReady(true);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn(`Attempt ${attempts}: WebApp initialization failed`, err);
      }
      
      // Wait before next retry
      if (attempts < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // If we get here, check if we're in Telegram WebView by user agent
    const inWebView = checkIsTelegramWebView();
    setIsInWebView(inWebView);
    
    // Try URL fallback one more time
    const urlData = parseInitDataFromUrl();
    if (urlData) {
      setInitData(urlData);
      setIsReady(true);
      setIsLoading(false);
      return;
    }
    
    // Final fallback - check if there's any Telegram context
    if (!inWebView && !urlData) {
      setError('Ця сторінка працює тільки в Telegram Mini App');
    } else if (inWebView) {
      setError('Telegram WebApp не ініціалізовано. Спробуйте оновити сторінку.');
    }
    
    setIsLoading(false);
  }, []);

  const refreshWebApp = useCallback(async () => {
    await initializeWebApp();
  }, [initializeWebApp]);

  useEffect(() => {
    initializeWebApp();
  }, [initializeWebApp]);

  // Apply theme based on color scheme
  useEffect(() => {
    if (webApp && colorScheme) {
      document.documentElement.classList.toggle('dark', colorScheme === 'dark');
    }
  }, [colorScheme, webApp]);

  const value: TelegramWebAppContextType = {
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
  };

  return (
    <TelegramWebAppContext.Provider value={value}>
      {children}
    </TelegramWebAppContext.Provider>
  );
}

// Hook to use Telegram WebApp context
export function useTelegramWebApp(): TelegramWebAppContextType {
  const context = useContext(TelegramWebAppContext);
  
  if (!context) {
    throw new Error('useTelegramWebApp must be used within a TelegramWebAppProvider');
  }
  
  return context;
}

// Hook to get initData with automatic loading handling
export function useTelegramInitData(): {
  initData: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { initData, isLoading, error, refreshWebApp } = useTelegramWebApp();
  
  return {
    initData,
    isLoading,
    error,
    refresh: refreshWebApp,
  };
}
