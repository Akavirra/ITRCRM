/**
 * /login — форма входу учня в портал.
 *
 * Дві форми введення:
 *   1. Вручну: Код учня (R0042) + PIN (6 цифр)
 *   2. QR-скан (опційно, клієнтський lib ще не підключено — TODO Етап 4)
 *
 * Кнопка "Увійти" шле POST на /api/student/auth/login; якщо успіх —
 * редірект на /dashboard (middleware rewrite'не на /s/dashboard).
 *
 * Query params:
 *   - ?code=R0042 — автозаповнення коду (корисно для QR-посилань)
 *   - ?from=/schedule — куди повернути після логіну (захист від open redirect)
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { STUDENT_COOKIE_NAME, getStudentSession } from '@/lib/student-auth';
import StudentLoginForm from '@/components/student/StudentLoginForm';

export const dynamic = 'force-dynamic';

export default async function StudentLoginPage({
  searchParams,
}: {
  searchParams?: { code?: string; from?: string };
}) {
  // Якщо уже залогінений — одразу на dashboard
  const sessionId = cookies().get(STUDENT_COOKIE_NAME)?.value;
  if (sessionId) {
    const session = await getStudentSession(sessionId);
    if (session) {
      redirect(searchParams?.from && searchParams.from.startsWith('/') ? searchParams.from : '/dashboard');
    }
  }

  return (
    <div className="student-container" style={{ maxWidth: 420 }}>
      <div style={{ textAlign: 'center', padding: '40px 0 24px' }}>
        <div style={{
          width: 72, height: 72, margin: '0 auto 16px',
          background: '#2160d0', color: '#fff',
          borderRadius: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 36, fontWeight: 700,
        }}>IT</div>
        <h1 className="student-page-title" style={{ textAlign: 'center' }}>Портал учня</h1>
        <p className="student-page-subtitle" style={{ textAlign: 'center' }}>
          Введіть код і PIN з вашої картки
        </p>
      </div>

      <div className="student-card" style={{ padding: 20 }}>
        <StudentLoginForm
          initialCode={typeof searchParams?.code === 'string' ? searchParams.code : ''}
          redirectTo={
            typeof searchParams?.from === 'string' && searchParams.from.startsWith('/')
              ? searchParams.from
              : '/dashboard'
          }
        />
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 24 }}>
        Втратили картку? Зверніться до адміністратора школи.
      </p>
    </div>
  );
}
