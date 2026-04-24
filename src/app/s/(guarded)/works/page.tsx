/**
 * /works — сторінка робіт учня.
 * Серверний компонент-обгортка. Увесь інтерактивний список + upload —
 * у клієнтському WorksView (він сам підтягує дані через /api/student/works).
 */

import WorksView from '@/components/student/WorksView';

export const dynamic = 'force-dynamic';

export default function StudentWorksPage() {
  return <WorksView />;
}
