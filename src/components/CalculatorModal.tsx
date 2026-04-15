'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Minus } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CalcSession {
  display: string;
  expression: string;
  prevValue: number | null;
  operator: string | null;
  waiting: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  calcSession: CalcSession;
  onSessionChange: (s: CalcSession) => void;
}

type BtnType = 'clear' | 'fn' | 'op' | 'num' | 'eq';

const BTN_STYLE: Record<BtnType, { bg: string; color: string; hover: string }> = {
  clear:  { bg: '#fee2e2', color: '#dc2626', hover: '#fecaca' },
  fn:     { bg: '#f1f5f9', color: '#475569', hover: '#e2e8f0' },
  op:     { bg: '#eff6ff', color: '#2563eb', hover: '#dbeafe' },
  num:    { bg: '#ffffff', color: '#1e293b', hover: '#f8fafc' },
  eq:     { bg: '#2563eb', color: '#ffffff', hover: '#1d4ed8' },
};

function fmt(n: number): string {
  if (!isFinite(n)) return 'Error';
  const s = parseFloat(n.toFixed(10)).toString();
  return s.length > 13 ? parseFloat(n.toPrecision(8)).toString() : s;
}

const INITIAL_SESSION: CalcSession = {
  display: '0',
  expression: '',
  prevValue: null,
  operator: null,
  waiting: false,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CalculatorModal({ isOpen, onClose, onMinimize, calcSession, onSessionChange }: Props) {
  /* ---- local copy of session ---- */
  const [session, setSession] = useState<CalcSession>(INITIAL_SESSION);
  const [mobile, setMobile] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  /* ---- desktop drag state ---- */
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const dragging = useRef(false);
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  /* Sync external session into local when modal opens */
  useEffect(() => {
    if (isOpen) {
      setSession(calcSession);
      setMobile(window.innerWidth < 768);
      setAnimateIn(false);
      requestAnimationFrame(() => setAnimateIn(true));
    }
  }, [isOpen, calcSession]);

  useEffect(() => {
    if (!isOpen) return;

    const onResize = () => {
      setMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen]);

  /* Centre on first open (desktop) */
  useEffect(() => {
    if (isOpen && !mobile && pos.x === -1) {
      setPos({
        x: Math.max(20, window.innerWidth / 2 - 140),
        y: Math.max(60, window.innerHeight / 2 - 220),
      });
    }
  }, [isOpen, mobile]);

  /* Desktop drag listeners */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: origin.current.px + e.clientX - origin.current.mx,
        y: origin.current.py + e.clientY - origin.current.my,
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    dragging.current = true;
    origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  };

  /* ---- Calculator logic ---- */

  const compute = (a: number, b: number, op: string) => {
    if (op === '+') return a + b;
    if (op === '\u2212') return a - b;
    if (op === '\u00d7') return a * b;
    if (op === '\u00f7') return b !== 0 ? a / b : Infinity;
    return b;
  };

  const digit = useCallback((d: string) => {
    setSession(prev => {
      const next = { ...prev };
      if (prev.waiting) {
        next.display = d;
        next.waiting = false;
      } else {
        next.display = prev.display === '0' ? d : prev.display.length >= 14 ? prev.display : prev.display + d;
      }
      onSessionChange(next);
      return next;
    });
  }, [onSessionChange]);

  const dot = useCallback(() => {
    setSession(prev => {
      const next = { ...prev };
      if (prev.waiting) {
        next.display = '0.';
        next.waiting = false;
      } else if (!prev.display.includes('.')) {
        next.display = prev.display + '.';
      }
      onSessionChange(next);
      return next;
    });
  }, [onSessionChange]);

  const op = useCallback((o: string) => {
    setSession(prev => {
      const next = { ...prev };
      const val = parseFloat(prev.display);
      if (prev.prevValue !== null && !prev.waiting) {
        const result = compute(prev.prevValue, val, prev.operator!);
        const s = fmt(result);
        next.prevValue = result;
        next.expression = s + ' ' + o;
      } else {
        next.prevValue = val;
        next.expression = prev.display + ' ' + o;
      }
      next.display = '0';
      next.operator = o;
      next.waiting = true;
      onSessionChange(next);
      return next;
    });
  }, [onSessionChange]);

  const equals = useCallback(() => {
    setSession(prev => {
      if (prev.operator === null || prev.prevValue === null) return prev;
      const next = { ...prev };
      const val = parseFloat(prev.display);
      const result = compute(prev.prevValue, val, prev.operator);
      next.expression = prev.expression + ' ' + prev.display + ' =';
      next.display = fmt(result);
      next.prevValue = null;
      next.operator = null;
      next.waiting = true;
      onSessionChange(next);
      return next;
    });
  }, [onSessionChange]);

  const clear = useCallback(() => {
    const next = { ...INITIAL_SESSION };
    onSessionChange(next);
    setSession(next);
  }, [onSessionChange]);

  const backspace = useCallback(() => {
    setSession(prev => {
      if (prev.waiting) return prev;
      const next = { ...prev };
      next.display = prev.display.length <= 1 ? '0' : prev.display.slice(0, -1);
      onSessionChange(next);
      return next;
    });
  }, [onSessionChange]);

  const toggleSign = useCallback(() => {
    setSession(prev => {
      const next = { ...prev };
      next.display = fmt(-parseFloat(prev.display));
      onSessionChange(next);
      return next;
    });
  }, [onSessionChange]);

  const percent = useCallback(() => {
    setSession(prev => {
      const next = { ...prev };
      next.display = fmt(parseFloat(prev.display) / 100);
      onSessionChange(next);
      return next;
    });
  }, [onSessionChange]);

  /* ---- Keyboard ---- */

  const actionsRef = useRef({ digit, dot, op, equals, backspace, clear, percent, onClose, onMinimize });
  useEffect(() => { actionsRef.current = { digit, dot, op, equals, backspace, clear, percent, onClose, onMinimize }; });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const a = actionsRef.current;
      if ('0123456789'.includes(e.key)) { a.digit(e.key); return; }
      if (e.key === '.') { a.dot(); return; }
      if (e.key === '+') { a.op('+'); return; }
      if (e.key === '-') { a.op('\u2212'); return; }
      if (e.key === '*') { a.op('\u00d7'); return; }
      if (e.key === '/') { e.preventDefault(); a.op('\u00f7'); return; }
      if (e.key === 'Enter' || e.key === '=') { a.equals(); return; }
      if (e.key === 'Backspace') { a.backspace(); return; }
      if (e.key === 'Escape') { a.onClose(); return; }
      if (e.key === 'Delete') { a.clear(); return; }
      if (e.key === '%') { a.percent(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  /* ---- Button grid ---- */

  const { display, expression, prevValue, operator, waiting } = session;

  const BUTTONS: { label: string; type: BtnType; action: () => void }[] = [
    { label: 'C',  type: 'clear', action: clear },
    { label: '\u00b1',  type: 'fn',   action: toggleSign },
    { label: '%',  type: 'fn',   action: percent },
    { label: '\u00f7',  type: 'op',   action: () => op('\u00f7') },
    { label: '7',  type: 'num',  action: () => digit('7') },
    { label: '8',  type: 'num',  action: () => digit('8') },
    { label: '9',  type: 'num',  action: () => digit('9') },
    { label: '\u00d7',  type: 'op',   action: () => op('\u00d7') },
    { label: '4',  type: 'num',  action: () => digit('4') },
    { label: '5',  type: 'num',  action: () => digit('5') },
    { label: '6',  type: 'num',  action: () => digit('6') },
    { label: '\u2212',  type: 'op',   action: () => op('\u2212') },
    { label: '1',  type: 'num',  action: () => digit('1') },
    { label: '2',  type: 'num',  action: () => digit('2') },
    { label: '3',  type: 'num',  action: () => digit('3') },
    { label: '+',  type: 'op',   action: () => op('+') },
    { label: '\u232b',  type: 'fn',   action: backspace },
    { label: '0',  type: 'num',  action: () => digit('0') },
    { label: '.',  type: 'num',  action: dot },
    { label: '=',  type: 'eq',   action: equals },
  ];

  if (!isOpen) return null;

  /* ---- Header buttons (shared) ---- */
  const headerButtons = (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); onMinimize(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0.125rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#ffffff', borderRadius: 6, width: 28, height: 28,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#93c5fd'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'transparent'; }}
      >
        <Minus size={15} strokeWidth={2.5} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0.125rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#ffffff', borderRadius: 6, width: 28, height: 28,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'transparent'; }}
      >
        <X size={15} strokeWidth={2.5} />
      </button>
    </>
  );

  /* ---- Display section (shared) ---- */
  const displaySection = (
    <div style={{ padding: mobile ? '0.75rem 1.25rem 1.5rem' : '0.5rem 1.125rem 1.125rem' }}>
      <div style={{
        fontSize: '0.8125rem', color: '#cbd5e1', height: '1.25rem',
        textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {expression || '\u00a0'}
      </div>
      <div style={{
        fontSize: mobile
          ? (display.length > 12 ? '2.25rem' : display.length > 9 ? '2.75rem' : '3.5rem')
          : (display.length > 10 ? '1.75rem' : '2.5rem'),
        fontWeight: 700,
        color: '#f1f5f9',
        textAlign: 'right',
        lineHeight: 1.15,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.02em',
      }}>
        {display}
      </div>
    </div>
  );

  /* ---- Mobile full-screen ---- */
  if (mobile) {
    return (
      <>
        <style>{`
          @keyframes calcSlideIn {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
        `}</style>
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9900,
          background: '#ffffff',
          display: 'flex', flexDirection: 'column',
          width: '100vw',
          height: '100dvh',
          transform: animateIn ? 'translateY(0)' : 'translateY(100%)',
          transition: animateIn ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
          animation: animateIn ? 'calcSlideIn 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
          userSelect: 'none',
        }}>
          {/* Mobile header */}
          <div style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            flexShrink: 0,
          }}>
            <div style={{
              padding: 'max(0.875rem, env(safe-area-inset-top)) 1rem 0', display: 'flex', alignItems: 'center',
            }}>
              <span style={{
                fontSize: '0.75rem', fontWeight: 700, color: '#ffffff',
                textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1,
              }}>
                {'\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440'}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {headerButtons}
              </div>
            </div>
            {displaySection}
          </div>

          {/* Mobile button grid - fills remaining space */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem', padding: '1rem',
            flex: 1,
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            alignContent: 'stretch',
          }}>
            {BUTTONS.map((btn, i) => {
              const isActiveOp = btn.type === 'op' && operator === btn.label && waiting;
              const c = BTN_STYLE[btn.type];
              return (
                <button
                  key={i}
                  onClick={btn.action}
                  style={{
                    minHeight: 58,
                    borderRadius: 14,
                    border: 'none',
                    background: isActiveOp ? '#2563eb' : c.bg,
                    color: isActiveOp ? 'white' : c.color,
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.1s, transform 0.05s',
                    boxShadow: btn.type === 'eq' ? '0 4px 12px rgba(37,99,235,0.25)' : 'none',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.94)'; }}
                  onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  /* ---- Desktop floating modal ---- */
  if (pos.x === -1) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9900, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute', left: pos.x, top: pos.y,
          width: 272,
          background: 'white',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.07)',
          overflow: 'hidden',
          pointerEvents: 'all',
          userSelect: 'none',
        }}
      >
        {/* Top Section - blue background */}
        <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}>
          {/* Drag handle / header */}
          <div
            onMouseDown={startDrag}
            style={{ padding: '0.75rem 0.875rem 0', display: 'flex', alignItems: 'center', cursor: 'grab' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" style={{ marginRight: '0.375rem', flexShrink: 0 }}>
              <rect x="4" y="2" width="4" height="4" rx="1"/><rect x="10" y="2" width="4" height="4" rx="1"/><rect x="16" y="2" width="4" height="4" rx="1"/>
              <rect x="4" y="8" width="4" height="4" rx="1"/><rect x="10" y="8" width="4" height="4" rx="1"/><rect x="16" y="8" width="4" height="4" rx="1"/>
            </svg>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
              {'\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440'}
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              {headerButtons}
            </div>
          </div>
          {displaySection}
        </div>

        {/* Button grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4375rem', padding: '0.875rem' }}>
          {BUTTONS.map((btn, i) => {
            const isActiveOp = btn.type === 'op' && operator === btn.label && waiting;
            const c = BTN_STYLE[btn.type];
            return (
              <button
                key={i}
                onClick={btn.action}
                style={{
                  padding: '0.8125rem 0',
                  borderRadius: 12,
                  border: 'none',
                  background: isActiveOp ? '#2563eb' : c.bg,
                  color: isActiveOp ? 'white' : c.color,
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.1s, transform 0.05s',
                  boxShadow: btn.type === 'eq' ? '0 4px 12px rgba(37,99,235,0.25)' : 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isActiveOp ? '#1d4ed8' : c.hover; }}
                onMouseLeave={e => { e.currentTarget.style.background = isActiveOp ? '#2563eb' : c.bg; }}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
