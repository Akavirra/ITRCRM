'use client';

/**
 * Live-таймер зворотного відліку до певного моменту (ISO-рядок).
 *
 * Показує Xд Xг Xхв Xс до цільового часу.
 * Коли час настав — викликає onReached (якщо передано) і показує прапорець "почалось".
 */

import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetIso: string;
  /** Текст-підпис над таймером, напр. "До початку" */
  label?: string;
  /** Що показати після того, як час настав */
  reachedLabel?: string;
  /** Callback коли таймер дійшов до 0 (може використовувати router.refresh()) */
  onReached?: () => void;
  /** Компактний режим — один рядок */
  compact?: boolean;
  /** Великий режим — для hero card */
  large?: boolean;
}

function calcRemaining(targetMs: number): {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const total = Math.max(0, targetMs - Date.now());
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / 1000 / 60 / 60) % 24);
  const days = Math.floor(total / 1000 / 60 / 60 / 24);
  return { total, days, hours, minutes, seconds };
}

export default function CountdownTimer({
  targetIso,
  label = 'До початку',
  reachedLabel = 'Почалось',
  onReached,
  compact,
  large,
}: CountdownTimerProps) {
  const targetMs = new Date(targetIso).getTime();
  const [remaining, setRemaining] = useState(() => calcRemaining(targetMs));

  useEffect(() => {
    if (remaining.total <= 0) {
      onReached?.();
      return;
    }
    const id = window.setInterval(() => {
      const next = calcRemaining(targetMs);
      setRemaining(next);
      if (next.total <= 0) {
        window.clearInterval(id);
        onReached?.();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [targetMs, onReached, remaining.total]);

  const wrapperClass = large
    ? 'student-countdown student-countdown--large'
    : compact
      ? 'student-countdown student-countdown--compact'
      : 'student-countdown';

  if (remaining.total <= 0) {
    return (
      <div className={wrapperClass}>
        <div className="student-countdown__label">{reachedLabel}</div>
      </div>
    );
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className={wrapperClass}>
      {!large && <div className="student-countdown__label">{label}</div>}
      <div className="student-countdown__time">
        {remaining.days > 0 && (
          <span className="student-countdown__unit">
            <span className="student-countdown__value">{remaining.days}</span>
            <span className="student-countdown__u">д</span>
          </span>
        )}
        <span className="student-countdown__unit">
          <span className="student-countdown__value">{pad(remaining.hours)}</span>
          <span className="student-countdown__u">г</span>
        </span>
        <span className="student-countdown__unit">
          <span className="student-countdown__value">{pad(remaining.minutes)}</span>
          <span className="student-countdown__u">хв</span>
        </span>
        <span className="student-countdown__unit">
          <span className="student-countdown__value">{pad(remaining.seconds)}</span>
          <span className="student-countdown__u">с</span>
        </span>
      </div>
    </div>
  );
}
