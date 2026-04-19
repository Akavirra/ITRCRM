/**
 * GET /api/student/schedule — майбутні та недавні минулі уроки авторизованого учня.
 *
 * Використовує ТІЛЬКИ роль crm_student (через @/db/neon-student) — ніколи @/db.
 *
 * Query params:
 *   - window=week (за замовчуванням): 7 днів вперед + 1 день назад
 *   - window=month: 30 днів вперед + 7 днів назад
 *   - window=all:   90 днів вперед + 14 днів назад (повний розклад)
 *
 * Повертає JSON: { student_id, lessons: [...] }
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentFromRequest } from '@/lib/student-auth';
import { studentAll } from '@/db/neon-student';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type WindowKey = 'week' | 'month' | 'all';

const WINDOWS: Record<WindowKey, { backDays: number; forwardDays: number }> = {
  week: { backDays: 1, forwardDays: 7 },
  month: { backDays: 7, forwardDays: 30 },
  all: { backDays: 14, forwardDays: 90 },
};

interface LessonRow {
  id: number;
  public_id: string | null;
  group_id: number | null;
  course_id: number | null;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  status: string | null;
  is_makeup: boolean | null;
  is_trial: boolean | null;
  group_title: string | null;
  course_title: string | null;
  attendance_status: string | null;
}

export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const windowParam = (request.nextUrl.searchParams.get('window') || 'week') as WindowKey;
  const cfg = WINDOWS[windowParam] || WINDOWS.week;

  const from = new Date(Date.now() - cfg.backDays * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + cfg.forwardDays * 24 * 60 * 60 * 1000).toISOString();

  // crm_student має column-level SELECT на lessons/groups/courses/student_groups/attendance.
  // Фільтруємо ТІЛЬКИ уроки груп, куди учень доданий і активний.
  const lessons = await studentAll<LessonRow>(
    `SELECT
       l.id,
       l.public_id,
       l.group_id,
       l.course_id,
       l.lesson_date,
       l.start_datetime,
       l.end_datetime,
       l.topic,
       l.status,
       l.is_makeup,
       l.is_trial,
       g.title AS group_title,
       c.title AS course_title,
       a.status AS attendance_status
     FROM lessons l
     JOIN student_groups sg ON sg.group_id = l.group_id AND sg.student_id = $1 AND sg.is_active = TRUE
     LEFT JOIN groups g ON g.id = l.group_id
     LEFT JOIN courses c ON c.id = l.course_id
     LEFT JOIN attendance a ON a.lesson_id = l.id AND a.student_id = $1
     WHERE l.start_datetime >= $2 AND l.start_datetime <= $3
     ORDER BY l.start_datetime ASC
     LIMIT 200`,
    [student.id, from, to]
  );

  return NextResponse.json({
    student_id: student.id,
    window: windowParam,
    from,
    to,
    lessons,
  });
}
