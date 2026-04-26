/**
 * /dashboard — головна сторінка teacher-портала.
 *
 * Phase E.1.1 (фундамент): тимчасовий "hello world" + посилання на logout +
 * заглушки для майбутніх секцій. Реальний дашборд з розкладом — у E.1.2.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  TEACHER_COOKIE_NAME,
  getTeacherSession,
} from '@/lib/teacher-auth';
import { teacherGet } from '@/db/neon-teacher';
import TeacherLogoutButton from '@/components/teacher/TeacherLogoutButton';

export const dynamic = 'force-dynamic';

export default async function TeacherDashboardPage() {
  const sessionId = cookies().get(TEACHER_COOKIE_NAME)?.value;
  if (!sessionId) redirect('/login');
  const session = await getTeacherSession(sessionId);
  if (!session) redirect('/login');

  const user = await teacherGet<{ id: number; name: string }>(
    `SELECT id, name FROM users WHERE id = $1`,
    [session.user_id],
  );

  return (
    <>
      <h1 className="teacher-page-title">
        Вітаю, {user?.name?.split(' ')?.[0] || 'викладач'} 👋
      </h1>
      <p className="teacher-page-subtitle">
        Це фундамент твого кабінету — розклад, заняття та учні зʼявляться тут найближчими днями.
      </p>

      <div className="teacher-info">
        ⚙️ Кабінет у розробці. Поки що Telegram-бот лишається твоїм основним
        інструментом для занять. Тут зʼявляться функції, яких у Telegram немає:
        планування, перевірка робіт, керування ярликами заняття.
      </div>

      <div className="teacher-section-header">Сьогодні</div>
      <div className="teacher-empty">
        Розклад зʼявиться у наступному оновленні (E.1.2).
      </div>

      <div className="teacher-section-header">Найближчі заняття</div>
      <div className="teacher-empty">
        Тиждень — наступне оновлення.
      </div>

      <div style={{ marginTop: 32 }}>
        <TeacherLogoutButton />
      </div>
    </>
  );
}
