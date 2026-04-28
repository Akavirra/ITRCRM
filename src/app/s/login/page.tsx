/**
 * /login — форма входу учня в портал.
 *
 * Дві форми введення:
 *   1. Вручну: код учня (R0042) + PIN (6 цифр)
 *   2. QR-скан (TODO Етап 4)
 *
 * Query params:
 *   - ?code=R0042 — автозаповнення коду (для QR-посилань)
 *   - ?from=/schedule — куди повернути після логіну (захист від open redirect)
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Bot } from 'lucide-react';
import { STUDENT_COOKIE_NAME, getStudentSession } from '@/lib/student-auth';
import StudentLoginForm from '@/components/student/StudentLoginForm';

export const dynamic = 'force-dynamic';

export default async function StudentLoginPage({
  searchParams,
}: {
  searchParams?: { code?: string; from?: string };
}) {
  const sessionId = cookies().get(STUDENT_COOKIE_NAME)?.value;
  if (sessionId) {
    const session = await getStudentSession(sessionId);
    if (session) {
      redirect(
        searchParams?.from && searchParams.from.startsWith('/')
          ? searchParams.from
          : '/dashboard'
      );
    }
  }

  return (
    <main className="student-login">
      <div className="student-login__inner">
        <div className="student-login__brand">
          <span className="student-login__brand-icon">
            <Bot size={22} strokeWidth={1.75} />
          </span>
          <span>ITRobotics</span>
        </div>

        <h1 className="student-login__title">Портал учня</h1>
        <p className="student-login__subtitle">Введіть код і PIN з вашої картки</p>

        <div className="student-login__card">
          <StudentLoginForm
            initialCode={typeof searchParams?.code === 'string' ? searchParams.code : ''}
            redirectTo={
              typeof searchParams?.from === 'string' && searchParams.from.startsWith('/')
                ? searchParams.from
                : '/dashboard'
            }
          />
        </div>

        <p className="student-login__hint">Втратили картку? Зверніться до адміністратора школи.</p>
      </div>
    </main>
  );
}
