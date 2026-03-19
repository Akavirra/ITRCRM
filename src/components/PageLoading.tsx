'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// Laconic, ultra-thin flat minimalist icons
const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const RobotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16.01" />
    <line x1="16" y1="16" x2="16" y2="16.01" />
  </svg>
);

const DesignIcon = () => (
  // Pen tool (bezier curve)
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

const TechIcon = () => (
  // Generic Tech/Node/Connection icon
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const ICONS = [
  { id: 'code', component: CodeIcon, color: '#3b82f6', label: 'Програмування' }, // Blue
  { id: 'robot', component: RobotIcon, color: '#f59e0b', label: 'Робототехніка' }, // Amber
  { id: 'design', component: DesignIcon, color: '#ec4899', label: 'Графічний дизайн' }, // Pink
  { id: 'tech', component: TechIcon, color: '#8b5cf6', label: 'IT Технології' }, // Violet
];

export const PageLoading = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Beautiful slow crossfade between tech aspects every 2.5 seconds
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ICONS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const current = ICONS[index];
  const CurrentIcon = current.component;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#fdfdfd', // Extremely clean, bright white background
      zIndex: 1000,
    }}>

      {/* Main Container */}
      <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Soft, reactive ambient glow taking color from current icon */}
        <motion.div
           style={{
             position: 'absolute', inset: -40,
             borderRadius: '50%',
             filter: 'blur(30px)',
             opacity: 0.15,
             zIndex: 0,
           }}
           animate={{ backgroundColor: current.color }}
           transition={{ duration: 1.5 }}
        />

        {/* Outer Rotating Sleek Tech Ring */}
        <motion.svg 
          width="140" height="140" viewBox="0 0 100 100" 
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, ease: "linear", repeat: Infinity }}
        >
          {/* Subtle background track */}
          <circle cx="50" cy="50" r="46" stroke="#f1f5f9" strokeWidth="1" fill="none" />
          
          {/* Dynamic primary color streak */}
          <motion.circle 
            cx="50" cy="50" r="46" 
            strokeWidth="1.5" 
            fill="none" 
            strokeLinecap="round"
            strokeDasharray="40 250"
            animate={{ stroke: current.color }}
            transition={{ duration: 1.5 }}
          />
        </motion.svg>

        {/* Inner Counter-Rotating Dash Ring */}
        <motion.svg 
          width="140" height="140" viewBox="0 0 100 100" 
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
          animate={{ rotate: -360 }}
          transition={{ duration: 25, ease: "linear", repeat: Infinity }}
        >
          <motion.circle 
            cx="50" cy="50" r="38" 
            strokeWidth="0.5" 
            fill="none" 
            strokeDasharray="4 6"
            opacity="0.4"
            animate={{ stroke: current.color }}
            transition={{ duration: 1.5 }}
          />
        </motion.svg>

        {/* Flawlessly Crossfading Central Emblem */}
        <div style={{ position: 'relative', width: 44, height: 44, zIndex: 2 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, scale: 0.6, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.2, filter: 'blur(4px)' }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              style={{
                position: 'absolute', inset: 0,
                color: current.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <CurrentIcon />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Typography: Crossfading matching label */}
      <div style={{ marginTop: 32, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            style={{
              fontSize: 11, 
              fontWeight: 600,
              color: '#64748b',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
            }}
          >
            {current.label}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Global "Loading / Sync" text */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
        style={{
          marginTop: 10,
          fontSize: 10,
          color: '#cbd5e1',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Завантаження системи...
      </motion.div>
    </div>
  );
};

export default PageLoading;
