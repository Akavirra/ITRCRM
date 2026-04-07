import StudentsPageClient from './StudentsPageClient';
import { getStudentsFilterBootstrap } from '@/lib/students-page';

export default async function StudentsPage() {
  const initialFilters = await getStudentsFilterBootstrap();
  return <StudentsPageClient initialFilters={initialFilters} />;
}
