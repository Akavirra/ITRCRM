'use client';

import { useEffect, useState } from 'react';

export default function AnimatedNumber({
  value,
  duration = 800,
  formatFn,
}: {
  value: number;
  duration?: number;
  formatFn?: (val: number) => React.ReactNode;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    // We capture the current display value in the ref-like way by reading it from state 
    // at the moment the effect fires (which is when `value` changes).
    const startValue = displayValue;
    const endValue = value;

    if (startValue === endValue) return;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);

      // easeOutExpo for a snappy, modern feel
      const easeOut = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
      const currentVal = Math.round(startValue + (endValue - startValue) * easeOut);
      
      setDisplayValue(currentVal);

      if (percentage < 1) {
        requestAnimationFrame(animate);
      }
    };

    const frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]); // Intentionally omitting displayValue so it only restarts when `value` changes

  return <span suppressHydrationWarning>{formatFn ? formatFn(displayValue) : displayValue}</span>;
}
