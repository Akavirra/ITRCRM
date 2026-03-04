'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';

// SVG Icons for each theme
const ProcessorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <rect x="8" y="8" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M12 2V4M12 20V22M2 12H4M20 12H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <path d="M8 6L3 12L8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 6L21 12L16 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 4L10 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const LegoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="3" y="10" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="12" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="17" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

const PaletteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="12" cy="8" r="2" fill="currentColor"/>
    <circle cx="8" cy="12" r="2" fill="currentColor"/>
    <circle cx="16" cy="12" r="2" fill="currentColor"/>
    <circle cx="10" cy="15" r="1.5" fill="currentColor"/>
  </svg>
);

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <path d="M17 3L21 7L11 17H7V13L17 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <path d="M8 14L3 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const VideoCameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M16 10L22 7V17L16 14V10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
  </svg>
);

const icons = [
  { Icon: ProcessorIcon, color: '#3b82f6', name: 'Робототехніка' },
  { Icon: CodeIcon, color: '#fbbf24', name: 'Програмування' },
  { Icon: LegoIcon, color: '#2563eb', name: 'LEGO-конструювання' },
  { Icon: PaletteIcon, color: '#facc15', name: 'Дизайн' },
  { Icon: PencilIcon, color: '#38bdf8', name: 'Малювання' },
  { Icon: VideoCameraIcon, color: '#eab308', name: 'Відеозйомка' },
];

// Orbital element component
const OrbitalElement = ({ delay }: { delay: number }) => {
  return (
    <div style={{
      position: 'absolute',
      width: '400px',
      height: '400px',
      pointerEvents: 'none',
    }}>
      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 8,
          height: 8,
          backgroundColor: '#fbbf24',
          borderRadius: '2px',
          boxShadow: '0 2px 8px rgba(251, 191, 36, 0.5)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay }}
      >
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 8,
          height: 8,
          backgroundColor: '#fbbf24',
          borderRadius: '2px',
          transform: 'translate(-50%, -50%) translateY(-150px)',
        }} />
      </motion.div>
    </div>
  );
};

export const PageLoading = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Cycle through icons every 0.8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % icons.length);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Progress bar animation - fills from 0 to 100% every 2 seconds
  useEffect(() => {
    const duration = 2000;
    const interval = 50;
    const increment = 100 / (duration / interval);
    
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0;
        return prev + increment;
      });
    }, interval);
    
    return () => clearInterval(progressInterval);
  }, []);

  const { Icon: CurrentIcon, color } = icons[currentIndex];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      zIndex: 1000,
      overflow: 'hidden',
    }}>
      {/* Container for all animated elements */}
      <div style={{ position: 'relative', width: 400, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Outer dashed ring */}
        <motion.div
          style={{
            position: 'absolute',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            border: '2px dashed #93c5fd',
            opacity: 0.5,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />

        {/* Orbital elements - three yellow squares rotating around center */}
        <OrbitalElement delay={0} />
        <OrbitalElement delay={1.33} />
        <OrbitalElement delay={2.66} />

        {/* Central block */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 20 }}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '32px',
            backgroundColor: '#ffffff',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            zIndex: 1,
          }}
        >
          {/* Scanning beam */}
          <motion.div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
              opacity: 0.6,
            }}
            animate={{
              top: ['0%', '100%', '100%', '0%'],
              opacity: [0.6, 0.6, 0, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Morphing icon */}
          <div style={{ width: '56px', height: '56px', position: 'relative' }}>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentIndex}
                initial={{ 
                  opacity: 0, 
                  scale: 0.5, 
                  rotate: -180,
                }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  rotate: 0,
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 1.5, 
                  rotate: 180,
                }}
                transition={{ 
                  duration: 0.4, 
                  type: 'spring',
                  stiffness: 300,
                  damping: 25,
                }}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  color: color,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
                }}
              >
                <CurrentIcon />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Progress bar */}
      <motion.div
        style={{
          marginTop: '48px',
          width: '200px',
          height: '2px',
          backgroundColor: '#e5e7eb',
          borderRadius: '1px',
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{
            height: '100%',
            backgroundColor: '#3b82f6',
            borderRadius: '1px',
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.05, ease: 'linear' }}
        />
      </motion.div>

      {/* System initializing text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{
          marginTop: '16px',
          fontFamily: "'Roboto', 'Segoe UI', sans-serif",
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '0.25em',
          color: '#9ca3af',
          textTransform: 'uppercase',
        }}
      >
        System Initializing
      </motion.div>
    </div>
  );
};

export default PageLoading;
