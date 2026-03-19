'use client';

import { motion } from 'motion/react';

export const PageLoading = () => {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#ffffff',
      zIndex: 1000,
    }}>
      {/* Background soft radial glow */}
      <div style={{
        position: 'absolute',
        width: 300, height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, rgba(255,255,255,0) 70%)',
        pointerEvents: 'none',
      }} />

      {/* Main Animated Minimalist Icon */}
      <motion.div 
        animate={{ y: [-3, 3, -3] }}
        transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
        style={{ position: 'relative', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <motion.svg
          width="72" height="72" viewBox="0 0 64 64" fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Left Bracket - Programming */}
          <motion.path
            d="M22 22L12 32L22 42"
            stroke="#3b82f6" // Primary Blue
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0, x: 5 }}
            animate={{ pathLength: 1, opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
          />

          {/* Right Bracket - Programming */}
          <motion.path
            d="M42 22L52 32L42 42"
            stroke="#3b82f6"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0, x: -5 }}
            animate={{ pathLength: 1, opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
          />

          {/* Curving Center Slash - Graphic Design (Bezier Curve) */}
          <motion.path
            d="M40 16 C30 26, 34 38, 24 48"
            stroke="#3b82f6"
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut", delay: 0.4 }}
          />

          {/* Top Node - Robotics/Circuits */}
          <motion.circle
            cx="40" cy="16" r="3.5"
            fill="#3b82f6"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4, 1], opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          />

          {/* Bottom Node - Robotics/Circuits */}
          <motion.circle
            cx="24" cy="48" r="3.5"
            fill="#3b82f6"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4, 1], opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.4 }}
          />

          {/* Continuous floating pulse applied to the whole SVG via wrapper, 
              but we can also add a nice continuous loop to the path strokes */}
          <motion.path
            d="M40 16 C30 26, 34 38, 24 48"
            stroke="#60a5fa" // Lighter blue for the glowing wave
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, pathOffset: 0, opacity: 0 }}
            animate={{ pathLength: 0.3, pathOffset: 1, opacity: [0, 1, 0] }}
            transition={{ duration: 2.5, ease: "linear", repeat: Infinity, delay: 2 }}
          />
        </motion.svg>
      </motion.div>

      {/* Label section */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        style={{
          marginTop: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8
        }}
      >
        <span style={{
          fontSize: 12, 
          fontWeight: 600,
          color: '#9ca3af', // gray-400
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
        }}>
          Завантаження
        </span>
        
        {/* Subtle dot pulse */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              style={{
                width: 4, height: 4,
                borderRadius: '50%',
                backgroundColor: '#9ca3af'
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default PageLoading;
