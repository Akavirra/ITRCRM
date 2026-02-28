'use client';

import { ReactNode, useEffect, useState } from 'react';

// Extended Telegram WebApp interface for this component
interface TelegramWebAppExtended {
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    query_id?: string;
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
}

export default function TeacherAppLayout({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Load Telegram WebApp script dynamically
    const loadTelegramScript = () => {
      return new Promise<void>((resolve, reject) => {
        // Check if already loaded
        if ((window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-web-app.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Telegram WebApp script'));
        document.head.appendChild(script);
      });
    };

    const initTelegram = async () => {
      try {
        await loadTelegramScript();
        setScriptLoaded(true);

        // Small delay to ensure WebApp is initialized
        await new Promise(resolve => setTimeout(resolve, 100));

        const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebAppExtended } }).Telegram?.WebApp;
        
        if (tg) {
          // Initialize WebApp
          tg.ready();
          tg.expand();
          
          // Set theme based on Telegram settings
          const isDark = tg.colorScheme === 'dark';
          document.documentElement.classList.toggle('dark', isDark);
          
          setIsReady(true);
        }
      } catch (err) {
        console.error('Failed to load Telegram WebApp:', err);
      }
    };

    initTelegram();
  }, []);

  return (
    <>
      <div className="teacher-app-layout">
        <main>{children}</main>
      </div>
      <style jsx global>{`
        :root {
          --tg-bg-color: var(--tg-theme-bg-color, #ffffff);
          --tg-text-color: var(--tg-theme-text-color, #000000);
          --tg-hint-color: var(--tg-theme-hint-color, #999999);
          --tg-link-color: var(--tg-theme-link-color, #2481cc);
          --tg-button-color: var(--tg-theme-button-color, #2481cc);
          --tg-button-text-color: var(--tg-theme-button-text-color, #ffffff);
        }

        .dark {
          --tg-bg-color: var(--tg-theme-bg-color, #1a1a1a);
          --tg-text-color: var(--tg-theme-text-color, #ffffff);
          --tg-hint-color: var(--tg-theme-hint-color, #888888);
          --tg-link-color: var(--tg-theme-link-color, #4da3ff);
          --tg-button-color: var(--tg-theme-button-color, #4da3ff);
          --tg-button-text-color: var(--tg-theme-button-text-color, #ffffff);
        }

        .teacher-app-layout {
          min-height: 100vh;
          background-color: var(--tg-bg-color);
          color: var(--tg-text-color);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        }

        .teacher-app-layout main {
          padding: 16px;
          max-width: 100%;
        }

        /* Mobile-first styles */
        @media (max-width: 480px) {
          .teacher-app-layout main {
            padding: 12px;
          }
        }

        /* Button styles matching Telegram theme */
        .tg-button {
          background-color: var(--tg-button-color);
          color: var(--tg-button-text-color);
          border: none;
          border-radius: 8px;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .tg-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .tg-button-secondary {
          background-color: transparent;
          color: var(--tg-link-color);
          border: 1px solid var(--tg-link-color);
        }

        /* Card styles */
        .tg-card {
          background-color: var(--tg-bg-color);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
        }

        .dark .tg-card {
          border-color: rgba(255, 255, 255, 0.1);
        }

        /* Text styles */
        .tg-hint {
          color: var(--tg-hint-color);
          font-size: 13px;
        }

        .tg-link {
          color: var(--tg-link-color);
          text-decoration: none;
        }

        /* Loading spinner */
        .tg-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }

        .tg-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--tg-hint-color);
          border-top-color: var(--tg-button-color);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Status badges */
        .tg-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .tg-badge-scheduled {
          background-color: #dbeafe;
          color: #1e40af;
        }

        .dark .tg-badge-scheduled {
          background-color: #1e3a8a;
          color: #93c5fd;
        }

        .tg-badge-done {
          background-color: #dcfce7;
          color: #166534;
        }

        .dark .tg-badge-done {
          background-color: #14532d;
          color: #86efac;
        }

        .tg-badge-canceled {
          background-color: #f3f4f6;
          color: #6b7280;
        }

        .dark .tg-badge-canceled {
          background-color: #374151;
          color: #9ca3af;
        }
      `}</style>
    </>
  );
}
