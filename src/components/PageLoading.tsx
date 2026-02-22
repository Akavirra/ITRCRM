'use client';

import { motion } from 'motion/react';

interface PageLoadingProps {
  message?: string;
}

export const PageLoading = ({ message = 'Завантаження' }: PageLoadingProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-5">
        {/* Spinner */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ 
            duration: 1, 
            repeat: Infinity, 
            ease: 'linear' 
          }}
          className="w-10 h-10"
        >
          <svg viewBox="0 0 40 40" className="w-full h-full">
            <circle
              cx="20"
              cy="20"
              r="18"
              stroke="#e2e8f0"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="20"
              cy="20"
              r="18"
              stroke="#3b82f6"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              strokeDasharray="113"
              strokeDashoffset="85"
            />
          </svg>
        </motion.div>

        {/* Loading text with animated dots */}
        <div className="flex items-center gap-1">
          <span className="text-gray-500 font-medium">{message}</span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: 'easeInOut' 
            }}
            className="text-gray-500 font-medium"
          >
            ...
          </motion.span>
        </div>
      </div>
    </div>
  );
};

export default PageLoading;
