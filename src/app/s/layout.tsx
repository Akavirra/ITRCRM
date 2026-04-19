/**
 * Root layout студентського порталу (префікс /s/*).
 *
 * Middleware робить rewrite з students.itrobotics.com.ua/<path> → /s/<path>,
 * тому кінцевий користувач бачить чистий URL (без /s/).
 *
 * Цей layout БЕЗ auth-guard — він просто надає студентську базову обгортку
 * (клас `student-root` + стилі). Guard живе глибше — у route group (guarded).
 *
 * НЕ використовує @/lib/auth чи @/db — лише student-side.
 */

import './student.css';

export default function StudentRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="student-root">{children}</div>;
}
