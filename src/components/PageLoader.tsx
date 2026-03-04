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
            ease: 'easeOut' 
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50"
        >
          <div className="flex flex-col items-center gap-5">
            {/* Logo/Brand */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="text-2xl font-bold text-blue-600"
            >
              ITRobotics
            </motion.div>

            {/* Simple spinner */}
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
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="#e2e8f0"
                  strokeWidth="3"
                  fill="none"
                />
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PageLoader;
