import { CSSProperties } from 'react';

interface Props {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Простий skeleton-блок зі shimmer-анімацією.
 * Анімація і базовий вигляд — у components.css (.student-skeleton).
 */
export function Skeleton({ width = '100%', height = 14, radius, className, style }: Props) {
  return (
    <div
      className={className ? `student-skeleton ${className}` : 'student-skeleton'}
      style={{
        width,
        height,
        borderRadius: radius ?? undefined,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
