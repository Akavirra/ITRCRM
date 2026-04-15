'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import CalculatorModal from '@/components/CalculatorModal';
import CalculatorWidget from '@/components/CalculatorWidget';

interface CalcSession {
  display: string;
  expression: string;
  prevValue: number | null;
  operator: string | null;
  waiting: boolean;
}

interface CalculatorContextValue {
  calcOpen: boolean;
  calcMinimized: boolean;
  toggleCalc: () => void;
  openCalc: () => void;
  closeCalc: () => void;
}

const STORAGE_KEY = 'itrobot-calculator-state';

const INITIAL_SESSION: CalcSession = {
  display: '0',
  expression: '',
  prevValue: null,
  operator: null,
  waiting: false,
};

const CalculatorContext = createContext<CalculatorContextValue>({
  calcOpen: false,
  calcMinimized: false,
  toggleCalc: () => {},
  openCalc: () => {},
  closeCalc: () => {},
});

function loadState(): { isOpen: boolean; isMinimized: boolean; session: CalcSession } | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return {
      isOpen: Boolean(parsed?.isOpen),
      isMinimized: Boolean(parsed?.isMinimized),
      session: {
        display: typeof parsed?.session?.display === 'string' ? parsed.session.display : INITIAL_SESSION.display,
        expression: typeof parsed?.session?.expression === 'string' ? parsed.session.expression : INITIAL_SESSION.expression,
        prevValue: typeof parsed?.session?.prevValue === 'number' ? parsed.session.prevValue : null,
        operator: typeof parsed?.session?.operator === 'string' ? parsed.session.operator : null,
        waiting: Boolean(parsed?.session?.waiting),
      },
    };
  } catch {
    return null;
  }
}

function saveState(state: { isOpen: boolean; isMinimized: boolean; session: CalcSession }) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage write errors */
  }
}

export function useCalculator() {
  return useContext(CalculatorContext);
}

export function CalculatorProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcMinimized, setCalcMinimized] = useState(false);
  const [calcSession, setCalcSession] = useState<CalcSession>(INITIAL_SESSION);

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setCalcOpen(saved.isOpen);
      setCalcMinimized(saved.isOpen ? saved.isMinimized : false);
      setCalcSession(saved.session);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState({
      isOpen: calcOpen,
      isMinimized: calcOpen ? calcMinimized : false,
      session: calcSession,
    });
  }, [hydrated, calcOpen, calcMinimized, calcSession]);

  const openCalc = () => {
    setCalcOpen(true);
    setCalcMinimized(false);
  };

  const minimizeCalc = () => {
    setCalcOpen(true);
    setCalcMinimized(true);
  };

  const restoreCalc = () => {
    setCalcOpen(true);
    setCalcMinimized(false);
  };

  const closeCalc = () => {
    setCalcOpen(false);
    setCalcMinimized(false);
  };

  const toggleCalc = () => {
    if (calcOpen && !calcMinimized) {
      closeCalc();
      return;
    }

    openCalc();
  };

  const value = useMemo(() => ({
    calcOpen,
    calcMinimized,
    toggleCalc,
    openCalc,
    closeCalc,
  }), [calcOpen, calcMinimized]);

  return (
    <CalculatorContext.Provider value={value}>
      {children}
      {hydrated && calcOpen && !calcMinimized && (
        <CalculatorModal
          isOpen={calcOpen}
          onClose={closeCalc}
          onMinimize={minimizeCalc}
          calcSession={calcSession}
          onSessionChange={setCalcSession}
        />
      )}
      {hydrated && calcOpen && calcMinimized && (
        <CalculatorWidget
          onRestore={restoreCalc}
          onClose={closeCalc}
        />
      )}
    </CalculatorContext.Provider>
  );
}
