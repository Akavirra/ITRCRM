'use client';

import { motion, AnimatePresence } from 'motion/react';

interface PageLoaderProps {
  isLoading: boolean;
}

export const PageLoader = ({ isLoading }: PageLoaderProps) => {
  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          key="page-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ 
            duration: 0.15, 
            ease: 'easeOut' 
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
        >
          <div className="flex flex-col items-center gap-4">
            {/* Simple flat spinner */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ 
                duration: 1, 
                repeat: Infinity, 
                ease: 'linear' 
              }}
              className="w-8 h-8"
            >
              <svg viewBox="0 0 32 32" className="w-full h-full">
                {/* Background circle */}
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                  fill="none"
                />
                {/* Progress arc */}
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray="88"
                  strokeDashoffset="66"
                />
              </svg>
            </motion.div>

            {/* Loading text */}
            <span className="text-sm text-gray-400 font-medium">
              Завантаження...
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PageLoader;
