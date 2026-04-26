/**
 * /login — форма входу викладача в портал (teacher.itrobotics.com.ua).
 *
 * Auth: email + пароль (керується адміном через CRM).
 *
 * Query params:
 *   - ?from=/dashboard — куди повернути після логіну (захист від open redirect)
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { TEACHER_COOKIE_NAME, getTeacherSession } from '@/lib/teacher-auth';
import TeacherLoginForm from '@/components/teacher/TeacherLoginForm';

export const dynamic = 'force-dynamic';

export default async function TeacherLoginPage({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  // Якщо вже залогінений — на dashboard
  const sessionId = cookies().get(TEACHER_COOKIE_NAME)?.value;
  if (sessionId) {
    const session = await getTeacherSession(sessionId);
    if (session) {
      const from = searchParams?.from;
      redirect(from && from.startsWith('/') ? from : '/dashboard');
    }
  }

  return (
    <div className="teacher-login-wrapper">
      <div className="teacher-login-card">
        <div className="teacher-login-header">
          <div className="teacher-login-logo">IT</div>
          <h1 className="teacher-page-title" style={{ textAlign: 'center' }}>
            Кабінет викладача
          </h1>
          <p className="teacher-page-subtitle" style={{ textAlign: 'center', marginBottom: 0 }}>
            Увійди, щоб бачити свій розклад і вести заняття
          </p>
        </div>

        <TeacherLoginForm
          redirectTo={
            typeof searchParams?.from === 'string' && searchParams.from.startsWith('/')
              ? searchParams.from
              : '/dashboard'
          }
        />

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 20 }}>
          Забув(ла) пароль? Зверніться до адміністратора школи.
        </p>
      </div>
    </div>
  );
}
