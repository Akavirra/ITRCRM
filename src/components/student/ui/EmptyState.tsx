import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface Props {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  variant?: 'card' | 'inline';
}

/**
 * Уніфікований empty state — для списків, секцій без даних.
 *
 * `card`   — фон muted, dashed border, центроване (за замовчуванням).
 * `inline` — без фону, для невеликих секцій усередині картки.
 */
export function EmptyState({ icon, title, hint, action, variant = 'card' }: Props) {
  const Icon = icon ?? <Inbox size={28} strokeWidth={1.75} />;

  if (variant === 'inline') {
    return (
      <div className="student-empty-state student-empty-state--inline">
        <div className="student-empty-state__icon">{Icon}</div>
        <div className="student-empty-state__title">{title}</div>
        {hint && <div className="student-empty-state__hint">{hint}</div>}
        {action && <div className="student-empty-state__action">{action}</div>}
      </div>
    );
  }

  return (
    <div className="student-empty-state student-empty-state--card">
      <div className="student-empty-state__icon">{Icon}</div>
      <div className="student-empty-state__title">{title}</div>
      {hint && <div className="student-empty-state__hint">{hint}</div>}
      {action && <div className="student-empty-state__action">{action}</div>}
    </div>
  );
}
