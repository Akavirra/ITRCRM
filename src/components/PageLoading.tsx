'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';

// ── Icons ────────────────────────────────────────────────────────────────────

const ProcessorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="8" y="8" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
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
    <rect x="3" y="10" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="7"  cy="7" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="7" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="17" cy="7" r="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const PaletteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="8"  r="1.5" fill="currentColor"/>
    <circle cx="8"  cy="13" r="1.5" fill="currentColor"/>
    <circle cx="16" cy="13" r="1.5" fill="currentColor"/>
    <circle cx="10" cy="16" r="1.5" fill="currentColor"/>
  </svg>
);

// Малювання на планшеті — стілус торкається екрану
const TabletPenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="3" y="2" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="10" cy="18" r="0.75" fill="currentColor"/>
    <path d="M15 7l3.5-3.5a1.2 1.2 0 0 1 1.7 1.7L16.7 8.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M15 7l1.7 1.7-1.2 1.2L14 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13.5 9.5L13 12l2.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 3D-моделювання — куб з гранями
const CubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <path d="M12 2L22 7V17L12 22L2 17V7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M12 2V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M2 7L12 12L22 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Анімація — фігура в русі (кадри анімації)
const AnimationIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="2" y="4" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8"  cy="11" r="2" stroke="currentColor" strokeWidth="1.4"/>
    <circle cx="16" cy="11" r="2" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M10 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M6 20h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 18v2M16 18v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Відеозйомка — камера з записом
const VideoCameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M16 10L22 7V17L16 14V10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="6" cy="10" r="1" fill="currentColor"/>
  </svg>
);

// Відеомонтаж — таймлайн зі скісами
const EditVideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 6v12M16 6v12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M2 12h20" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M5 9l3 3-3 3M19 9l-3 3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Palette ───────────────────────────────────────────────────────────────────

const ITEMS = [
  { Icon: ProcessorIcon,  color: '#3b82f6', bg: '#eff6ff', glow: 'rgba(59,130,246,0.13)'  },
  { Icon: CodeIcon,       color: '#f59e0b', bg: '#fffbeb', glow: 'rgba(245,158,11,0.13)'  },
  { Icon: LegoIcon,       color: '#2563eb', bg: '#eff6ff', glow: 'rgba(37,99,235,0.13)'   },
  { Icon: PaletteIcon,    color: '#ec4899', bg: '#fdf2f8', glow: 'rgba(236,72,153,0.13)'  },
  { Icon: TabletPenIcon,  color: '#0ea5e9', bg: '#f0f9ff', glow: 'rgba(14,165,233,0.13)'  },
  { Icon: CubeIcon,       color: '#8b5cf6', bg: '#f5f3ff', glow: 'rgba(139,92,246,0.13)'  },
  { Icon: AnimationIcon,  color: '#10b981', bg: '#ecfdf5', glow: 'rgba(16,185,129,0.13)'  },
  { Icon: VideoCameraIcon,color: '#d97706', bg: '#fffbeb', glow: 'rgba(217,119,6,0.13)'   },
  { Icon: EditVideoIcon,  color: '#ef4444', bg: '#fff1f2', glow: 'rgba(239,68,68,0.13)'   },
];

// Fisher-Yates shuffle — next index ≠ current
function nextRandom(current: number, len: number): number {
  let n: number;
  do { n = Math.floor(Math.random() * len); } while (n === current);
  return n;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PageLoading = () => {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * ITEMS.length));
  const idxRef = useRef(idx);
  idxRef.current = idx;

  useEffect(() => {
    const t = setInterval(() => {
      setIdx(prev => nextRandom(prev, ITEMS.length));
    }, 1100);
    return () => clearInterval(t);
  }, []);

  const { Icon, color, bg, glow } = ITEMS[idx];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#ffffff',
      zIndex: 1000,
    }}>

      {/* Ambient glow blob */}
      <motion.div
        animate={{ opacity: [0.55, 1, 0.55], scale: [0.95, 1.06, 0.95] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          width: 280, height: 280,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          transition: 'background 0.75s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Floating card */}
      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 104, height: 104,
          borderRadius: 28,
          backgroundColor: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 16px 48px ${glow}, 0 4px 12px rgba(0,0,0,0.06)`,
          position: 'relative', overflow: 'hidden',
          transition: 'background-color 0.7s ease, box-shadow 0.7s ease',
          zIndex: 1,
        }}
      >
        {/* Gloss */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(145deg, rgba(255,255,255,0.55) 0%, transparent 60%)',
          borderRadius: 28, pointerEvents: 'none',
        }} />

        {/* Icon */}
        <div style={{ width: 52, height: 52, position: 'relative', zIndex: 1 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.65, y: 10 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={  { opacity: 0, scale: 0.65, y: -10 }}
              transition={{ duration: 0.28, ease: [0.34, 1.2, 0.64, 1] }}
              style={{ position: 'absolute', inset: 0, color }}
            >
              <Icon />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Three breathing dots */}
      <div style={{ display: 'flex', gap: 7, marginTop: 28 }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.5, 1], opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
            style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#3b82f6' }}
          />
        ))}
      </div>

      {/* Label */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        style={{
          margin: '14px 0 0',
          fontSize: 11, fontWeight: 500,
          color: '#b0b8c4',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Завантаження
      </motion.p>

    </div>
  );
};

export default PageLoading;
