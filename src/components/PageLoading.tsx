'use client';

import { motion } from 'motion/react';

// Flat minimalist icons for the different IT aspects
const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const RobotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16.01" />
    <line x1="16" y1="16" x2="16" y2="16.01" />
  </svg>
);

const DesignIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

const GameIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    <path d="M9 12h.01" />
    <path d="M15 12h.01" />
  </svg>
);

const CoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
    <polyline points="12 22 12 12" />
    <polyline points="22 8.5 12 12" />
    <polyline points="2 8.5 12 12" />
  </svg>
);

export const PageLoading = () => {
  // Config for the aspects: Code, Robotics, Design, Game/Tech
  const aspects = [
    { Icon: CodeIcon,   color: '#3b82f6', bg: '#eff6ff', title: 'Code',    x: 0,    y: -65, delay: 0 },
    { Icon: RobotIcon,  color: '#ea580c', bg: '#fff7ed', title: 'Robotics',x: 65,   y: 0,   delay: 0.2 },
    { Icon: DesignIcon, color: '#ec4899', bg: '#fdf2f8', title: 'Design',  x: 0,    y: 65,  delay: 0.4 },
    { Icon: GameIcon,   color: '#8b5cf6', bg: '#f5f3ff', title: 'GameDev', x: -65,  y: 0,   delay: 0.6 },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#f8fafc', // Soft light background for contrast
      zIndex: 1000,
    }}>
      {/* Background soft radial glow */}
      <div style={{
        position: 'absolute',
        width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, rgba(248,250,252,0) 70%)',
        pointerEvents: 'none',
      }} />

      {/* Main IT Hub Concept */}
      <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Connection Lines rendered as an SVG background */}
        <motion.svg 
          style={{ position: 'absolute', width: '100%', height: '100%', inset: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          {aspects.map((aspect, i) => (
            <motion.line
              key={`line-${i}`}
              x1="100" y1="100"
              x2={100 + aspect.x} y2={100 + aspect.y}
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeDasharray="4 4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: aspect.delay }}
            />
          ))}
          {/* Animated data packets flowing from Core to nodes */}
          {aspects.map((aspect, i) => (
            <motion.circle
              key={`packet-${i}`}
              r="3"
              fill={aspect.color}
              initial={{ cx: 100, cy: 100, opacity: 0 }}
              animate={{ 
                cx: [100, 100 + aspect.x], 
                cy: [100, 100 + aspect.y],
                opacity: [0, 1, 0]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                delay: aspect.delay,
                ease: "easeInOut"
              }}
            />
          ))}
        </motion.svg>

        {/* Central Hub Node */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{
            position: 'absolute',
            width: 56, height: 56,
            borderRadius: '16px',
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1e293b',
            zIndex: 10
          }}
        >
          <div style={{ width: 28, height: 28 }}>
            <CoreIcon />
          </div>
        </motion.div>

        {/* Orbiting Specific IT Nodes */}
        {aspects.map((aspect, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
            animate={{ scale: 1, x: aspect.x, y: aspect.y, opacity: 1 }}
            transition={{ type: "spring", stiffness: 150, damping: 15, delay: aspect.delay + 0.3 }}
            whileHover={{ scale: 1.1 }}
            style={{
              position: 'absolute',
              width: 44, height: 44,
              borderRadius: '50%',
              backgroundColor: aspect.bg,
              color: aspect.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 14px 0 rgba(0,0,0,0.05)`,
              border: `1px solid rgba(255,255,255,0.8)`
            }}
          >
            <div style={{ width: 20, height: 20 }}>
              <aspect.Icon />
            </div>
            
            {/* Subtle rotating glow ring for each node */}
            <motion.div
              style={{
                position: 'absolute', inset: -4,
                borderRadius: '50%',
                border: `1px solid ${aspect.color}30`,
                borderTopColor: aspect.color,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        ))}

        {/* Gentle overall floating effect */}
        <motion.div
          style={{ position: 'absolute', inset: 0 }}
          animate={{ rotate: [0, 2, -2, 0] }}
          transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
        />
      </div>

      {/* Label section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        style={{
          marginTop: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12
        }}
      >
        <span style={{
          fontSize: 13, 
          fontWeight: 600,
          color: '#64748b',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
        }}>
          Синхронізація системи
        </span>
        
        {/* Sleek loading bar */}
        <div style={{ 
          width: 140, height: 3, 
          backgroundColor: '#e2e8f0', 
          borderRadius: 4, 
          overflow: 'hidden',
          position: 'relative'
        }}>
          <motion.div
            style={{
              position: 'absolute',
              top: 0, left: 0, bottom: 0,
              width: '40%',
              backgroundColor: '#6366f1',
              borderRadius: 4,
            }}
            animate={{ left: ['-40%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </div>
  );
};

export default PageLoading;
