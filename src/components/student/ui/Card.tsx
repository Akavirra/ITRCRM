import { ElementType, ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'default' | 'highlighted' | 'live';

interface Props {
  variant?: Variant;
  className?: string;
  children: ReactNode;
  as?: ElementType;
}

/**
 * Базова картка студентського порталу.
 *
 * - `default`     — фон var(--st-bg-card), тонкий border, sm shadow.
 * - `highlighted` — accent-stripe згори (як на dashboard hero).
 * - `live`        — синій градієнт + accent border (для активного заняття).
 *
 * Розмітка: <div className="student-card[ student-card--{variant}]">…</div>.
 * Стилі живуть у styles/components.css.
 */
export function Card({ variant = 'default', className, children, as: Tag = 'div' }: Props) {
  return (
    <Tag
      className={cn(
        'student-card',
        variant !== 'default' && `student-card--${variant}`,
        className,
      )}
    >
      {children}
    </Tag>
  );
}
