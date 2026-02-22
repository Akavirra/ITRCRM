'use client';

import { motion } from 'motion/react';

interface PageLoadingProps {
  message?: string;
}

export const PageLoading = ({ message = 'Завантаження' }: PageLoadingProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ 
            duration: 1, 
            repeat: Infinity, 
            ease: 'linear' 
          }}
          style={{ width: '24px', height: '24px' }}
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
        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-sm font-medium">{message}</span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: 'easeInOut' 
            }}
            className="text-gray-500 text-sm font-medium"
          >
            ...
          </motion.span>
        </div>
      </div>
    </div>
  );
};

export default PageLoading;
