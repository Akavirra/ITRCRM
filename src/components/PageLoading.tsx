'use client';

import { motion } from 'motion/react';

// ── Icons ─────────────────────────────────────────────────────────────────────

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

const TabletPenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="3" y="2" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="10" cy="18" r="0.75" fill="currentColor"/>
    <path d="M15 7l3.5-3.5a1.2 1.2 0 0 1 1.7 1.7L16.7 8.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M15 7l1.7 1.7-1.2 1.2L14 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13.5 9.5L13 12l2.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <path d="M12 2L22 7V17L12 22L2 17V7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M12 2V22M2 7L12 12L22 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const AnimationIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="2" y="4" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8"  cy="11" r="2" stroke="currentColor" strokeWidth="1.4"/>
    <circle cx="16" cy="11" r="2" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M10 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M6 20h12M8 18v2M16 18v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const VideoCameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
    <rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M16 10L22 7V17L16 14V10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="6" cy="10" r="1" fill="currentColor"/>
  </svg>
);

// ── Data ──────────────────────────────────────────────────────────────────────

// 8 items arranged at angles 0°, 45°, ..., 315° (top = 0°, clockwise)
// Center of 320×290 container: cx=160, cy=145 | radius=110
// size: px of the card  |  top/left: absolute position
const RING = [
  { Icon: CodeIcon,        color: '#f59e0b', bg: '#fffbeb', shadow: 'rgba(245,158,11,0.22)',   size: 62, top:   5, left: 129 }, // top
  { Icon: CubeIcon,        color: '#8b5cf6', bg: '#f5f3ff', shadow: 'rgba(139,92,246,0.22)',   size: 54, top:  39, left: 210 }, // top-right
  { Icon: ProcessorIcon,   color: '#3b82f6', bg: '#eff6ff', shadow: 'rgba(59,130,246,0.22)',   size: 68, top: 111, left: 238 }, // right
  { Icon: AnimationIcon,   color: '#10b981', bg: '#ecfdf5', shadow: 'rgba(16,185,129,0.22)',   size: 54, top: 195, left: 210 }, // bot-right
  { Icon: VideoCameraIcon, color: '#d97706', bg: '#fff7ed', shadow: 'rgba(217,119,6,0.22)',    size: 62, top: 223, left: 129 }, // bottom
  { Icon: TabletPenIcon,   color: '#0ea5e9', bg: '#f0f9ff', shadow: 'rgba(14,165,233,0.22)',   size: 54, top: 195, left:  54 }, // bot-left
  { Icon: PaletteIcon,     color: '#ec4899', bg: '#fdf2f8', shadow: 'rgba(236,72,153,0.22)',   size: 68, top: 111, left:  14 }, // left
  { Icon: LegoIcon,        color: '#2563eb', bg: '#eff6ff', shadow: 'rgba(37,99,235,0.22)',    size: 54, top:  39, left:  54 }, // top-left
];

// Float: duration (s), CSS animation-delay to offset phase (s)
const FLOAT = [
  { dur: 3.4, delay: 0.0  },
  { dur: 4.1, delay: -1.3 },
  { dur: 3.7, delay: -0.6 },
  { dur: 2.9, delay: -2.1 },
  { dur: 4.3, delay: -0.9 },
  { dur: 3.1, delay: -1.8 },
  { dur: 4.6, delay: -0.3 },
  { dur: 3.8, delay: -2.5 },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const PageLoading = () => (
  <div style={{
    position: 'fixed', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffffff',
    zIndex: 1000,
  }}>

    {/* Ambient glow */}
    <div style={{
      position: 'absolute',
      width: 340, height: 300,
      borderRadius: '50%',
      background: 'radial-gradient(ellipse, rgba(59,130,246,0.055) 0%, transparent 68%)',
      pointerEvents: 'none',
    }} />

    {/* Icon constellation — 320×290 container */}
    <div style={{ position: 'relative', width: 320, height: 290 }}>
      {RING.map(({ Icon, color, bg, shadow, size, top, left }, i) => {
        const { dur, delay } = FLOAT[i];
        const radius = Math.round(size * 0.28);
        const iconSize = Math.round(size * 0.50);

        return (
          /* Entrance: Framer Motion (runs once, spring pop-in) */
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.45, y: 12 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            transition={{
              duration: 0.45,
              delay: i * 0.07,
              type: 'spring',
              stiffness: 180,
              damping: 16,
            }}
            style={{ position: 'absolute', top, left, width: size, height: size }}
          >
            {/* Float: pure CSS on inner wrapper — no conflict with Framer Motion */}
            <div style={{
              width: '100%', height: '100%',
              animation: `pl-float ${dur}s ease-in-out ${delay}s infinite`,
              willChange: 'transform',
            }}>
              {/* Card */}
              <div style={{
                width: '100%', height: '100%',
                borderRadius: radius,
                backgroundColor: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 10px 28px ${shadow}, 0 2px 8px rgba(0,0,0,0.05)`,
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Gloss overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.52) 0%, transparent 58%)',
                  borderRadius: radius, pointerEvents: 'none',
                }} />
                {/* Icon */}
                <div style={{ width: iconSize, height: iconSize, color, position: 'relative', zIndex: 1 }}>
                  <Icon />
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>

    {/* Loading dots */}
    <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 5, height: 5, borderRadius: '50%',
            backgroundColor: '#3b82f6',
            animation: `pl-dot 1.4s ease-in-out ${i * 0.22}s infinite`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>

    {/* Label */}
    <p style={{
      margin: '13px 0 0',
      fontSize: 11, fontWeight: 500,
      color: '#b5bec8',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      animation: 'pl-fadein 0.5s ease 0.6s both',
    }}>
      Завантаження
    </p>

  </div>
);

export default PageLoading;
