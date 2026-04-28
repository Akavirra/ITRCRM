/**
 * /works — сторінка робіт учня.
 * Серверний header, клієнтський інтерактивний список.
 */

import WorksView from '@/components/student/WorksView';
import { PageHeader } from '@/components/student/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function StudentWorksPage() {
  return (
    <>
      <PageHeader
        title="Мої роботи"
        subtitle="Усі файли, які ти завантажив(ла) — згруповані по заняттях."
      />
      <WorksView />
    </>
  );
}
