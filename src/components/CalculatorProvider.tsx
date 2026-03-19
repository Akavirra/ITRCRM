'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import CalculatorModal from '@/components/CalculatorModal';

interface CalculatorContextValue {
  calcOpen: boolean;
  toggleCalc: () => void;
}

const CalculatorContext = createContext<CalculatorContextValue>({
  calcOpen: false,
  toggleCalc: () => {},
});

export function useCalculator() {
  return useContext(CalculatorContext);
}

export function CalculatorProvider({ children }: { children: ReactNode }) {
  const [calcOpen, setCalcOpen] = useState(false);
  const toggleCalc = () => setCalcOpen(v => !v);

  return (
    <CalculatorContext.Provider value={{ calcOpen, toggleCalc }}>
      {children}
      <CalculatorModal isOpen={calcOpen} onClose={() => setCalcOpen(false)} />
    </CalculatorContext.Provider>
  );
}
