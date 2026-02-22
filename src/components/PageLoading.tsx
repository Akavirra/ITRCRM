'use client';

import { motion } from 'motion/react';

// SVG Icons for each theme
const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <path d="M8 6L3 12L8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 6L21 12L16 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 4L10 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const DesignIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <path d="M12 2L20 6V18L12 22L4 18V6L12 2Z" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M16 10L22 7V17L16 14V10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none"/>
  </svg>
);

const LegoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="3" y="10" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="7" r="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="17" cy="7" r="2" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

const icons = [
  { Icon: CodeIcon, color: '#3b82f6' },      // Синій - програмування
  { Icon: DesignIcon, color: '#fbbf24' },    // Жовтий - дизайн
  { Icon: VideoIcon, color: '#3b82f6' },     // Синій - відео
  { Icon: LegoIcon, color: '#fbbf24' },      // Жовтий - лего
];

export const PageLoading = () => {
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
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px'
      }}>
        {icons.map(({ Icon, color }, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: [0.4, 1, 0.4],
              y: [0, -8, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              delay: index * 0.2,
              ease: 'easeInOut'
            }}
            style={{
              width: '40px',
              height: '40px',
              color: color,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
            }}
          >
            <Icon />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PageLoading;
