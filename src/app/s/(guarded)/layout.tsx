/**
 * Auth-guarded layout для сторінок студентського порталу (крім /login).
 *
 * Перевіряє cookie student_session і відповідний запис у student_sessions.
 * Якщо немає або прострочена — redirect на /login (клієнт бачить /login,
 * middleware уже rewrite'не на /s/login).
 *
 * ВАЖЛИВО: НЕ використовує @/lib/auth (це admin), ТІЛЬКИ student-side.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  STUDENT_COOKIE_NAME,
  getStudentSession,
  studentIdToCode,
} from '@/lib/student-auth';
import { studentGet } from '@/db/neon-student';
import StudentShell from '@/components/student/StudentShell';

export const dynamic = 'force-dynamic';

export default async function StudentGuardedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(STUDENT_COOKIE_NAME)?.value;

  if (!sessionId) {
    redirect('/login');
  }

  const session = await getStudentSession(sessionId);
  if (!session) {
    redirect('/login');
  }

  const student = await studentGet<{ id: number; full_name: string; is_active: boolean; photo: string | null }>(
    `SELECT id, full_name, is_active, photo FROM students WHERE id = $1`,
    [session.student_id]
  );
  if (!student || !student.is_active) {
    redirect('/login');
  }

  const codeRow = await studentGet<{ code: string }>(
    `SELECT code FROM student_codes WHERE student_id = $1 AND is_active = TRUE`,
    [session.student_id]
  );

  const studentData = {
    id: student.id,
    full_name: student.full_name,
    code: codeRow?.code ?? studentIdToCode(student.id),
    photo: student.photo,
  };

  return <StudentShell student={studentData}>{children}</StudentShell>;
}
