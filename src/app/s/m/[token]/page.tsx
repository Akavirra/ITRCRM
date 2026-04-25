/**
 * /m/[token] — публічна мобільна сторінка для QR-Upload (Phase C.2).
 *
 * Відкривається на телефоні після сканування QR з десктопа.
 * Аутентифікація — через JWT-токен в URL (НЕ cookie). Сесія десктопу
 * НЕ передається на телефон.
 *
 * Робота:
 *   1. Сервер верифікує токен (підпис, exp, audience).
 *   2. Тягне ім'я учня + тему/час заняття для UI (тільки для відображення —
 *      не використовуємо ці дані для авторизації).
 *   3. Передає token + minimum context в клієнтський компонент MobileUploadForm,
 *      який показує форму вибору файлу й керує upload-flow.
 *
 * При помилці токена — рендеримо м'яке повідомлення з підказкою.
 */

import { studentGet } from '@/db/neon-student';
import { verifyStudentQrToken } from '@/lib/student-qr-token';
import MobileUploadForm from '@/components/student/MobileUploadForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PageProps {
  params: { token: string };
}

interface LessonRow {
  id: number;
  topic: string | null;
  start_datetime: string;
  end_datetime: string;
  course_title: string | null;
  group_title: string | null;
}

export default async function MobileUploadPage({ params }: PageProps) {
  const payload = verifyStudentQrToken(params.token);

  if (!payload) {
    return (
      <div className="student-container student-mobile-page">
        <h1 className="student-page-title">Сесія прострочена</h1>
        <p className="student-page-subtitle">
          QR-код діє 10 хвилин і вже не дійсний. Поверніться до комп&apos;ютера й
          згенеруйте новий код для завантаження.
        </p>
      </div>
    );
  }

  const student = await studentGet<{ id: number; full_name: string; is_active: boolean }>(
    `SELECT id, full_name, is_active FROM students WHERE id = $1`,
    [payload.studentId],
  );

  if (!student || !student.is_active) {
    return (
      <div className="student-container student-mobile-page">
        <h1 className="student-page-title">Доступ закритий</h1>
        <p className="student-page-subtitle">
          Обліковий запис недоступний. Зверніться до адміністратора.
        </p>
      </div>
    );
  }

  const lesson = await studentGet<LessonRow>(
    `SELECT
       l.id,
       l.topic,
       l.start_datetime,
       l.end_datetime,
       c.title AS course_title,
       g.title AS group_title
     FROM lessons l
     LEFT JOIN courses c ON c.id = l.course_id
     LEFT JOIN groups g ON g.id = l.group_id
     WHERE l.id = $1`,
    [payload.lessonId],
  );

  if (!lesson) {
    return (
      <div className="student-container student-mobile-page">
        <h1 className="student-page-title">Заняття не знайдено</h1>
        <p className="student-page-subtitle">Можливо, його видалив адміністратор.</p>
      </div>
    );
  }

  const expIso = new Date(payload.exp * 1000).toISOString();

  return (
    <div className="student-container student-mobile-page">
      <h1 className="student-page-title">📱 Завантаження роботи</h1>
      <p className="student-page-subtitle">{student.full_name}</p>

      <div className="student-card student-mobile-lesson-info">
        <div className="student-mobile-lesson-info__title">
          {lesson.course_title || lesson.group_title || 'Заняття'}
        </div>
        <div className="student-mobile-lesson-info__meta">
          {formatTimeRange(lesson.start_datetime, lesson.end_datetime)}
        </div>
        {lesson.topic && (
          <div className="student-mobile-lesson-info__topic">{lesson.topic}</div>
        )}
      </div>

      <MobileUploadForm
        token={params.token}
        tokenExpiresAt={expIso}
        lessonId={lesson.id}
      />
    </div>
  );
}

function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateFmt = new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: 'Europe/Kyiv',
  });
  const timeFmt = new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}
