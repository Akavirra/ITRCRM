/**
 * /lessons/[id] — сторінка заняття для викладача (E.1.3).
 *
 * Кульмінаційна сторінка teacher-портaла:
 *   - Заголовок з курсом/групою + час + бейджі
 *   - Редактор теми + нотаток (auto-save)
 *   - Присутність учнів (інтерактивно)
 *   - Lesson Shortcuts editor (Phase D.1)
 *
 * Фотогалерея — поки read-only посилання на /api/teacher/lessons/[id]/photos
 * (E.1.5 додасть upload). Поки не показуємо тут.
 *
 * Усі дані — через teacher-data.ts. Жодних raw SELECT.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { TEACHER_COOKIE_NAME, getTeacherSession } from '@/lib/teacher-auth';
import { teacherGet } from '@/db/neon-teacher';
import {
  getMyLesson,
  listAttendanceForMyLesson,
  listMyLessonShortcuts,
  listMyLessonPhotos,
  listStudentsInMyGroup,
} from '@/lib/teacher-data';
import LessonTopicEditor from '@/components/teacher/LessonTopicEditor';
import LessonAttendanceList from '@/components/teacher/LessonAttendanceList';
import LessonShortcutsEditor from '@/components/teacher/LessonShortcutsEditor';
import TeacherLessonGallery from '@/components/teacher/TeacherLessonGallery';

export const dynamic = 'force-dynamic';

const KYIV_TZ = 'Europe/Kyiv';

function formatHumanDateTime(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateFmt = new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: KYIV_TZ,
  });
  const timeFmt = new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KYIV_TZ,
  });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}

interface PageProps {
  params: { id: string };
}

export default async function TeacherLessonPage({ params }: PageProps) {
  const sessionId = cookies().get(TEACHER_COOKIE_NAME)?.value;
  if (!sessionId) redirect('/login');
  const session = await getTeacherSession(sessionId);
  if (!session) redirect('/login');

  const teacher = await teacherGet<{ id: number; name: string }>(
    `SELECT id, name FROM users WHERE id = $1`,
    [session.user_id],
  );
  if (!teacher) redirect('/login');

  const lessonId = parseInt(params.id, 10);
  if (!Number.isInteger(lessonId) || lessonId <= 0) notFound();

  const lesson = await getMyLesson(teacher.id, lessonId);
  if (!lesson) notFound();

  // Учні: якщо групове заняття — учні групи; якщо індивідуальне — підіймемо
  // через attendance (учні які мають записи на цьому уроці)
  let students: Array<{ id: number; full_name: string; photo: string | null }> = [];
  if (lesson.group_id) {
    const list = await listStudentsInMyGroup(teacher.id, lesson.group_id);
    students = list.map((s) => ({ id: s.id, full_name: s.full_name, photo: s.photo }));
  }

  const attendance = await listAttendanceForMyLesson(teacher.id, lessonId);

  // Якщо індивідуальне (group_id=null) — показуємо тих, хто є в attendance
  if (!lesson.group_id) {
    const seen = new Set(students.map((s) => s.id));
    for (const a of attendance) {
      if (!seen.has(a.student_id)) {
        students.push({ id: a.student_id, full_name: a.student_full_name, photo: null });
        seen.add(a.student_id);
      }
    }
  }
  students.sort((a, b) => a.full_name.localeCompare(b.full_name, 'uk'));

  const [shortcuts, photos] = await Promise.all([
    listMyLessonShortcuts(teacher.id, lessonId),
    listMyLessonPhotos(teacher.id, lessonId),
  ]);

  const title = lesson.course_title || lesson.group_title || 'Заняття';
  const subtitle =
    lesson.group_title && lesson.course_title && lesson.group_title !== lesson.course_title
      ? lesson.group_title
      : null;

  return (
    <>
      <Link
        href="/dashboard"
        className="teacher-secondary-btn"
        style={{ marginBottom: 12 }}
      >
        ← До дашборду
      </Link>

      <h1 className="teacher-page-title">{title}</h1>
      <p className="teacher-page-subtitle">
        {formatHumanDateTime(lesson.start_datetime, lesson.end_datetime)}
        {subtitle && <> · {subtitle}</>}
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {lesson.is_replacement_for_me && (
          <span className="teacher-lesson-badge teacher-lesson-badge--replacement">
            Ти ведеш як заміна
          </span>
        )}
        {lesson.is_makeup && (
          <span className="teacher-lesson-badge teacher-lesson-badge--makeup">Перенесення</span>
        )}
        {lesson.is_trial && (
          <span className="teacher-lesson-badge teacher-lesson-badge--trial">Пробне</span>
        )}
        {lesson.status === 'done' && (
          <span
            className="teacher-lesson-badge"
            style={{ background: '#ecfdf5', color: '#047857' }}
          >
            Проведено
          </span>
        )}
        {lesson.status === 'cancelled' && (
          <span
            className="teacher-lesson-badge"
            style={{ background: '#fef2f2', color: '#b91c1c' }}
          >
            Скасовано
          </span>
        )}
      </div>

      <div className="teacher-section-header">Тема та нотатки</div>
      <LessonTopicEditor
        lessonId={lesson.id}
        initialTopic={lesson.topic}
        initialNotes={lesson.notes}
      />

      <div className="teacher-section-header">
        Присутність ({students.length})
      </div>
      {students.length === 0 ? (
        <div className="teacher-empty">
          Учнів у цьому занятті немає. Якщо це індивідуальне заняття —
          запис зʼявиться, коли адмін призначить учня.
        </div>
      ) : (
        <LessonAttendanceList
          lessonId={lesson.id}
          students={students}
          initialAttendance={attendance.map((a) => ({
            id: a.id,
            student_id: a.student_id,
            status: a.status,
            comment: a.comment,
          }))}
        />
      )}

      <div className="teacher-section-header">Швидкий доступ для учнів</div>
      <p
        style={{
          fontSize: 13,
          color: '#64748b',
          margin: '-6px 0 12px',
        }}
      >
        Посилання та програми, які учні бачать на сторінці цього заняття у своєму кабінеті.
      </p>
      <LessonShortcutsEditor
        lessonId={lesson.id}
        initialItems={shortcuts.map((s) => ({
          id: s.id,
          kind: s.kind,
          label: s.label,
          target: s.target,
          icon: s.icon,
          sort_order: s.sort_order,
        }))}
      />

      <div
        className="teacher-section-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Галерея заняття</span>
        <span className="teacher-section-counter">{photos.length}</span>
      </div>
      <p
        style={{
          fontSize: 13,
          color: '#64748b',
          margin: '-6px 0 12px',
        }}
      >
        Фото та відео заняття. Додавати поки можна через Telegram-бот або CRM.
      </p>
      <TeacherLessonGallery
        photos={photos.map((p) => ({
          id: p.id,
          drive_file_id: p.drive_file_id,
          file_name: p.file_name,
          mime_type: p.mime_type,
          file_size: p.file_size,
          uploaded_by_name: p.uploaded_by_name,
          uploaded_via: p.uploaded_via,
          created_at: p.created_at,
        }))}
      />
    </>
  );
}
