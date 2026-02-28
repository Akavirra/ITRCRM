'use client';

import { ReactNode, useEffect, useState } from 'react';
import { TelegramWebAppProvider, useTelegramWebApp } from '@/components/TelegramWebAppProvider';

// Inner component that uses the context
function TeacherAppContent({ children }: { children: ReactNode }) {
  const { isLoading, isReady, error, colorScheme } = useTelegramWebApp();

  useEffect(() => {
    // Apply Telegram theme colors to CSS variables
    const root = document.documentElement;
    
    if (colorScheme === 'dark') {
      root.style.setProperty('--tg-bg-color', '#1a1a1a');
      root.style.setProperty('--tg-text-color', '#ffffff');
      root.style.setProperty('--tg-hint-color', '#888888');
      root.style.setProperty('--tg-link-color', '#4da3ff');
      root.style.setProperty('--tg-button-color', '#4da3ff');
      root.style.setProperty('--tg-button-text-color', '#ffffff');
    } else {
      root.style.setProperty('--tg-bg-color', '#ffffff');
      root.style.setProperty('--tg-text-color', '#000000');
      root.style.setProperty('--tg-hint-color', '#999999');
      root.style.setProperty('--tg-link-color', '#2481cc');
      root.style.setProperty('--tg-button-color', '#2481cc');
      root.style.setProperty('--tg-button-text-color', '#ffffff');
    }
  }, [colorScheme]);

  if (isLoading) {
    return (
      <div className="teacher-app-layout">
        <div className="tg-loading">
          <div className="tg-spinner"></div>
        </div>
        <style jsx global>{globalStyles}</style>
      </div>
    );
  }

  return (
    <div className="teacher-app-layout">
      <main>{children}</main>
      <style jsx global>{globalStyles}</style>
    </div>
  );
}

const globalStyles = `
  :root {
    --tg-bg-color: var(--tg-bg-color, #ffffff);
    --tg-text-color: var(--tg-text-color, #000000);
    --tg-hint-color: var(--tg-hint-color, #999999);
    --tg-link-color: var(--tg-link-color, #2481cc);
    --tg-button-color: var(--tg-button-color, #2481cc);
    --tg-button-text-color: var(--tg-button-text-color, #ffffff);
  }

  .dark {
    --tg-bg-color: var(--tg-bg-color, #1a1a1a);
    --tg-text-color: var(--tg-text-color, #ffffff);
    --tg-hint-color: var(--tg-hint-color, #888888);
    --tg-link-color: var(--tg-link-color, #4da3ff);
    --tg-button-color: var(--tg-button-color, #4da3ff);
    --tg-button-text-color: var(--tg-button-text-color, #ffffff);
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
`;

export default function TeacherAppLayout({ children }: { children: ReactNode }) {
  return (
    <TelegramWebAppProvider>
      <TeacherAppContent>{children}</TeacherAppContent>
    </TelegramWebAppProvider>
  );
}
