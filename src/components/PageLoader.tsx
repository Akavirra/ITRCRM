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
            duration: 0.2, 
            ease: 'easeInOut' 
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
        >
          <div className="flex flex-col items-center gap-6">
            {/* Simple flat loader */}
            <div className="relative">
              {/* Main spinner */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ 
                  duration: 1.2, 
                  repeat: Infinity, 
                  ease: 'linear' 
                }}
                className="w-12 h-12"
              >
                <svg viewBox="0 0 48 48" className="w-full h-full">
                  {/* Background circle */}
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#f3f4f6"
                    strokeWidth="4"
                    fill="none"
                  />
                  {/* Progress arc */}
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="url(#loaderGradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray="80"
                    strokeDashoffset="60"
                  />
                  <defs>
                    <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>
                  </defs>
                </svg>
              </motion.div>
            </div>

            {/* Simple loading text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-1"
            >
              <span className="text-sm font-medium text-gray-400">Завантаження</span>
              <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  ease: 'easeInOut' 
                }}
                className="text-sm font-medium text-gray-400"
              >
                ...
              </motion.span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PageLoader;
