'use client';

/**
 * Live-бейдж "Заняття триває" — клієнтський, оновлюється сам щосекунди.
 * Показується рівно в межах [start; end] (без +15хв / +1год — це окреме поняття).
 * Коли заняття ще не почалось — повертає null.
 * Коли закінчилось — показує "Заняття завершилось" (для UX-ясності).
 */

import { useEffect, useState } from 'react';

interface LiveLessonBadgeProps {
  startIso: string;
  endIso: string;
  /** Callback при зміні фази (before → live → after) — можна тригерити router.refresh() */
  onPhaseChange?: (phase: 'before' | 'live' | 'after') => void;
}

type Phase = 'before' | 'live' | 'after';

function computePhase(startMs: number, endMs: number): Phase {
  const now = Date.now();
  if (now < startMs) return 'before';
  if (now > endMs) return 'after';
  return 'live';
}

export default function LiveLessonBadge({ startIso, endIso, onPhaseChange }: LiveLessonBadgeProps) {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  const [phase, setPhase] = useState<Phase>(() => computePhase(startMs, endMs));

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = computePhase(startMs, endMs);
      setPhase((prev) => {
        if (prev !== next) {
          onPhaseChange?.(next);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [startMs, endMs, onPhaseChange]);

  if (phase === 'before') return null;

  if (phase === 'after') {
    return (
      <div className="student-live-badge student-live-badge--after">
        <span className="student-live-badge__dot" />
        Заняття завершилось
      </div>
    );
  }

  return (
    <div className="student-live-badge student-live-badge--live">
      <span className="student-live-badge__dot student-live-badge__dot--pulse" />
      Заняття триває
    </div>
  );
}
