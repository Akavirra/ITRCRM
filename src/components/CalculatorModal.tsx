'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
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
  if (!isFinite(n)) return 'Помилка';
  const s = parseFloat(n.toFixed(10)).toString();
  return s.length > 13 ? parseFloat(n.toPrecision(8)).toString() : s;
}

export default function CalculatorModal({ isOpen, onClose }: Props) {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);   // waiting for next operand

  const [pos, setPos] = useState({ x: -1, y: -1 });
  const dragging = useRef(false);
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Centre on first open
  useEffect(() => {
    if (isOpen && pos.x === -1) {
      setPos({ x: Math.max(20, window.innerWidth / 2 - 140), y: Math.max(60, window.innerHeight / 2 - 220) });
    }
  }, [isOpen]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: origin.current.px + e.clientX - origin.current.mx, y: origin.current.py + e.clientY - origin.current.my });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    dragging.current = true;
    origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  };

  // ── Calculator logic ────────────────────────────────────────────────────────

  const compute = (a: number, b: number, op: string) => {
    if (op === '+') return a + b;
    if (op === '−') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b !== 0 ? a / b : Infinity;
    return b;
  };

  const digit = (d: string) => {
    if (waiting) { setDisplay(d); setWaiting(false); }
    else setDisplay(prev => (prev === '0' ? d : prev.length >= 14 ? prev : prev + d));
  };

  const dot = () => {
    if (waiting) { setDisplay('0.'); setWaiting(false); return; }
    if (!display.includes('.')) setDisplay(d => d + '.');
  };

  const op = (o: string) => {
    const val = parseFloat(display);
    if (prevValue !== null && !waiting) {
      const result = compute(prevValue, val, operator!);
      const s = fmt(result);
      setDisplay(s);
      setPrevValue(result);
      setExpression(s + ' ' + o);
    } else {
      setPrevValue(val);
      setExpression(display + ' ' + o);
    }
    setOperator(o);
    setWaiting(true);
  };

  const equals = () => {
    if (operator === null || prevValue === null) return;
    const val = parseFloat(display);
    const result = compute(prevValue, val, operator);
    setExpression(expression + ' ' + display + ' =');
    setDisplay(fmt(result));
    setPrevValue(null);
    setOperator(null);
    setWaiting(true);
  };

  const clear = () => { setDisplay('0'); setPrevValue(null); setOperator(null); setWaiting(false); setExpression(''); };
  const backspace = () => { if (waiting) return; setDisplay(d => d.length <= 1 ? '0' : d.slice(0, -1)); };
  const toggleSign = () => setDisplay(d => fmt(-parseFloat(d)));
  const percent = () => setDisplay(d => fmt(parseFloat(d) / 100));

  // ── Button grid ─────────────────────────────────────────────────────────────

  const BUTTONS: { label: string; type: BtnType; action: () => void }[] = [
    { label: 'C',  type: 'clear', action: clear },
    { label: '±',  type: 'fn',   action: toggleSign },
    { label: '%',  type: 'fn',   action: percent },
    { label: '÷',  type: 'op',   action: () => op('÷') },
    { label: '7',  type: 'num',  action: () => digit('7') },
    { label: '8',  type: 'num',  action: () => digit('8') },
    { label: '9',  type: 'num',  action: () => digit('9') },
    { label: '×',  type: 'op',   action: () => op('×') },
    { label: '4',  type: 'num',  action: () => digit('4') },
    { label: '5',  type: 'num',  action: () => digit('5') },
    { label: '6',  type: 'num',  action: () => digit('6') },
    { label: '−',  type: 'op',   action: () => op('−') },
    { label: '1',  type: 'num',  action: () => digit('1') },
    { label: '2',  type: 'num',  action: () => digit('2') },
    { label: '3',  type: 'num',  action: () => digit('3') },
    { label: '+',  type: 'op',   action: () => op('+') },
    { label: '⌫',  type: 'fn',   action: backspace },
    { label: '0',  type: 'num',  action: () => digit('0') },
    { label: '.',  type: 'num',  action: dot },
    { label: '=',  type: 'eq',   action: equals },
  ];

  if (!isOpen || pos.x === -1) return null;

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
        {/* Drag handle / header — dark */}
        <div
          onMouseDown={startDrag}
          style={{ padding: '0.75rem 0.875rem 0', display: 'flex', alignItems: 'center', cursor: 'grab', background: '#1e293b' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" style={{ marginRight: '0.375rem', flexShrink: 0 }}>
            <rect x="4" y="2" width="4" height="4" rx="1"/><rect x="10" y="2" width="4" height="4" rx="1"/><rect x="16" y="2" width="4" height="4" rx="1"/>
            <rect x="4" y="8" width="4" height="4" rx="1"/><rect x="10" y="8" width="4" height="4" rx="1"/><rect x="16" y="8" width="4" height="4" rx="1"/>
          </svg>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>Калькулятор</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', borderRadius: 6, width: 24, height: 24 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Display — dark background */}
        <div style={{ background: '#1e293b', padding: '0.5rem 1.125rem 1.125rem' }}>
          <div style={{ fontSize: '0.6875rem', color: '#64748b', height: '1.25rem', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {expression || '\u00a0'}
          </div>
          <div style={{
            fontSize: display.length > 10 ? '1.75rem' : '2.5rem',
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
