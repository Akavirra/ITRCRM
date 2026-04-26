/**
 * Auth-guarded layout teacher-портала (всі сторінки крім /login).
 *
 * Перевіряє cookie teacher_session і відповідний запис у teacher_sessions.
 * Якщо нема — redirect на /login (middleware rewrite'не на /t/login).
 *
 * ВАЖЛИВО: НЕ використовує @/lib/auth (admin), тільки teacher-side.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TEACHER_COOKIE_NAME, getTeacherSession } from '@/lib/teacher-auth';
import { teacherGet } from '@/db/neon-teacher';
import TeacherShell from '@/components/teacher/TeacherShell';

export const dynamic = 'force-dynamic';

export default async function TeacherGuardedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(TEACHER_COOKIE_NAME)?.value;
  if (!sessionId) redirect('/login');

  const session = await getTeacherSession(sessionId);
  if (!session) redirect('/login');

  const user = await teacherGet<{
    id: number;
    name: string;
    email: string;
    role: string;
    photo_url: string | null;
    is_active: boolean;
  }>(`SELECT id, name, email, role, photo_url, is_active FROM users WHERE id = $1`, [
    session.user_id,
  ]);

  if (!user || !user.is_active || user.role !== 'teacher') {
    redirect('/login');
  }

  const teacherData = {
    id: user.id,
    full_name: user.name,
    email: user.email,
    photoUrl: user.photo_url,
  };

  return <TeacherShell teacher={teacherData}>{children}</TeacherShell>;
}
