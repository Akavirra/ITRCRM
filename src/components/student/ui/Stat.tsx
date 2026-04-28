import { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  align?: 'left' | 'center';
}

/**
 * Невелика статистична метрика: великий value + дрібний label.
 * Використовується в attendance/group detail для коротких показників.
 */
export function Stat({ label, value, hint, align = 'left' }: Props) {
  return (
    <div className={`student-stat student-stat--${align}`}>
      <div className="student-stat__label">{label}</div>
      <div className="student-stat__value">{value}</div>
      {hint && <div className="student-stat__hint">{hint}</div>}
    </div>
  );
}
