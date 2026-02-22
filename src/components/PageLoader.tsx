'use client';

import { motion } from 'motion/react';

// SVG Icons for each theme
const RoboticsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="8" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="19" cy="15" r="2" fill="currentColor" />
    <circle cx="29" cy="15" r="2" fill="currentColor" />
    <rect x="18" y="22" width="12" height="3" rx="1" fill="currentColor" />
    <rect x="12" y="26" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
    <rect x="32" y="26" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
    <rect x="16" y="36" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
    <rect x="26" y="36" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const CodeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M16 14L8 24L16 34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M32 14L40 24L32 34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M28 10L20 38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const DesignIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M24 6L40 14V34L24 42L8 34V14L24 6Z" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="24" cy="24" r="2" fill="currentColor" />
  </svg>
);

const LegoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="20" width="32" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="14" cy="16" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="24" cy="16" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="34" cy="16" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="14" cy="40" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="24" cy="40" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="34" cy="40" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const DrawingIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M38 8L34 4L10 28L4 42L16 38L38 16L42 12L38 8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
    <path d="M34 4L38 8L42 12L38 16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
    <circle cx="36" cy="10" r="2" fill="currentColor" />
  </svg>
);

const VideoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="12" width="28" height="24" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M32 20L40 16V32L32 28V20Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
    <circle cx="15" cy="20" r="2" fill="currentColor" />
  </svg>
);

// Theme configurations
const themes = [
  { Icon: RoboticsIcon, color: 'text-blue-500', delay: 0 },
  { Icon: CodeIcon, color: 'text-yellow-400', delay: 0.15 },
  { Icon: DesignIcon, color: 'text-blue-500', delay: 0.3 },
  { Icon: LegoIcon, color: 'text-yellow-400', delay: 0.45 },
  { Icon: DrawingIcon, color: 'text-blue-500', delay: 0.6 },
  { Icon: VideoIcon, color: 'text-yellow-400', delay: 0.75 },
];

interface PageLoaderProps {
  isLoading: boolean;
}

export const PageLoader = ({ isLoading }: PageLoaderProps) => {
  console.log('[PageLoader] Rendering, isLoading:', isLoading);
  if (!isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
    >
      {/* Background Pattern - Subtle Grid */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, #3b82f6 1px, transparent 1px),
              linear-gradient(to bottom, #3b82f6 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Main Loader Container */}
      <div className="relative flex flex-col items-center">
        
        {/* Animated Icons Circle */}
        <div className="relative w-56 h-56">
          {/* Outer rotating ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          >
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <circle
                cx="100"
                cy="100"
                r="90"
                stroke="#3b82f6"
                strokeWidth="1"
                strokeDasharray="8 12"
                strokeLinecap="round"
                fill="none"
                opacity="0.3"
              />
            </svg>
          </motion.div>

          {/* Inner ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-4"
          >
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <circle
                cx="100"
                cy="100"
                r="80"
                stroke="#fbbf24"
                strokeWidth="1"
                strokeDasharray="4 16"
                strokeLinecap="round"
                fill="none"
                opacity="0.3"
              />
            </svg>
          </motion.div>

          {/* Central pulsing glow */}
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-100 to-yellow-50 blur-xl" />
          </motion.div>

          {/* Icons positioned in circle */}
          {themes.map(({ Icon, color }, index) => {
            const angle = (index * 60 - 90) * (Math.PI / 180);
            const radius = 70;
            const x = 112 + radius * Math.cos(angle);
            const y = 112 + radius * Math.sin(angle);
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                }}
                transition={{ 
                  duration: 0.4, 
                  ease: 'easeOut'
                }}
                className="absolute"
                style={{
                  left: x - 20,
                  top: y - 20,
                }}
              >
                <motion.div
                  animate={{ 
                    y: [0, -4, 0],
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    ease: 'easeInOut'
                  }}
                  className={`w-10 h-10 flex items-center justify-center ${color}`}
                >
                  <Icon className="w-9 h-9" />
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-12 w-40"
        >
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #3b82f6 0%, #fbbf24 50%, #3b82f6 100%)',
                backgroundSize: '200% 100%'
              }}
            />
          </div>
        </motion.div>

        {/* Decorative dots */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 flex gap-2"
        >
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={{ 
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.8, 0.3]
              }}
              transition={{ 
                duration: 1.2, 
                repeat: Infinity, 
                delay: i * 0.2,
                ease: 'easeInOut'
              }}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: i % 2 === 0 ? '#3b82f6' : '#fbbf24'
              }}
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default PageLoader;
