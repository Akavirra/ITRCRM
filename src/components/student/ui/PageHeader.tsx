import { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

/**
 * Заголовок сторінки: H1 + підпис + опційна дія праворуч.
 * Замінює inline `<h1 className="student-page-title"> + <p className="student-page-subtitle">`.
 */
export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <header className="student-page-header__content" style={{ marginBottom: 28 }}>
      <div>
        <h1 className="student-page-title">{title}</h1>
        {subtitle && <p className="student-page-subtitle" style={{ marginBottom: 0 }}>{subtitle}</p>}
      </div>
      {action && <div className="student-page-header__action">{action}</div>}
    </header>
  );
}
