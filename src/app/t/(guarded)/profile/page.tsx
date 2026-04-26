/**
 * /profile — профіль викладача (E.1.6, фінальний крок MVP).
 *
 * Read-only довідка: фото, ім'я, email, phone, telegram_id + кнопка вийти.
 * Зміна пароля — лише через адміна (як домовились), тут просто інструкція.
 *
 * Особливість: email/phone/telegram_id НЕ в GRANT для crm_teacher (захист
 * від читання чужих контактів). Тому свої контакти читаємо ОДНОРАЗОВО
 * через admin-клієнт `@/db.get`. Це cross-role pattern як у login.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TEACHER_COOKIE_NAME, getTeacherSession } from '@/lib/teacher-auth';
import { teacherGet } from '@/db/neon-teacher';
import { get as adminGet } from '@/db';
import TeacherLogoutButton from '@/components/teacher/TeacherLogoutButton';

export const dynamic = 'force-dynamic';

const KYIV_TZ = 'Europe/Kyiv';

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KYIV_TZ,
  }).format(new Date(iso));
}

function avatarLetter(name: string): string {
  const t = (name || '').trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

export default async function TeacherProfilePage() {
  const sessionId = cookies().get(TEACHER_COOKIE_NAME)?.value;
  if (!sessionId) redirect('/login');
  const session = await getTeacherSession(sessionId);
  if (!session) redirect('/login');

  // Базова частина — через teacher-роль (без email/phone/telegram_id у GRANT)
  const baseUser = await teacherGet<{
    id: number;
    name: string;
    photo_url: string | null;
    is_active: boolean;
  }>(`SELECT id, name, photo_url, is_active FROM users WHERE id = $1`, [
    session.user_id,
  ]);
  if (!baseUser || !baseUser.is_active) redirect('/login');

  // Чутлива частина — через admin-роль, ТІЛЬКИ свій профіль (WHERE id = $1)
  const contactInfo = await adminGet<{
    email: string | null;
    phone: string | null;
    telegram_id: string | null;
  }>(`SELECT email, phone, telegram_id FROM users WHERE id = $1`, [session.user_id]);

  // Активні teacher-сесії (інші пристрої, де я зараз залогінений)
  const sessionStats = await teacherGet<{ active_count: number; current_seen: string }>(
    `SELECT COUNT(*)::int AS active_count,
            (SELECT created_at FROM teacher_sessions WHERE id = $1 LIMIT 1) AS current_seen
     FROM teacher_sessions
     WHERE user_id = $2 AND expires_at > NOW()`,
    [sessionId, session.user_id],
  );
  const activeSessions = Number(sessionStats?.active_count ?? 1);

  return (
    <>
      <h1 className="teacher-page-title">Профіль</h1>
      <p className="teacher-page-subtitle">
        Дані які зберігає школа про тебе. Якщо щось треба змінити — звернись до
        адміністратора.
      </p>

      <div className="teacher-card teacher-profile-card">
        <div className="teacher-profile-card__avatar">
          {baseUser.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={baseUser.photo_url} alt={baseUser.name} />
          ) : (
            <span>{avatarLetter(baseUser.name)}</span>
          )}
        </div>
        <div className="teacher-profile-card__main">
          <div className="teacher-profile-card__name">{baseUser.name}</div>
          {contactInfo?.email && (
            <div className="teacher-profile-card__email">{contactInfo.email}</div>
          )}
          <div
            className="teacher-lesson-badge"
            style={{
              background: '#ecfdf5',
              color: '#047857',
              marginTop: 6,
              alignSelf: 'flex-start',
            }}
          >
            Активний
          </div>
        </div>
      </div>

      <div className="teacher-section-header">Контакти</div>
      <div className="teacher-card">
        <dl className="teacher-profile-list">
          <div className="teacher-profile-list__row">
            <dt>Email</dt>
            <dd>{contactInfo?.email || '—'}</dd>
          </div>
          <div className="teacher-profile-list__row">
            <dt>Телефон</dt>
            <dd>
              {contactInfo?.phone ? (
                <a href={`tel:${contactInfo.phone}`} className="teacher-profile-list__link">
                  {contactInfo.phone}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="teacher-profile-list__row">
            <dt>Telegram ID</dt>
            <dd>
              {contactInfo?.telegram_id ? (
                <code style={{ fontSize: 13 }}>{contactInfo.telegram_id}</code>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="teacher-section-header">Безпека</div>
      <div className="teacher-card">
        <dl className="teacher-profile-list">
          <div className="teacher-profile-list__row">
            <dt>Активних сесій</dt>
            <dd>
              {activeSessions} {activeSessions === 1 ? 'пристрій' : 'пристрої(в)'}
            </dd>
          </div>
          <div className="teacher-profile-list__row">
            <dt>Поточна сесія створена</dt>
            <dd>
              {sessionStats?.current_seen
                ? formatDateTime(String(sessionStats.current_seen))
                : '—'}
            </dd>
          </div>
        </dl>

        <div className="teacher-info" style={{ marginTop: 14 }}>
          🔑 Щоб змінити пароль — звернись до адміністратора школи. Він скине
          тимчасовий пароль і передасть тобі.
        </div>
      </div>

      <div className="teacher-section-header">Сесія</div>
      <div className="teacher-card">
        <p
          style={{
            margin: '0 0 12px',
            color: '#475569',
            fontSize: 14,
          }}
        >
          Натисни «Вийти», щоб закрити поточну сесію в цьому браузері. Інші
          пристрої залишаться залогінені.
        </p>
        <TeacherLogoutButton />
      </div>
    </>
  );
}
