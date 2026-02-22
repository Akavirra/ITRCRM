'use client';

import { motion } from 'motion/react';

interface PageLoadingProps {
  message?: string;
}

export const PageLoading = ({ message = 'Завантаження' }: PageLoadingProps) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* Spinner */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ 
            duration: 1, 
            repeat: Infinity, 
            ease: 'linear' 
          }}
          style={{ width: '32px', height: '32px' }}
        >
          <svg viewBox="0 0 24 24" style={{ width: '100%', height: '100%' }}>
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="#e2e8f0"
              strokeWidth="2"
              fill="none"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              strokeDasharray="63"
              strokeDashoffset="47"
            />
          </svg>
        </motion.div>

        {/* Loading text with animated dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#6b7280', fontSize: '14px', fontWeight: 500 }}>{message}</span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: 'easeInOut' 
            }}
            style={{ color: '#6b7280', fontSize: '14px', fontWeight: 500 }}
          >
            ...
          </motion.span>
        </div>
      </div>
    </div>
  );
};

export default PageLoading;
