'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Calculator, X } from 'lucide-react';

interface Props {
  onRestore: () => void;
  onClose: () => void;
}

const STORAGE_KEY = 'itrobot-calc-widget-pos';

function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function savePos(pos: { x: number; y: number }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
}

export default function CalculatorWidget({ onRestore, onClose }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const dragging = useRef(false);
  const moved = useRef(false);
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const posRef = useRef(pos);

  const clampPos = useCallback((next: { x: number; y: number }) => {
    const maxX = Math.max(12, window.innerWidth - 64);
    const maxY = Math.max(12, window.innerHeight - 64);

    return {
      x: Math.max(12, Math.min(maxX, next.x)),
      y: Math.max(12, Math.min(maxY, next.y)),
    };
  }, []);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    const saved = loadPos();
    const initial = saved ?? { x: window.innerWidth - 76, y: window.innerHeight - 116 };
    const next = clampPos(initial);
    setPos(next);
    posRef.current = next;
    setIsMobileViewport(window.innerWidth < 768);
    requestAnimationFrame(() => setVisible(true));
  }, [clampPos]);

  useEffect(() => {
    const onResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
      setPos(prev => {
        const next = clampPos(prev);
        posRef.current = next;
        savePos(next);
        return next;
      });
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampPos]);

  /* --- mouse drag --- */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      moved.current = true;
      const next = clampPos({
        x: origin.current.px + e.clientX - origin.current.mx,
        y: origin.current.py + e.clientY - origin.current.my,
      });
      setPos(next);
      posRef.current = next;
    };
    const onUp = () => {
      if (dragging.current && moved.current) {
        savePos(posRef.current);
      }
      dragging.current = false;
      moved.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [clampPos]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    moved.current = false;
    origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  };

  /* --- touch drag --- */
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragging.current = true;
    moved.current = false;
    origin.current = { mx: t.clientX, my: t.clientY, px: pos.x, py: pos.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    moved.current = true;
    const t = e.touches[0];
    const next = clampPos({
      x: origin.current.px + t.clientX - origin.current.mx,
      y: origin.current.py + t.clientY - origin.current.my,
    });
    setPos(next);
    posRef.current = next;
  };

  const handleTouchEnd = () => {
    if (dragging.current && moved.current) {
      savePos(posRef.current);
    }
    dragging.current = false;
    moved.current = false;
  };

  /* --- click vs drag --- */
  const handleClick = () => {
    if (!moved.current) {
      onRestore();
    }
  };

  const handleClose = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <>
      <style>{`
        @keyframes widgetScaleIn {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          width: 52,
          height: 52,
          zIndex: 2147483647,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
          transform: visible ? 'scale(1)' : 'scale(0)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
          WebkitTapHighlightColor: 'transparent',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        onMouseEnter={() => setShowClose(true)}
        onMouseLeave={() => setShowClose(false)}
        onTouchStartCapture={() => setShowClose(true)}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Calculator size={22} color="#2563eb" strokeWidth={2} />
        </div>
        {(showClose || isMobileViewport) && (
          <button
            onClick={handleClose}
            onTouchEnd={handleClose}
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#ef4444',
              border: '2px solid #ffffff',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
            aria-label="Закрити калькулятор"
          >
            <X size={10} strokeWidth={3} />
          </button>
        )}
      </div>
    </>
  );
}
