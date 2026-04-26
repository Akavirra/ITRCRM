/**
 * Root layout кабінету викладача (префікс /t/*).
 *
 * Middleware робить rewrite з teacher.itrobotics.com.ua/<path> → /t/<path>,
 * тож кінцевий користувач бачить чистий URL.
 *
 * Цей layout БЕЗ auth-guard — він просто надає базову обгортку (клас teacher-root + стилі).
 * Guard живе глибше — у route group (guarded).
 *
 * НЕ використовує @/lib/auth чи @/db — лише teacher-side.
 */

import './teacher.css';

export default function TeacherRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="teacher-root">{children}</div>;
}
