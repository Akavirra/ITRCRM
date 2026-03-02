'use client';

import { ReactNode, useEffect, useState } from 'react';
import { TelegramWebAppProvider, useTelegramWebApp } from '@/components/TelegramWebAppProvider';
import TeacherAppNavbar from '@/components/TeacherAppNavbar';

// Inner component that uses the context
function TeacherAppContent({ children }: { children: ReactNode }) {
  const { isLoading, isReady, error, colorScheme, mounted } = useTelegramWebApp();

  useEffect(() => {
    // Apply Telegram theme colors to CSS variables
    const root = document.documentElement;
    
    if (colorScheme === 'dark') {
      root.style.setProperty('--tg-bg-color', '#121212');
      root.style.setProperty('--tg-surface', '#1e1e1e');
      root.style.setProperty('--tg-text-color', '#e8eaed');
      root.style.setProperty('--tg-text-secondary', '#9aa0a6');
      root.style.setProperty('--tg-hint-color', '#5f6368');
      root.style.setProperty('--tg-link-color', '#8ab4f8');
      root.style.setProperty('--tg-primary', '#8ab4f8');
      root.style.setProperty('--tg-primary-bg', '#2d4a7c');
      root.style.setProperty('--tg-button-color', '#8ab4f8');
      root.style.setProperty('--tg-button-text-color', '#121212');
      root.style.setProperty('--tg-border', 'rgba(255, 255, 255, 0.12)');
      root.style.setProperty('--tg-success-bg', '#1a3d2e');
      root.style.setProperty('--tg-success', '#81c995');
      root.style.setProperty('--tg-danger-bg', '#4d2020');
      root.style.setProperty('--tg-danger', '#f28b82');
    } else {
      root.style.setProperty('--tg-bg-color', '#f8fafc');
      root.style.setProperty('--tg-surface', '#ffffff');
      root.style.setProperty('--tg-text-color', '#1e293b');
      root.style.setProperty('--tg-text-secondary', '#64748b');
      root.style.setProperty('--tg-hint-color', '#94a3b8');
      root.style.setProperty('--tg-link-color', '#3b82f6');
      root.style.setProperty('--tg-primary', '#3b82f6');
      root.style.setProperty('--tg-primary-bg', '#eff6ff');
      root.style.setProperty('--tg-button-color', '#3b82f6');
      root.style.setProperty('--tg-button-text-color', '#ffffff');
      root.style.setProperty('--tg-border', 'rgba(0, 0, 0, 0.08)');
      root.style.setProperty('--tg-success-bg', '#ecfdf5');
      root.style.setProperty('--tg-success', '#10b981');
      root.style.setProperty('--tg-danger-bg', '#fef2f2');
      root.style.setProperty('--tg-danger', '#ef4444');
    }
  }, [colorScheme]);

  // During SSR and initial hydration, always render the loading state
  // This prevents hydration mismatch errors
  if (!mounted || isLoading) {
    return (
      <div className="teacher-app-layout has-navbar">
        <div className="tg-loading">
          <div className="tg-spinner"></div>
        </div>
        <style jsx global>{globalStyles}</style>
      </div>
    );
  }

  return (
    <div className="teacher-app-layout has-navbar">
      <main>{children}</main>
      <TeacherAppNavbar />
      <style jsx global>{globalStyles}</style>
    </div>
  );
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  :root {
    /* Light theme - Modern pastel palette */
    --tg-bg-color: var(--tg-bg-color, #f8fafc);
    --tg-surface: var(--tg-surface, #ffffff);
    --tg-text-color: var(--tg-text-color, #1e293b);
    --tg-text-secondary: var(--tg-text-secondary, #64748b);
    --tg-hint-color: var(--tg-hint-color, #94a3b8);
    --tg-link-color: var(--tg-link-color, #3b82f6);
    --tg-primary: var(--tg-primary, #3b82f6);
    --tg-primary-bg: var(--tg-primary-bg, #eff6ff);
    --tg-button-color: var(--tg-button-color, #3b82f6);
    --tg-button-text-color: var(--tg-button-text-color, #ffffff);
    --tg-border: var(--tg-border, rgba(0, 0, 0, 0.08));
    
    /* Status colors */
    --tg-success: var(--tg-success, #10b981);
    --tg-success-bg: var(--tg-success-bg, #ecfdf5);
    --tg-danger: var(--tg-danger, #ef4444);
    --tg-danger-bg: var(--tg-danger-bg, #fef2f2);
    --tg-warning: var(--tg-warning, #f59e0b);
    --tg-warning-bg: var(--tg-warning-bg, #fffbeb);
    
    /* Spacing */
    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 24px;
    --space-xl: 32px;
    
    /* Border radius */
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-xl: 20px;
    --radius-full: 9999px;
    
    /* Shadows - soft and delicate */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);
    --shadow-xl: 0 12px 32px rgba(0, 0, 0, 0.1);
  }

  /* Dark theme */
  .dark {
    --tg-bg-color: var(--tg-bg-color, #121212);
    --tg-surface: var(--tg-surface, #1e1e1e);
    --tg-text-color: var(--tg-text-color, #e8eaed);
    --tg-text-secondary: var(--tg-text-secondary, #9aa0a6);
    --tg-hint-color: var(--tg-hint-color, #5f6368);
    --tg-link-color: var(--tg-link-color, #8ab4f8);
    --tg-primary: var(--tg-primary, #8ab4f8);
    --tg-primary-bg: var(--tg-primary-bg, #2d4a7c);
    --tg-button-color: var(--tg-button-color, #8ab4f8);
    --tg-button-text-color: var(--tg-button-text-color, #121212);
    --tg-border: var(--tg-border, rgba(255, 255, 255, 0.12));
    --tg-success-bg: var(--tg-success-bg, #1a3d2e);
    --tg-success: var(--tg-success, #81c995);
    --tg-danger-bg: var(--tg-danger-bg, #4d2020);
    --tg-danger: var(--tg-danger, #f28b82);
    --tg-warning-bg: var(--tg-warning-bg, #3d3000);
    --tg-warning: var(--tg-warning, #fde047);
    
    /* Dark shadows */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
    --shadow-xl: 0 12px 32px rgba(0, 0, 0, 0.5);
  }

  /* Base layout - light and airy */
  .teacher-app-layout {
    min-height: 100vh;
    background-color: var(--tg-bg-color);
    color: var(--tg-text-color);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .teacher-app-layout main {
    padding: var(--space-lg);
    padding-bottom: calc(var(--space-xl) + 70px);
    max-width: 100%;
    min-height: 100vh;
  }

  /* Mobile-first styles */
  @media (max-width: 480px) {
    .teacher-app-layout main {
      padding: var(--space-md);
    }
  }

  /* Button styles - modern and soft */
  .tg-button {
    background-color: var(--tg-button-color);
    color: var(--tg-button-text-color);
    border: none;
    border-radius: var(--radius-md);
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow-sm);
    letter-spacing: 0.01em;
  }

  .tg-button:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .tg-button:active {
    transform: translateY(0);
    box-shadow: var(--shadow-sm);
  }

  .tg-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .tg-button-secondary {
    background-color: transparent;
    color: var(--tg-link-color);
    border: 1.5px solid var(--tg-link-color);
  }

  .tg-button-secondary:hover {
    background-color: var(--tg-primary-bg);
  }

  /* Card styles - elevated surface */
  .tg-card {
    background-color: var(--tg-surface);
    border: 1px solid var(--tg-border);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin-bottom: var(--space-md);
    box-shadow: var(--shadow-md);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tg-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  /* Text styles */
  .tg-hint {
    color: var(--tg-hint-color);
    font-size: 13px;
    line-height: 1.5;
  }

  .tg-text-secondary {
    color: var(--tg-text-secondary);
    font-size: 14px;
  }

  .tg-link {
    color: var(--tg-link-color);
    text-decoration: none;
    transition: opacity 0.2s;
  }

  .tg-link:hover {
    opacity: 0.8;
  }

  /* Loading spinner */
  .tg-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }

  .tg-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--tg-border);
    border-top-color: var(--tg-button-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Status badges - soft pastel */
  .tg-badge {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: var(--radius-full);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .tg-badge-scheduled {
    background-color: var(--tg-primary-bg);
    color: var(--tg-link-color);
  }

  .tg-badge-done {
    background-color: var(--tg-success-bg);
    color: var(--tg-success);
  }

  .tg-badge-canceled {
    background-color: var(--tg-danger-bg);
    color: var(--tg-danger);
  }

  /* Input styles - modern */
  .tg-input {
    width: 100%;
    padding: 14px 16px;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--tg-border);
    background: var(--tg-surface);
    color: var(--tg-text-color);
    font-size: 14px;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
  }

  .tg-input:focus {
    outline: none;
    border-color: var(--tg-link-color);
    box-shadow: 0 0 0 3px var(--tg-primary-bg);
  }

  .tg-input::placeholder {
    color: var(--tg-hint-color);
  }

  /* Section spacing */
  .tg-section {
    margin-bottom: var(--space-xl);
  }

  .tg-section-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--tg-text-color);
    margin-bottom: var(--space-md);
  }

  /* Avatar placeholder */
  .tg-avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
    background: linear-gradient(135deg, var(--tg-primary-bg), var(--tg-primary));
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tg-link-color);
    font-weight: 600;
    font-size: 16px;
  }

  /* Empty state */
  .tg-empty {
    text-align: center;
    padding: var(--space-xl);
    color: var(--tg-hint-color);
  }

  .tg-empty-icon {
    font-size: 48px;
    margin-bottom: var(--space-md);
    opacity: 0.6;
  }

  /* List item */
  .tg-list-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--tg-surface);
    border-radius: var(--radius-md);
    border: 1px solid var(--tg-border);
    margin-bottom: var(--space-sm);
    transition: all 0.2s ease;
  }

  .tg-list-item:hover {
    border-color: var(--tg-link-color);
    box-shadow: var(--shadow-sm);
  }

  /* Action button group */
  .tg-actions {
    display: flex;
    gap: var(--space-sm);
  }

  .tg-action-btn {
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: var(--radius-full);
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tg-action-btn-success {
    background: var(--tg-success-bg);
    color: var(--tg-success);
  }

  .tg-action-btn-success:hover {
    background: var(--tg-success);
    color: white;
    transform: scale(1.1);
  }

  .tg-action-btn-success.active {
    background: var(--tg-success);
    color: white;
  }

  .tg-action-btn-danger {
    background: var(--tg-danger-bg);
    color: var(--tg-danger);
  }

  .tg-action-btn-danger:hover {
    background: var(--tg-danger);
    color: white;
    transform: scale(1.1);
  }

  .tg-action-btn-danger.active {
    background: var(--tg-danger);
    color: white;
  }

  /* Divider */
  .tg-divider {
    height: 1px;
    background: var(--tg-border);
    margin: var(--space-lg) 0;
  }

  /* Success message */
  .tg-success-message {
    background: var(--tg-success-bg);
    color: var(--tg-success);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  /* Header title */
  .tg-header {
    margin-bottom: var(--space-xl);
  }

  .tg-header-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--tg-text-color);
    margin-bottom: var(--space-xs);
    letter-spacing: -0.02em;
  }

  .tg-header-subtitle {
    font-size: 14px;
    color: var(--tg-text-secondary);
  }

  /* Day selector */
  .tg-day-selector {
    display: flex;
    gap: var(--space-sm);
    overflow-x: auto;
    padding-bottom: var(--space-md);
    margin-bottom: var(--space-lg);
    -webkit-overflow-scrolling: touch;
  }

  .tg-day-selector::-webkit-scrollbar {
    display: none;
  }

  .tg-day-btn {
    flex-shrink: 0;
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    background: var(--tg-surface);
    border: 1px solid var(--tg-border);
    cursor: pointer;
    text-align: center;
    min-width: 64px;
    transition: all 0.2s ease;
  }

  .tg-day-btn:hover {
    border-color: var(--tg-link-color);
  }

  .tg-day-btn.active {
    background: var(--tg-button-color);
    color: var(--tg-button-text-color);
    border-color: var(--tg-button-color);
    box-shadow: var(--shadow-md);
  }

  .tg-day-btn-today {
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.05em;
    opacity: 0.8;
  }

  /* Lesson card */
  .tg-lesson-card {
    background: var(--tg-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin-bottom: var(--space-md);
    cursor: pointer;
    border: 1px solid var(--tg-border);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tg-lesson-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-lg);
    border-color: var(--tg-link-color);
  }

  .tg-lesson-time {
    font-size: 17px;
    font-weight: 600;
    color: var(--tg-text-color);
    margin-bottom: var(--space-sm);
  }

  .tg-lesson-group {
    font-size: 15px;
    font-weight: 500;
    color: var(--tg-text-color);
    margin-bottom: var(--space-xs);
  }

  .tg-lesson-course {
    font-size: 13px;
    color: var(--tg-text-secondary);
  }

  .tg-lesson-topic {
    font-size: 13px;
    color: var(--tg-text-color);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--tg-border);
  }

  /* Error state */
  .tg-error {
    background: var(--tg-danger-bg);
    border: 1px solid var(--tg-danger);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin-bottom: var(--space-lg);
  }

  .tg-error-title {
    color: var(--tg-danger);
    font-size: 16px;
    font-weight: 600;
    margin-bottom: var(--space-sm);
  }

  .tg-error-text {
    color: var(--tg-danger);
    font-size: 14px;
    opacity: 0.9;
  }

  /* Form label */
  .tg-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--tg-text-secondary);
    margin-bottom: var(--space-sm);
  }

  /* Report saved indicator */
  .tg-report-saved {
    background: var(--tg-success-bg);
    color: var(--tg-success);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  /* Navbar styles */
  .teacher-navbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--tg-surface);
    border-top: 1px solid var(--tg-border);
    padding: 8px 16px;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
    display: flex;
    justify-content: space-around;
    z-index: 100;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  }

  .teacher-navbar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    border-radius: var(--radius-lg);
    text-decoration: none;
    color: var(--tg-text-secondary);
    transition: all 0.2s ease;
    min-width: 70px;
  }

  .teacher-navbar-item:hover {
    background: var(--tg-primary-bg);
  }

  .teacher-navbar-item.active {
    color: var(--tg-link-color);
    background: var(--tg-primary-bg);
  }

  .teacher-navbar-icon {
    font-size: 20px;
    margin-bottom: 4px;
  }

  .teacher-navbar-label {
    font-size: 11px;
    font-weight: 500;
  }
`;

export default function TeacherAppLayout({ children }: { children: ReactNode }) {
  return (
    <TelegramWebAppProvider>
      <TeacherAppContent>{children}</TeacherAppContent>
    </TelegramWebAppProvider>
  );
}
